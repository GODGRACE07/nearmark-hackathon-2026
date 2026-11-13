import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';

const DOMAIN = 'NEARMARK:NASB-0.1:OUTLAYER-RECEIPT-SIGNING:V1\n';

function fail(message) {
  const error = new Error(message);
  error.code = 'NEARMARK_OUTLAYER_RECEIPT_INVALID';
  throw error;
}

/**
 * Verify the NEARMARK worker's detached Ed25519 signature and canonical receipt hash.
 * This does NOT verify the independent Intel TDX quote. Use outlayer-verify call
 * with the real call ID, exact input and exact output to validate the remote TEE.
 */
function expandCompactOutput(output) {
  if (!output || output.s !== 'tee_execution_signature_created' || !output.r) return output;
  const r = output.r;
  return {
    status: output.s,
    receipt: {
      schema: r.v,
      suite_version: r.sv,
      source_commit: r.c,
      config_sha256: r.cf,
      contract_wasm_sha256: r.cw,
      evidence_manifest_sha256: r.em,
      block_height: r.bh,
      scenario_count: r.sc,
      signer_account_id: r.a,
      outlayer_request_id: r.id,
      near_transaction_hash: r.tx ?? null,
      issued_at_unix_seconds: r.ts,
      execution_scope: r.x,
      semantic_claims_verified: r.m,
    },
    receipt_sha256: output.h,
    signer_public_key_hex: output.p,
    signature_hex: output.g,
    signature_algorithm: output.al,
  };
}

export function verifyOutLayerReceipt(output) {
  output = expandCompactOutput(output);
  if (!output || output.status !== 'tee_execution_signature_created') fail('Worker output status is not a signed receipt.');
  if (output.signature_algorithm !== 'ed25519') fail('Unsupported receipt signature algorithm.');
  if (typeof output.signer_public_key_hex !== 'string' || !/^[0-9a-f]{64}$/i.test(output.signer_public_key_hex)) fail('Signer public key must be 32-byte Ed25519 hex.');
  if (typeof output.signature_hex !== 'string' || !/^[0-9a-f]{128}$/i.test(output.signature_hex)) fail('Receipt signature must be 64-byte Ed25519 hex.');
  if (typeof output.receipt_sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(output.receipt_sha256)) fail('Receipt hash must be SHA-256 hex.');
  const r = output.receipt;
  if (!r || r.schema !== 'nearmark.nasb0_1.receipt-signing.v1') fail('Unexpected receipt schema.');
  if (r.suite_version !== 'NASB-0.1') fail('Unsupported benchmark suite version; expected NASB-0.1.');
  if (r.execution_scope !== 'TEE_EXECUTED_CANONICAL_RECEIPT_SIGNING_ONLY') fail('Unexpected receipt execution scope.');
  if (r.semantic_claims_verified !== false) fail('Receipt must explicitly disclaim semantic claim verification.');
  if (!/^[0-9a-f]{40}$/i.test(String(r.source_commit || ''))) fail('Receipt source commit is invalid.');
  for (const field of ['config_sha256', 'contract_wasm_sha256', 'evidence_manifest_sha256']) {
    if (!/^[0-9a-f]{64}$/i.test(String(r[field] || ''))) fail(`Receipt ${field} is invalid.`);
  }
  if (!Number.isSafeInteger(r.block_height) || r.block_height <= 0 || !Number.isInteger(r.scenario_count) || r.scenario_count < 1 || r.scenario_count > 100) fail('Receipt benchmark bounds are invalid.');
  if (typeof r.signer_account_id !== 'string' || !r.signer_account_id || typeof r.outlayer_request_id !== 'string' || !r.outlayer_request_id) fail('Receipt execution identity is missing.');
  if (!Number.isSafeInteger(r.issued_at_unix_seconds) || r.issued_at_unix_seconds <= 0) fail('Receipt timestamp is invalid.');

  // Build the exact Rust Receipt struct field order; don't sign arbitrary JSON supplied by a caller.
  const canonicalReceipt = {
    schema: r.schema,
    suite_version: r.suite_version,
    source_commit: r.source_commit,
    config_sha256: r.config_sha256,
    contract_wasm_sha256: r.contract_wasm_sha256,
    evidence_manifest_sha256: r.evidence_manifest_sha256,
    block_height: r.block_height,
    scenario_count: r.scenario_count,
    signer_account_id: r.signer_account_id,
    outlayer_request_id: r.outlayer_request_id,
    near_transaction_hash: r.near_transaction_hash ?? null,
    issued_at_unix_seconds: r.issued_at_unix_seconds,
    execution_scope: r.execution_scope,
    semantic_claims_verified: false,
  };
  const canonicalBytes = Buffer.from(JSON.stringify(canonicalReceipt), 'utf8');
  const digest = createHash('sha256').update(canonicalBytes).digest('hex');
  if (digest !== output.receipt_sha256.toLowerCase()) fail('Canonical receipt SHA-256 does not match worker output.');
  const message = Buffer.concat([Buffer.from(DOMAIN, 'utf8'), canonicalBytes]);
  const rawPublicKey = Buffer.from(output.signer_public_key_hex, 'hex');
  const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
  const publicKey = createPublicKey({ key: Buffer.concat([spkiPrefix, rawPublicKey]), format: 'der', type: 'spki' });
  const signatureOk = verifySignature(null, message, publicKey, Buffer.from(output.signature_hex, 'hex'));
  if (!signatureOk) fail('Ed25519 receipt signature verification failed.');
  return {
    valid: true,
    signature_verified: true,
    receipt_sha256: digest,
    signer_public_key_hex: output.signer_public_key_hex.toLowerCase(),
    tee_attestation_verified: false,
    next_step: 'Verify the actual OutLayer call ID, input and output with outlayer-verify before claiming TEE attestation.',
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import('node:fs/promises');
  const inputPath = process.argv[2];
  if (!inputPath) {
    process.stderr.write('Usage: node integrations/outlayer-worker/verify-receipt.mjs <worker-output.json>\n');
    process.exit(2);
  }
  try {
    const output = JSON.parse(await fs.readFile(inputPath, 'utf8'));
    process.stdout.write(`${JSON.stringify(verifyOutLayerReceipt(output), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message || error}\n`);
    process.exit(1);
  }
}
