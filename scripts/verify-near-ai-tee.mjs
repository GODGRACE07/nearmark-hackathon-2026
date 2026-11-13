import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  AttestationClient,
  createPinnedTlsFetch,
  prepareE2eeChatRequest,
  verifyGatewayAttestation,
  verifyModelAttestation,
  verifyModelResponse,
  verifyGatewayResponse,
  findModelAttestationsForSignature,
} from '@nearai/inference-sdk/node';

try { process.loadEnvFile('.env'); } catch (error) {
  console.error('Cannot load .env:', error.message);
  process.exit(1);
}

const BASE_URL = (process.env.NEAR_AI_BASE_URL || 'https://cloud-api.near.ai/v1/').replace(/\/?$/, '/');
const API_KEY = process.env.NEAR_AI_API_KEY?.trim();
const MODEL = 'deepseek-ai/DeepSeek-V4.1-Flash-1017';
const SIGNING_ALGO = 'ed25519';
const ARTIFACT = 'artifacts/near-ai-tee-verification.json';
const LOG_DIR = 'verification-logs/near-ai-e2e';
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
let stage = 'configuration';

const evidence = {
  schemaVersion: 1,
  product: 'NEARMARK',
  runId,
  createdAt: new Date().toISOString(),
  model: MODEL,
  signingAlgorithm: SIGNING_ALGO,
  status: 'running',
  verified: false,
  gateway: null,
  modelAttestations: [],
  inference: { attempted: false, signatureVerified: false, signatureKind: null },
  limitations: [
    'This run verifies Gateway and model deployment evidence, plus the exact inference response signature.',
    'A provider_tee response signature is required before NEARMARK claims model-execution TEE proof.',
    'Model-report retrieval is unauthenticated only for the provider=near report request; all other authenticated Cloud API calls retain the configured bearer credential.'
  ],
  errors: []
};

function errText(error) {
  const items = [];
  let current = error;
  for (let i = 0; current && i < 7; i++, current = current.cause) {
    items.push({
      name: current.name || 'Error',
      code: current.code || current.failure?.code || null,
      message: current.message || String(current)
    });
  }
  return items;
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function isTransient(error) {
  const text = errText(error).map(x => `${x.code || ''} ${x.message}`).join(' ').toLowerCase();
  return /collateral_unavailable|fetch failed|headers.?timeout|timeout|econnreset|eai_again|429| 503| 502| 504/.test(text);
}

async function retryTransient(label, fn, tries = 3) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try { return await fn(); }
    catch (error) {
      if (attempt === tries || !isTransient(error)) throw error;
      console.warn(`[retry] ${label}: transient failure ${attempt}/${tries}; retrying without weakening verification.`);
      await delay(1500 * attempt);
    }
  }
  throw new Error(`${label} failed after retries`);
}

async function persist() {
  await mkdir('artifacts', { recursive: true });
  await mkdir(LOG_DIR, { recursive: true });
  const json = JSON.stringify(evidence, null, 2) + '\n';
  await writeFile(ARTIFACT, json, { mode: 0o600 });
  await writeFile(`${LOG_DIR}/${runId}.json`, json, { mode: 0o600 });
}

async function stopWithError(error) {
  evidence.status = 'blocked';
  evidence.verified = false;
  evidence.errors.push({ stage, chain: errText(error) });
  await persist();
  console.error(`\nBLOCKED at stage: ${stage}`);
  for (const item of errText(error)) {
    console.error(`${item.code || item.name}: ${item.message}`);
  }
  console.error(`Evidence report: ${ARTIFACT}`);
  console.error('NEARMARK remains fail-closed. No failed check was converted into PASS.');
  process.exitCode = 1;
}

// The stock Node InferenceClient constructs its own private CloudApiClient and
// always authenticates model reports. It cannot be fixed by subclassing
// InferenceClient. This AttestationClient subclass changes only the public
// provider=near report request, while preserving TLS pinning and all SDK
// decoding, nonce binding, TDX and NVIDIA cryptographic verification.
class NearmarkPinnedAttestationClient extends AttestationClient {
  async requestCloudApi(request) {
    const url = new URL(request.url);
    if (url.pathname.endsWith('/attestation/report') && url.searchParams.get('provider') === 'near') {
      const headers = new Headers(request.headers);
      headers.delete('authorization');
      headers.delete('api-key');
      headers.delete('x-api-key');
      const publicReportRequest = new Request(request, { headers });
      return super.requestCloudApi(publicReportRequest);
    }
    // Metadata and completion-signature requests keep the configured API key.
    return super.requestCloudApi(request);
  }
}

async function main() {
  if (!API_KEY) throw new Error('NEAR_AI_API_KEY is missing from .env.');
  if (process.versions.node !== '24.22.1') {
    throw new Error(`Required Node.js 24.22.1; active runtime is ${process.version}.`);
  }

  console.log('NEARMARK controlled NEAR AI release verification');
  console.log('Node:', process.version);
  const sdkPackage = JSON.parse(await readFile('node_modules/@nearai/inference-sdk/package.json', 'utf8'));
  console.log('SDK:', sdkPackage.version);
  console.log('Model:', MODEL);
  console.log('Signing algorithm:', SIGNING_ALGO);
  console.log('API key: configured (hidden)');

  stage = 'gateway-attestation';
  console.log('\n[1/6] Fetching and cryptographically verifying Gateway TEE...');
  const gatewayClient = new AttestationClient({ apiKey: API_KEY, baseUrl: BASE_URL });
  const fetchedGateway = await retryTransient('Gateway attestation', () =>
    gatewayClient.fetchGatewayAttestation({ signingAlgo: SIGNING_ALGO, includeSpkiFingerprint: true })
  );
  const gateway = await retryTransient('Gateway Intel TDX verification', () =>
    verifyGatewayAttestation({
      attestation: fetchedGateway.attestation,
      clientBinding: fetchedGateway.clientBinding
    })
  );
  if (gateway.tlsBinding.kind !== 'attested') {
    throw new Error('Gateway TLS binding is not attested; refusing inference.');
  }
  if (gateway.tcbStatus !== 'UpToDate') {
    throw new Error(`Gateway TDX TCB status is ${gateway.tcbStatus}, expected UpToDate.`);
  }
  evidence.gateway = {
    verified: true,
    tcbStatus: gateway.tcbStatus,
    tlsBinding: gateway.tlsBinding.kind,
    signerAlgorithm: gateway.signer.signingAlgo,
    signerAddressSha256: createHash('sha256').update(gateway.signer.signingAddress).digest('hex')
  };
  console.log('PASS: Gateway quote, signer and TLS SPKI binding verified.');
  console.log('Gateway TCB:', gateway.tcbStatus);

  stage = 'pinned-model-metadata';
  console.log('\n[2/6] Creating Gateway-SPKI-pinned evidence transport...');
  const pinnedFetch = createPinnedTlsFetch(gateway.tlsBinding.spkiFingerprint);
  const attestationClient = new NearmarkPinnedAttestationClient({
    apiKey: API_KEY,
    baseUrl: BASE_URL,
    fetch: pinnedFetch
  });
  const metadata = await retryTransient('Model metadata', () =>
    attestationClient.fetchModelMetadata(MODEL)
  );
  if (metadata.providerType !== 'vllm' || metadata.attestationSupported !== true) {
    throw new Error(`Model metadata does not advertise required NEAR attestation support (providerType=${metadata.providerType}, attestationSupported=${metadata.attestationSupported}).`);
  }
  console.log('PASS: Model metadata advertises vLLM attestation support.');

  stage = 'model-attestation';
  console.log('\n[3/6] Retrieving fresh public NEAR model report and verifying all reports...');
  const fetchedModels = await retryTransient('Model attestation report', () =>
    attestationClient.fetchModelAttestations({ model: MODEL, signingAlgo: SIGNING_ALGO })
  );
  if (!fetchedModels.attestations.length) {
    throw new Error('No model-attestation reports were returned.');
  }
  const verifiedModels = [];
  for (const [index, report] of fetchedModels.attestations.entries()) {
    const verified = await retryTransient(`Model ${index + 1} Intel/NVIDIA verification`, () =>
      verifyModelAttestation({
        attestation: report,
        clientBinding: fetchedModels.clientBinding,
        policy: { gpuEvidence: 'required' }
      })
    );
    if (verified.tcbStatus !== 'UpToDate') {
      throw new Error(`Model report ${index + 1} TCB status is ${verified.tcbStatus}, expected UpToDate.`);
    }
    if (verified.gpuEvidence !== 'verified') {
      throw new Error(`Model report ${index + 1} NVIDIA GPU evidence is ${verified.gpuEvidence}, expected verified.`);
    }
    verifiedModels.push(verified);
    evidence.modelAttestations.push({
      verified: true,
      tcbStatus: verified.tcbStatus,
      gpuEvidence: verified.gpuEvidence,
      signerAlgorithm: verified.signer.signingAlgo,
      signerAddressSha256: createHash('sha256').update(verified.signer.signingAddress).digest('hex'),
      signingPublicKeyPresent: Boolean(verified.signingPublicKey),
      deploymentProvenance: verified.deploymentProvenance
    });
  }
  const selectedModel = verifiedModels.find(item =>
    item.signer.signingAlgo === SIGNING_ALGO && typeof item.signingPublicKey === 'string' && item.signingPublicKey.length > 0
  );
  if (!selectedModel) {
    throw new Error(`No verified ${SIGNING_ALGO} model signing key is available.`);
  }
  console.log(`PASS: ${verifiedModels.length}/${fetchedModels.attestations.length} model report(s); Intel TDX UpToDate; NVIDIA evidence verified.`);
  await persist();

  stage = 'billable-inference-approval';
  console.log('\n[4/6] Cryptographic preflight is complete.');
  console.log('The next step sends exactly ONE small inference request. Provider usage may be billable.');
  const rl = createInterface({ input, output });
  let approval = '';
  try {
    approval = await rl.question('Type exactly RUN ONE NEARMARK VERIFIED INFERENCE to proceed: ');
  } finally {
    rl.close();
  }
  if (approval.trim() !== 'RUN ONE NEARMARK VERIFIED INFERENCE') {
    evidence.status = 'preflight_verified_inference_not_authorized';
    evidence.verified = true;
    evidence.inference = { attempted: false, signatureVerified: false, signatureKind: null };
    await persist();
    console.log('Inference not sent. Verified preflight evidence saved.');
    return;
  }

  stage = 'inference';
  console.log('\n[5/6] Sending one encrypted inference through the verified, TLS-pinned Gateway...');
  const chatUrl = new URL('chat/completions', BASE_URL);
  const originalRequest = new Request(chatUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'identity',
      'x-no-aliasing': 'true'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: 'Reply with exactly: NEARMARK_VERIFIED_OK' }],
      max_tokens: 24,
      temperature: 0,
      stream: false
    })
  });
  const prepared = await prepareE2eeChatRequest({
    request: originalRequest,
    modelKey: {
      signingAlgo: selectedModel.signer.signingAlgo,
      publicKey: selectedModel.signingPublicKey
    }
  });
  const requestBody = new Uint8Array(await prepared.request.clone().arrayBuffer());
  evidence.inference = { attempted: true, signatureVerified: false, signatureKind: null };
  const encryptedResponse = await pinnedFetch(prepared.request);
  if (!encryptedResponse.ok) {
    const message = (await encryptedResponse.clone().text()).slice(0, 1200);
    throw new Error(`Inference endpoint returned HTTP ${encryptedResponse.status}: ${message}`);
  }
  const wireResponse = encryptedResponse.clone();
  const plaintextResponse = await prepared.decryptResponse(encryptedResponse);
  const [responseBytesBuffer, plaintext] = await Promise.all([
    wireResponse.arrayBuffer(),
    plaintextResponse.text()
  ]);
  const responseBody = new Uint8Array(responseBytesBuffer);
  let completion;
  try { completion = JSON.parse(plaintext); }
  catch { throw new Error('Inference response was not valid JSON after E2EE decryption.'); }
  if (typeof completion.id !== 'string' || !completion.id) {
    throw new Error('Inference response did not include a completion ID.');
  }
  evidence.inference.completionId = completion.id;
  evidence.inference.responseText = completion.choices?.[0]?.message?.content ?? null;
  evidence.inference.requestBytesSha256 = createHash('sha256').update(requestBody).digest('hex');
  evidence.inference.responseBytesSha256 = createHash('sha256').update(responseBody).digest('hex');

  stage = 'response-signature';
  console.log('\n[6/6] Fetching and verifying the exact response signature...');
  const signature = await retryTransient('Completion signature lookup', () =>
    attestationClient.fetchCompletionSignature({ completionId: completion.id, signingAlgo: SIGNING_ALGO })
  , 4);
  evidence.inference.signatureKind = signature.kind;
  if (signature.kind === 'provider_tee') {
    verifyModelResponse({
      requestBody,
      responseBody,
      signature,
      attestation: selectedModel
    });
    const matching = findModelAttestationsForSignature({
      attestations: verifiedModels,
      signature
    });
    evidence.inference.matchingVerifiedModelReports = matching.length;
    evidence.inference.signatureVerified = true;
    evidence.inference.signerAlgorithm = signature.signer.signingAlgo;
    if (matching.length < 1) {
      throw new Error('Provider TEE signature did not match a verified model report.');
    }
  } else if (signature.kind === 'gateway') {
    verifyGatewayResponse({
      requestBody,
      responseBody,
      signature,
      attestation: gateway
    });
    evidence.inference.gatewaySignatureVerified = true;
    throw new Error('Gateway response signature verified, but provider_tee was required to prove model TEE execution. NEARMARK will not claim model-level execution proof.');
  } else {
    throw new Error(`Unsupported response signature kind: ${signature.kind}`);
  }

  evidence.status = 'verified';
  evidence.verified = true;
  evidence.completedAt = new Date().toISOString();
  await persist();
  console.log('\n==============================================');
  console.log('NEARMARK NEAR AI END-TO-END VERIFICATION: PASS');
  console.log('Gateway TEE: VERIFIED');
  console.log('Gateway TLS binding: ATTESTED');
  console.log('Model Intel TDX: VERIFIED');
  console.log('Model NVIDIA GPU evidence: VERIFIED');
  console.log('Inference response: provider_tee signature VERIFIED');
  console.log('Model:', MODEL);
  console.log('Response:', evidence.inference.responseText);
  console.log('Evidence:', ARTIFACT);
  console.log('==============================================');
}

main().catch(async error => {
  await stopWithError(error);
});
