import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCounterparty, runSecurityBenchmark } from './engine.mjs';

const mandate = { allowedRecipients: ['vendor.near'], strictRecipients: true, maxAmount: 5, allowedMethods: ['transfer'], requestedMethod: 'transfer' };

test('blocks a recipient that is not in strict owner mandate', () => {
  const result = evaluateCounterparty({ receiver: 'attacker.near', amount: '1', mandate });
  assert.equal(result.decision, 'BLOCK');
  assert.ok(result.reasons.includes('RECIPIENT_NOT_IN_OWNER_MANDATE'));
});

test('allows a mandated payment with a valid amount', () => {
  const result = evaluateCounterparty({ receiver: 'vendor.near', amount: '5', mandate, receiverInfo: { exists: true, blockHeight: 1, hasContract: false } });
  assert.equal(result.decision, 'ALLOW');
});

test('blocks owner spending limit violations', () => {
  const result = evaluateCounterparty({ receiver: 'vendor.near', amount: '5.01', mandate });
  assert.equal(result.decision, 'BLOCK');
  assert.ok(result.reasons.includes('OWNER_LIMIT_EXCEEDED'));
});

test('core benchmark produces a verifiable local receipt', () => {
  const result = runSecurityBenchmark();
  assert.equal(result.summary.total, 6);
  assert.equal(result.summary.failed, 0);
  assert.equal(result.receipt.verified, true);
});

test('full access baseline fails security assertions it cannot enforce', () => {
  const result = runSecurityBenchmark({ profile: 'full-access-baseline' });
  assert.ok(result.summary.failed >= 4);
});

test('function-call baseline demonstrates method scope but not spending mandate', () => {
  const result = runSecurityBenchmark({ profile: 'function-call-baseline' });
  assert.ok(result.scenarios.find(s => s.id === 'method-restriction').passed);
  assert.equal(result.scenarios.find(s => s.id === 'amount-limit').passed, false);
});

test('uses exact decimal arithmetic for very small NEAR amounts', () => {
  const result = evaluateCounterparty({ receiver: 'vendor.near', amount: '0.300000000000000000000001', mandate: { ...mandate, maxAmount: '0.3' } });
  assert.equal(result.decision, 'BLOCK');
  assert.ok(result.reasons.includes('OWNER_LIMIT_EXCEEDED'));
});

test('blocks invalid or over-precision amounts instead of rounding them', () => {
  const result = evaluateCounterparty({ receiver: 'vendor.near', amount: '1e3', mandate });
  assert.equal(result.decision, 'BLOCK');
  assert.ok(result.reasons.includes('INVALID_AMOUNT'));
});


test('blocks a request when the owner restricts methods but no method is supplied', () => {
  const result = evaluateCounterparty({
    receiver: 'vendor.near',
    amount: '1',
    mandate: { ...mandate, requestedMethod: null },
  });
  assert.equal(result.decision, 'BLOCK');
  assert.ok(result.reasons.includes('METHOD_NOT_SUPPLIED'));
});
