import test from 'node:test';
import assert from 'node:assert/strict';
import { NearmarkClient, createNearApiJsGateAdapter } from './index.mjs';

const input = {
  agentAccount: 'agent.testnet',
  agentPublicKey: 'ed25519:agent-public-key',
  receiver: 'vendor.testnet',
  amount: '0.005',
  method: 'transfer',
  allowedRecipients: ['vendor.testnet'],
  strictRecipients: true,
  maxAmount: '0.01',
  allowedMethods: ['transfer'],
};

function harness(decision = 'ALLOW', keyOverrides = {}, gateOverrides = {}) {
  const client = new NearmarkClient();
  let executions = 0;
  let capturedArgs = null;
  client.inspect = async () => ({
    keyAssessment: {
      selectedKey: {
        kind: 'FunctionCall',
        publicKey: input.agentPublicKey,
        receiverId: 'gate.testnet',
        methodNames: ['execute_payment'],
        unrestrictedMethods: false,
        ...keyOverrides,
      },
    },
  });
  client.checkCounterparty = async () => ({
    decision,
    receiver: input.receiver,
    amount: input.amount,
    reasons: ['TEST_REASON'],
    evidence: [],
    confidence: 'high',
    disclaimer: 'Test fixture.',
  });
  const gate = {
    accountId: 'gate.testnet',
    async getStatus() {
      return {
        agent_id: input.agentAccount,
        agent_public_key: input.agentPublicKey,
        allowed_receivers: ['vendor.testnet'],
        max_payment_yocto: '10000000000000000000000',
        daily_limit_yocto: '20000000000000000000000',
        spent_today_yocto: '0',
        next_nonce: '7',
        paused: false,
        ...gateOverrides,
      };
    },
    async executePayment(args) {
      executions += 1;
      capturedArgs = args;
      return { transactionHash: 'sandbox-receipt' };
    },
  };
  return { client, gate, get executions() { return executions; }, get capturedArgs() { return capturedArgs; } };
}

test('ALLOW checks registered FunctionCall scope and submits exact payment to Gate', async () => {
  const h = harness();
  const result = await h.client.executeThroughGate(input, {
    gate: h.gate,
    gateAccountId: 'gate.testnet',
    nowNs: () => 1_000_000_000_000n,
  });
  assert.equal(h.executions, 1);
  assert.equal(result.args.receiver_id, 'vendor.testnet');
  assert.equal(result.args.amount_yocto, '5000000000000000000000');
  assert.equal(result.args.nonce, '7');
  assert.equal(result.args.expires_at_ns, '1060000000000');
  assert.equal(result.execution.transactionHash, 'sandbox-receipt');
});

test('BLOCK never invokes the Gate adapter', async () => {
  const h = harness('BLOCK');
  await assert.rejects(
    h.client.executeThroughGate(input, { gate: h.gate, gateAccountId: 'gate.testnet' }),
    error => error.code === 'NEARMARK_BLOCKED',
  );
  assert.equal(h.executions, 0);
});

test('WARN without explicit human approval never invokes the Gate adapter', async () => {
  const h = harness('WARN');
  await assert.rejects(
    h.client.executeThroughGate(input, { gate: h.gate, gateAccountId: 'gate.testnet' }),
    error => error.code === 'NEARMARK_HUMAN_APPROVAL_REQUIRED',
  );
  assert.equal(h.executions, 0);
});

test('WARN with explicit human approval invokes the Gate adapter', async () => {
  const h = harness('WARN');
  await h.client.executeThroughGate(input, {
    gate: h.gate,
    gateAccountId: 'gate.testnet',
    onWarn: async () => true,
  });
  assert.equal(h.executions, 1);
});

test('Full Access or wrong-scope key is rejected before execution', async () => {
  const h = harness('ALLOW', { kind: 'FullAccess' });
  await assert.rejects(
    h.client.executeThroughGate(input, { gate: h.gate, gateAccountId: 'gate.testnet' }),
    error => error.code === 'NEARMARK_AGENT_KEY_NOT_SCOPED',
  );
  assert.equal(h.executions, 0);
});

test('a FunctionCall key scoped to another method is rejected', async () => {
  const h = harness('ALLOW', { methodNames: ['execute_payment', 'set_paused'] });
  await assert.rejects(
    h.client.executeThroughGate(input, { gate: h.gate, gateAccountId: 'gate.testnet' }),
    error => error.code === 'NEARMARK_AGENT_KEY_NOT_SCOPED',
  );
  assert.equal(h.executions, 0);
});

test('paused Gate never executes', async () => {
  const h = harness('ALLOW', {}, { paused: true });
  await assert.rejects(
    h.client.executeThroughGate(input, { gate: h.gate, gateAccountId: 'gate.testnet' }),
    error => error.code === 'NEARMARK_GATE_PAUSED',
  );
  assert.equal(h.executions, 0);
});

test('unapproved on-chain recipient never executes', async () => {
  const h = harness('ALLOW', {}, { allowed_receivers: ['someone-else.testnet'] });
  await assert.rejects(
    h.client.executeThroughGate(input, { gate: h.gate, gateAccountId: 'gate.testnet' }),
    error => error.code === 'NEARMARK_GATE_RECIPIENT_DENIED',
  );
  assert.equal(h.executions, 0);
});

test('policy response with a substituted recipient or amount is rejected', async () => {
  const h = harness();
  h.client.checkCounterparty = async () => ({ decision: 'ALLOW', receiver: 'attacker.testnet', amount: input.amount, reasons: [] });
  await assert.rejects(
    h.client.executeThroughGate(input, { gate: h.gate, gateAccountId: 'gate.testnet' }),
    error => error.code === 'NEARMARK_DECISION_MISMATCH',
  );
  assert.equal(h.executions, 0);
});

test('invalid precision and wrong Gate target fail closed', async () => {
  const h = harness();
  await assert.rejects(
    h.client.executeThroughGate({ ...input, amount: '0.0000000000000000000000001' }, { gate: h.gate, gateAccountId: 'gate.testnet' }),
    error => error.code === 'NEARMARK_INVALID_AMOUNT',
  );
  await assert.rejects(
    h.client.executeThroughGate(input, { gate: h.gate, gateAccountId: 'other-gate.testnet' }),
    error => error.code === 'NEARMARK_GATE_TARGET_MISMATCH',
  );
  assert.equal(h.executions, 0);
});


test('near-api-js adapter reads Gate status and calls only execute_payment with zero deposit', async () => {
  const calls = [];
  const adapter = createNearApiJsGateAdapter({
    account: {
      accountId: input.agentAccount,
      async callFunction(request) {
        calls.push(request);
        return { transactionHash: 'near-api-js-test' };
      },
    },
    provider: {
      async callFunction(request) {
        calls.push(request);
        return { paused: false };
      },
    },
    agentAccountId: input.agentAccount,
    gateAccountId: 'gate.testnet',
  });

  const status = await adapter.getStatus();
  assert.equal(status.paused, false);
  const result = await adapter.executePayment({
    receiver_id: 'vendor.testnet',
    amount_yocto: '5',
    nonce: '1',
    expires_at_ns: '9999999999999999999',
    memo: 'adapter test',
  });

  assert.equal(result.transactionHash, 'near-api-js-test');
  assert.deepEqual(calls[0], {
    contractId: 'gate.testnet', method: 'get_status', args: {},
  });
  assert.equal(calls[1].contractId, 'gate.testnet');
  assert.equal(calls[1].methodName, 'execute_payment');
  assert.equal(calls[1].deposit, 0n);
  assert.equal(calls[1].gas, 30_000_000_000_000n);
});

test('near-api-js adapter rejects a signer from another account', () => {
  assert.throws(
    () => createNearApiJsGateAdapter({
      account: { accountId: 'wrong.testnet', callFunction: async () => {} },
      provider: { callFunction: async () => ({}) },
      agentAccountId: input.agentAccount,
      gateAccountId: 'gate.testnet',
    }),
    error => error.code === 'NEARMARK_AGENT_ACCOUNT_MISMATCH',
  );
});

test('Gate daily budget is checked before attempting execution', async () => {
  const h = harness('ALLOW', {}, {
    spent_today_yocto: '19999999999999999999999',
    daily_limit_yocto: '20000000000000000000000',
  });
  await assert.rejects(
    h.client.executeThroughGate(input, { gate: h.gate, gateAccountId: 'gate.testnet' }),
    error => error.code === 'NEARMARK_GATE_DAILY_LIMIT_DENIED',
  );
  assert.equal(h.executions, 0);
});


test('selected key public key must exactly match the requested agent key', async () => {
  const h = harness('ALLOW', { publicKey: 'ed25519:some-other-key' });
  await assert.rejects(
    h.client.executeThroughGate(input, { gate: h.gate, gateAccountId: 'gate.testnet' }),
    error => error.code === 'NEARMARK_AGENT_KEY_NOT_SCOPED',
  );
  assert.equal(h.executions, 0);
});

test('Gate status must explicitly prove the contract is not paused', async () => {
  const h = harness('ALLOW', {}, { paused: undefined });
  await assert.rejects(
    h.client.executeThroughGate(input, { gate: h.gate, gateAccountId: 'gate.testnet' }),
    error => error.code === 'NEARMARK_GATE_STATUS_INVALID',
  );
  assert.equal(h.executions, 0);
});

test('Gate must match the requested agent identity', async () => {
  const h = harness('ALLOW', {}, { agent_id: 'other-agent.testnet' });
  await assert.rejects(
    h.client.executeThroughGate(input, { gate: h.gate, gateAccountId: 'gate.testnet' }),
    error => error.code === 'NEARMARK_GATE_AGENT_MISMATCH',
  );
  assert.equal(h.executions, 0);
});
