import test from 'node:test';
import assert from 'node:assert/strict';
import { runNearAiVerified } from './near-ai-tee.mjs';
import { validateOutLayerTransfer } from './outlayer-custody.mjs';

test('NEAR AI rejects responses without a provider TEE signature', async () => {
  const result = await runNearAiVerified({
    prompt: 'inspect this bounded test case', model: 'test-model', apiKey: 'test-key',
    clientFactory: async () => ({
      verify: async () => ({ models: [{ name: 'test-model' }], verifiedAt: '2026-11-10T00:00:00Z' }),
      chat: { completions: { create: async () => ({ id: 'completion-1', choices: [{ message: { content: 'test result' } }] }) } },
      verifyResponse: async () => ({ signatureKind: 'gateway', verifiedAt: '2026-11-10T00:00:01Z' }),
    }),
  });
  assert.equal(result.verification.responseSignatureVerified, true);
  assert.equal(result.verification.modelTeeVerified, false);
  assert.equal(result.verification.status, 'signed_but_model_tee_unproven');
});

test('NEAR AI marks only provider_tee signed responses as model TEE verified', async () => {
  const result = await runNearAiVerified({
    prompt: 'bounded test', model: 'tee-model', apiKey: 'test-key',
    clientFactory: async () => ({
      verify: async () => ({ models: [{ name: 'tee-model' }] }),
      chat: { completions: { create: async () => ({ id: 'completion-2', choices: [{ message: { content: 'verified result' } }] }) } },
      verifyResponse: async () => ({ signatureKind: 'provider_tee' }),
    }),
  });
  assert.equal(result.verification.modelTeeVerified, true);
  assert.equal(result.verification.status, 'verified');
});

test('NEAR AI refuses to call inference if model attestation preflight returns no model proof', async () => {
  let called = false;
  await assert.rejects(() => runNearAiVerified({
    prompt: 'test', model: 'unsupported', apiKey: 'test-key',
    clientFactory: async () => ({
      verify: async () => ({ models: [] }),
      chat: { completions: { create: async () => { called = true; return {}; } } },
      verifyResponse: async () => ({ signatureKind: 'provider_tee' }),
    }),
  }), /did not return a verified model attestation/);
  assert.equal(called, false);
});

test('OutLayer transfer stays off until explicitly enabled', () => {
  assert.throws(() => validateOutLayerTransfer({ to: 'vendor.testnet', amount: '1' }, {
    OUTLAYER_ENABLE_MUTATIONS: 'false', OUTLAYER_ALLOWED_RECIPIENTS: 'vendor.testnet', OUTLAYER_MAX_TRANSFER_YOCTO: '10',
  }), /transfer is disabled/);
});

test('OutLayer transfer enforces Testnet recipient allowlist and maximum amount', () => {
  const env = { OUTLAYER_ENABLE_MUTATIONS: 'true', OUTLAYER_ALLOWED_RECIPIENTS: 'vendor.testnet', OUTLAYER_MAX_TRANSFER_YOCTO: '1000', OUTLAYER_NETWORK: 'testnet' };
  assert.deepEqual(validateOutLayerTransfer({ to: 'vendor.testnet', amount: '1000' }, env), { to: 'vendor.testnet', amount: '1000' });
  assert.throws(() => validateOutLayerTransfer({ to: 'attacker.testnet', amount: '1' }, env), /not on the server-side/);
  assert.throws(() => validateOutLayerTransfer({ to: 'vendor.testnet', amount: '1001' }, env), /exceeds the configured/);
  assert.throws(() => validateOutLayerTransfer({ to: 'vendor.near', amount: '1' }, env), /\.testnet account/);
});
