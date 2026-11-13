import fs from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { InferenceClient } from '@nearai/inference-sdk/node';

process.loadEnvFile('/home/grace/NEARMARK-COMPLETE-BUILD/nearmark/.env');

const MODEL = 'deepseek-ai/DeepSeek-V4.1-Flash-1017';
const BASE = 'https://cloud-api.near.ai/v1/';

let stage = 'initialization';
let completionId = null;
let preflight;

function saveReport(status, extra = {}) {
  fs.mkdirSync('artifacts', { recursive: true });

  const report = {
    timestamp: new Date().toISOString(),
    model: MODEL,
    node: process.version,
    stage,
    status,
    completionId,
    ...extra
  };

  fs.writeFileSync(
    'artifacts/nearmark-final-inference.json',
    JSON.stringify(report, null, 2),
    { mode: 0o600 }
  );

  fs.chmodSync('artifacts/nearmark-final-inference.json', 0o600);
}

async function main() {
  if (process.version !== 'v24.22.1') {
    throw new Error('Incorrect Node version: ' + process.version);
  }

  const key = process.env.NEAR_AI_API_KEY?.trim();
  if (!key) throw new Error('NEAR_AI_API_KEY is missing.');

  const client = new InferenceClient({
    apiKey: key,
    baseUrl: BASE,
    signingAlgo: 'ed25519',
    e2ee: true,
    ohttp: false,
    attestationCacheTimeToLiveMs: 0
  });

  console.log('NEARMARK FINAL INFERENCE TEST');
  console.log('Model:', MODEL);
  console.log('Node:', process.version);

  stage = 'cryptographic_preflight';

  console.log('\n1. Verifying Gateway and model evidence...');

  preflight = await client.verify(MODEL);

  if (
    preflight.gateway.tcbStatus !== 'UpToDate' ||
    preflight.gateway.tlsBinding.kind !== 'attested'
  ) {
    throw new Error('Gateway verification failed.');
  }

  if (!preflight.models?.length) {
    throw new Error('No verified model reports.');
  }

  for (const item of preflight.models) {
    if (
      item.tcbStatus !== 'UpToDate' ||
      item.gpuEvidence !== 'verified' ||
      item.signer.signingAlgo !== 'ed25519'
    ) {
      throw new Error('Model attestation verification failed.');
    }
  }

  console.log('PASS: Gateway TEE.');
  console.log('PASS: Gateway TLS binding.');
  console.log('PASS: Intel TDX.');
  console.log('PASS: NVIDIA GPU evidence.');
  console.log('PASS: Model signing identity.');

  stage = 'awaiting_approval';

  console.log('\nOne small inference may consume your free Builder credits.');

  const rl = createInterface({ input: stdin, output: stdout });

  const answer = await rl.question(
    'Type exactly RUN ONE NEARMARK VERIFIED INFERENCE: '
  );

  rl.close();

  if (answer.trim() !== 'RUN ONE NEARMARK VERIFIED INFERENCE') {
    saveReport('INFERENCE_NOT_AUTHORIZED');
    console.log('Cancelled. No inference was sent.');
    return;
  }

  stage = 'inference';

  console.log('\n2. Sending one encrypted inference...');

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [{
      role: 'user',
      content: 'Reply exactly: NEARMARK security verification successful.'
    }],
    temperature: 0,
    max_tokens: 24
  });

  completionId = completion.id;

  if (!completionId) {
    throw new Error('No completion ID returned.');
  }

  console.log('PASS: Inference completed.');
  console.log('Completion ID:', completionId);

  stage = 'response_signature_verification';

  console.log('\n3. Verifying exact response signature...');

  const receipt = await client.verifyResponse(completionId);

  console.log('Response signature:', receipt.signatureKind);

  if (receipt.signatureKind !== 'provider_tee') {
    throw new Error(
      'Required provider_tee signature was not returned.'
    );
  }

  stage = 'completed';

  saveReport('FULL_VERIFICATION_PASSED', {
    signatureKind: receipt.signatureKind,
    gatewayTCB: preflight.gateway.tcbStatus,
    tlsBinding: preflight.gateway.tlsBinding.kind,
    modelReports: preflight.models.map(item => ({
      tcbStatus: item.tcbStatus,
      gpuEvidence: item.gpuEvidence,
      signer: item.signer.signingAlgo
    }))
  });

  console.log('\n======================================');
  console.log(' NEARMARK VERIFIED INFERENCE PASSED');
  console.log('======================================');
  console.log('Gateway: PASS');
  console.log('Model TEE: PASS');
  console.log('Intel TDX: PASS');
  console.log('NVIDIA: PASS');
  console.log('Response signature: provider_tee');
  console.log('Evidence: artifacts/nearmark-final-inference.json');
}

main().catch(error => {
  console.error('\nBLOCKED AT:', stage);
  console.error('Reason:', error.message);
  console.error('Code:', error.code || error.failure?.code || 'Unknown');

  saveReport('BLOCKED', {
    error: error.message,
    errorCode: error.code || error.failure?.code || 'unknown'
  });

  process.exitCode = 1;
});
