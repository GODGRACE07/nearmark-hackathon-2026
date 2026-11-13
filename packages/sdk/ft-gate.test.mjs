import test from 'node:test';
import assert from 'node:assert/strict';
import { NearmarkClient, createNearApiJsFtGateAdapter } from './index.mjs';

const input = {
  agentAccount: 'agent.testnet', agentPublicKey: 'ed25519:agent-key',
  tokenId: 'usdt.fakes.testnet', receiver: 'vendor.testnet', amount: '75',
  method: 'ft_transfer', allowedRecipients: ['vendor.testnet'], strictRecipients: true,
  maxAmount: '100', allowedMethods: ['ft_transfer'],
};
function harness(decision = 'ALLOW', keyMethods = ['execute_ft_payment'], overrides = {}) {
  const client = new NearmarkClient();
  let calls = 0; let captured = null;
  client.inspect = async () => ({ keyAssessment: { selectedKey: {
    kind: 'FunctionCall', publicKey: input.agentPublicKey, receiverId: 'ft-gate.testnet',
    methodNames: keyMethods, unrestrictedMethods: false,
  } } });
  client.checkCounterparty = async () => ({ decision, receiver: input.receiver, amount: input.amount, reasons: ['FT_TEST'] });
  const gate = {
    accountId: 'ft-gate.testnet',
    async getStatus() { return {
      agent_id: input.agentAccount, agent_public_key: input.agentPublicKey,
      token_policies: [{ token_id: input.tokenId, allowed_receivers: ['vendor.testnet'], max_payment: '100', daily_limit: '250', spent_today: '20', current_day: '10' }],
      next_nonce: '8', paused: false, ...overrides,
    }; },
    async executeFtPayment(args) { calls += 1; captured = args; return { tx: 'ft-gate-call' }; },
  };
  return { client, gate, get calls() { return calls; }, get captured() { return captured; } };
}

test('FT Gate success uses exact token, amount units, nonce and expiry', async () => {
  const h = harness();
  const r = await h.client.executeFtThroughGate(input, { gate: h.gate, gateAccountId: 'ft-gate.testnet', nowNs: () => (10n * 86_400_000_000_000n) + 1_000_000_000n });
  assert.equal(h.calls, 1);
  assert.deepEqual(r.args, { token_id: input.tokenId, receiver_id: input.receiver, amount: '75', nonce: '8', expires_at_ns: '864061000000000', memo: 'NEARMARK guarded FT payment' });
});

test('FT Gate refuses an agent key with any extra method', async () => {
  const h = harness('ALLOW', ['execute_ft_payment', 'set_paused']);
  await assert.rejects(h.client.executeFtThroughGate(input, { gate: h.gate, gateAccountId: 'ft-gate.testnet' }), e => e.code === 'NEARMARK_AGENT_KEY_NOT_SCOPED');
  assert.equal(h.calls, 0);
});

test('FT Gate blocks token contract substitution', async () => {
  const h = harness();
  await assert.rejects(h.client.executeFtThroughGate({ ...input, tokenId: 'attacker-token.testnet' }, { gate: h.gate, gateAccountId: 'ft-gate.testnet' }), e => e.code === 'NEARMARK_FT_TOKEN_DENIED');
  assert.equal(h.calls, 0);
});

test('FT Gate blocks recipient substitution', async () => {
  const h = harness();
  await assert.rejects(h.client.executeFtThroughGate({ ...input, receiver: 'attacker.testnet' }, { gate: h.gate, gateAccountId: 'ft-gate.testnet' }), e => e.code === 'NEARMARK_FT_RECIPIENT_DENIED');
  assert.equal(h.calls, 0);
});

test('FT Gate blocks per-payment and daily cap violations', async () => {
  const a = harness();
  await assert.rejects(a.client.executeFtThroughGate({ ...input, amount: '101' }, { gate: a.gate, gateAccountId: 'ft-gate.testnet', nowNs: () => (10n * 86_400_000_000_000n) + 1_000_000_000n }), e => e.code === 'NEARMARK_FT_AMOUNT_DENIED');
  const b = harness('ALLOW', ['execute_ft_payment'], { token_policies: [{ token_id: input.tokenId, allowed_receivers: ['vendor.testnet'], max_payment: '100', daily_limit: '250', spent_today: '200', current_day: '10' }] });
  await assert.rejects(b.client.executeFtThroughGate({ ...input, amount: '51' }, { gate: b.gate, gateAccountId: 'ft-gate.testnet', nowNs: () => (10n * 86_400_000_000_000n) + 1_000_000_000n }), e => e.code === 'NEARMARK_FT_DAILY_LIMIT_DENIED');
  assert.equal(a.calls + b.calls, 0);
});


test('FT Gate daily allowance rolls forward when on-chain policy is from a previous day', async () => {
  const h = harness('ALLOW', ['execute_ft_payment'], { token_policies: [{ token_id: input.tokenId, allowed_receivers: ['vendor.testnet'], max_payment: '100', daily_limit: '250', spent_today: '999', current_day: '9' }] });
  const r = await h.client.executeFtThroughGate(input, { gate: h.gate, gateAccountId: 'ft-gate.testnet', nowNs: () => (10n * 86_400_000_000_000n) + 1_000_000_000n });
  assert.equal(h.calls, 1);
  assert.equal(r.args.amount, '75');
});

test('FT Gate BLOCK does not call adapter; WARN requires approval', async () => {
  const b = harness('BLOCK');
  await assert.rejects(b.client.executeFtThroughGate(input, { gate: b.gate, gateAccountId: 'ft-gate.testnet', nowNs: () => (10n * 86_400_000_000_000n) + 1_000_000_000n }), e => e.code === 'NEARMARK_BLOCKED');
  const w = harness('WARN');
  await assert.rejects(w.client.executeFtThroughGate(input, { gate: w.gate, gateAccountId: 'ft-gate.testnet' }), e => e.code === 'NEARMARK_HUMAN_APPROVAL_REQUIRED');
  assert.equal(b.calls + w.calls, 0);
});

test('near-api-js FT adapter calls only execute_ft_payment with zero deposit', async () => {
  const calls = [];
  const adapter = createNearApiJsFtGateAdapter({
    account: { accountId: input.agentAccount, async callFunction(req) { calls.push(req); return { tx: 'ok' }; } },
    provider: { async callFunction(req) { calls.push(req); return { paused: false }; } },
    agentAccountId: input.agentAccount, gateAccountId: 'ft-gate.testnet',
  });
  await adapter.getStatus();
  await adapter.executeFtPayment({ token_id: input.tokenId, receiver_id: input.receiver, amount: '75', nonce: '0', expires_at_ns: '99', memo: '' });
  assert.equal(calls[0].method, 'get_status');
  assert.equal(calls[1].methodName, 'execute_ft_payment');
  assert.equal(calls[1].deposit, 0n);
});

test('FT Gate rejects token amounts larger than the NEP-141 U128 range', async () => {
  const h = harness();
  await assert.rejects(h.client.executeFtThroughGate({ ...input, amount: ((1n << 128n)).toString() }, { gate: h.gate, gateAccountId: 'ft-gate.testnet', nowNs: () => (10n * 86_400_000_000_000n) + 1_000_000_000n }), e => e.code === 'NEARMARK_INVALID_FT_AMOUNT');
  assert.equal(h.calls, 0);
});
