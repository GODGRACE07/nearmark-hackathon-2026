import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuthorityShadow } from './authority-shadow.mjs';

test('Authority Shadow refuses to infer downstream effects for unknown contracts', async () => {
  const result = await buildAuthorityShadow({
    agentAccount: 'agent.near',
    keys: [{ kind: 'FunctionCall', publicKey: 'ed25519:test', receiverId: 'unknown.near', methodNames: ['pay'] }],
    env: {}, readAccount: async () => ({ code_hash: 'abc' }), readStatus: async () => ({})
  });
  assert.equal(result.downstreamAuthority[0].status, 'UNKNOWN');
  assert.match(result.downstreamAuthority[0].downstreamEffects, /UNKNOWN/);
});

test('Authority Shadow labels known code only after code hash, agent and method binding match', async () => {
  const result = await buildAuthorityShadow({
    agentAccount: 'agent.near',
    keys: [{ kind: 'FunctionCall', publicKey: 'ed25519:test', receiverId: 'ft-gate.near', methodNames: ['execute_ft_payment'] }],
    env: { NEARMARK_FT_GATE_ACCOUNT: 'ft-gate.near', NEARMARK_FT_GATE_CODE_HASH: 'hash' },
    readAccount: async () => ({ code_hash: 'hash' }),
    readStatus: async () => ({ agent_id: 'agent.near', agent_public_key: 'ed25519:test', owner_id: 'owner.near', paused: false, next_nonce: '0', policy_version: '1', token_policies: [] })
  });
  assert.equal(result.downstreamAuthority[0].status, 'CODE_HASH_AND_AGENT_BINDING_CONFIRMED');
  assert.ok(result.downstreamAuthority[0].evidence.some(e => e.label === 'code-inferred'));
});

test('Authority Shadow does not treat an extra key method as a verified Gate binding', async () => {
  const result = await buildAuthorityShadow({
    agentAccount: 'agent.near',
    keys: [{ kind: 'FunctionCall', publicKey: 'ed25519:test', receiverId: 'ft-gate.near', methodNames: ['execute_ft_payment', 'set_paused'] }],
    env: { NEARMARK_FT_GATE_ACCOUNT: 'ft-gate.near', NEARMARK_FT_GATE_CODE_HASH: 'hash' },
    readAccount: async () => ({ code_hash: 'hash' }),
    readStatus: async () => ({ agent_id: 'agent.near', agent_public_key: 'ed25519:test' })
  });
  assert.equal(result.downstreamAuthority[0].status, 'PARTIAL');
});
