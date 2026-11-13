import { setTimeout as sleep } from 'node:timers/promises';

process.loadEnvFile('.env');

const JWKS_URL =
  process.env.NEAR_AI_NVIDIA_JWKS_URL ||
  'https://nras.attestation.nvidia.com/.well-known/jwks.json';

const originalFetch = globalThis.fetch.bind(globalThis);

function isNvidiaJwks(input) {
  try {
    const u = new URL(
      input instanceof Request ? input.url : String(input)
    );

    return (
      u.hostname === 'nras.attestation.nvidia.com' &&
      u.pathname === '/.well-known/jwks.json'
    );
  } catch {
    return false;
  }
}

async function fetchCompleteJwks(input, init = {}) {
  let lastError;

  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const headers = new Headers(
        input instanceof Request ? input.headers : undefined
      );

      if (init.headers) {
        new Headers(init.headers).forEach((v, k) => {
          headers.set(k, v);
        });
      }

      headers.set('Accept', 'application/json');
      headers.set('Accept-Encoding', 'identity');

      console.log(
        `[NVIDIA JWKS] Download attempt ${attempt}/6`
      );

      const response = await originalFetch(JWKS_URL, {
        ...init,
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(120000)
      });

      if (response.status === 429 || response.status >= 500) {
        throw new Error(
          `NVIDIA temporarily returned HTTP ${response.status}`
        );
      }

      if (!response.ok) {
        return response;
      }

      // Read the complete body before allowing the SDK to parse it.
      const bytes = new Uint8Array(
        await response.arrayBuffer()
      );

      const declaredLength = response.headers.get('content-length');

      if (
        declaredLength &&
        Number(declaredLength) !== bytes.byteLength
      ) {
        throw new Error(
          `Incomplete download: expected ${declaredLength} bytes, received ${bytes.byteLength}`
        );
      }

      const text = new TextDecoder('utf-8', {
        fatal: true
      }).decode(bytes);

      const jwks = JSON.parse(text);

      if (
        !jwks ||
        !Array.isArray(jwks.keys) ||
        jwks.keys.length === 0
      ) {
        throw new Error(
          'NVIDIA response contains no valid JWKS keys.'
        );
      }

      if (!jwks.keys.every(
        k => k && typeof k.kty === 'string'
      )) {
        throw new Error('NVIDIA JWKS contains malformed key entries.');
      }

      console.log(
        `[NVIDIA JWKS] PASS: Complete response (${bytes.byteLength} bytes).`
      );

      console.log(
        `[NVIDIA JWKS] PASS: ${jwks.keys.length} public key entries.`
      );

      // Give the official SDK a fully validated response.
      return new Response(bytes, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });

    } catch (error) {
      lastError = error;

      console.error(
        `[NVIDIA JWKS] Attempt ${attempt} failed: ${error.message}`
      );

      if (attempt < 6) {
        await sleep(attempt * 2000);
      }
    }
  }

  throw new Error(
    'NVIDIA JWKS could not be downloaded completely after six attempts.',
    { cause: lastError }
  );
}

// Intercept only NVIDIA's official signing-key URL.
// All other requests retain the standard Node.js fetch behavior.
globalThis.fetch = async (input, init) => {
  if (isNvidiaJwks(input)) {
    return fetchCompleteJwks(input, init);
  }

  return originalFetch(input, init);
};

console.log('NEARMARK resilient attestation transport enabled.');
console.log('NVIDIA signing keys:', JWKS_URL);

// Load the official verification implementation only after
// the resilient transport has been installed.
await import('./verify-near-ai-tee.mjs');
