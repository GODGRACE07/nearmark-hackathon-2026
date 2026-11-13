import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { verifyOutLayerReceipt } from './verify-receipt.mjs';

const DOMAIN = 'NEARMARK:NASB-0.1:OUTLAYER-RECEIPT-SIGNING:V1\n';
function fixture() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const der = publicKey.export({ format: 'der', type: 'spki' });
  const receipt = {
    schema: 'nearmark.nasb0_1.receipt-signing.v1', suite_version: 'NASB-0.1',
    source_commit: '0123456789abcdef0123456789abcdef01234567',
    config_sha256: 'a'.repeat(64), contract_wasm_sha256: 'b'.repeat(64), evidence_manifest_sha256: 'c'.repeat(64),
    block_height: 123456, scenario_count: 7, signer_account_id: 'owner.testnet', outlayer_request_id: 'req-123',
    near_transaction_hash: null, issued_at_unix_seconds: 1800000000,
    execution_scope: 'TEE_EXECUTED_CANONICAL_RECEIPT_SIGNING_ONLY', semantic_claims_verified: false,
  };
  const canonicalBytes = Buffer.from(JSON.stringify(receipt));
  const message = Buffer.concat([Buffer.from(DOMAIN), canonicalBytes]);
  return {
    privateKey,
    output: {
      status: 'tee_execution_signature_created', receipt,
      receipt_sha256: createHash('sha256').update(canonicalBytes).digest('hex'),
      signer_public_key_hex: der.subarray(-32).toString('hex'),
      signature_hex: sign(null, message, privateKey).toString('hex'), signature_algorithm: 'ed25519',
    },
  };
}

test('OutLayer worker receipt signature and canonical hash verify', () => {
  const { output } = fixture();
  const result = verifyOutLayerReceipt(output);
  assert.equal(result.valid, true);
  assert.equal(result.signature_verified, true);
  assert.equal(result.tee_attestation_verified, false);
});

test('OutLayer worker receipt rejects tampered benchmark fields', () => {
  const { output } = fixture();
  output.receipt.block_height += 1;
  assert.throws(() => verifyOutLayerReceipt(output), /SHA-256 does not match/);
});

test('OutLayer worker receipt refuses to claim semantic validation', () => {
  const { output } = fixture();
  output.receipt.semantic_claims_verified = true;
  assert.throws(() => verifyOutLayerReceipt(output), /disclaim semantic claim verification/);
});


test('compact OutLayer response stays below 900 bytes and verifies the canonical receipt signature', () => {
  const { output } = fixture();
  const r = output.receipt;
  const compact = {
    s: output.status,
    r: {
      v: r.schema,
      sv: r.suite_version,
      c: r.source_commit,
      cf: r.config_sha256,
      cw: r.contract_wasm_sha256,
      em: r.evidence_manifest_sha256,
      bh: r.block_height,
      sc: r.scenario_count,
      a: r.signer_account_id,
      id: r.outlayer_request_id,
      tx: r.near_transaction_hash,
      ts: r.issued_at_unix_seconds,
      x: r.execution_scope,
      m: r.semantic_claims_verified,
    },
    h: output.receipt_sha256,
    p: output.signer_public_key_hex,
    g: output.signature_hex,
    al: output.signature_algorithm,
  };
  assert.ok(Buffer.byteLength(JSON.stringify(compact), 'utf8') <= 900);
  const result = verifyOutLayerReceipt(compact);
  assert.equal(result.valid, true);
  assert.equal(result.signature_verified, true);
});
