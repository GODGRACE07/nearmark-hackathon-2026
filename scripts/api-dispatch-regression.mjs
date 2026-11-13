import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address.port;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

const suppliedBase = process.argv[2];
let child = null;
let childOutput = '';
let base = suppliedBase;

async function pause(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function getJson(route) {
  const response = await fetch(`${base}${route}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(7000)
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${route}: expected JSON, received HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  if (!response.ok) {
    throw new Error(`${route}: HTTP ${response.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
}

async function stopChild() {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    pause(2500)
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

try {
  if (!base) {
    const port = await reservePort();
    base = `http://127.0.0.1:${port}`;
    child = spawn(
      process.execPath,
      ['--env-file-if-exists=.env', 'server/index.mjs'],
      {
        cwd: ROOT,
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );
    child.stdout.on('data', chunk => { childOutput += chunk.toString(); });
    child.stderr.on('data', chunk => { childOutput += chunk.toString(); });

    let ready = false;
    for (let attempt = 1; attempt <= 40; attempt++) {
      if (child.exitCode !== null) {
        throw new Error(`API server exited during startup.\n${childOutput}`);
      }
      try {
        const response = await fetch(`${base}/api/phase2/status`, {
          signal: AbortSignal.timeout(2500)
        });
        if (response.ok) {
          await response.arrayBuffer();
          ready = true;
          break;
        }
      } catch {}
      await pause(250);
    }
    if (!ready) throw new Error(`API server did not become ready.\n${childOutput}`);
  }

  console.log('[NEARMARK] Testing Phase 2 and OpenAPI sequentially:', base);

  const phase2a = await getJson('/api/phase2/status');
  for (const key of ['nearAi', 'outLayer', 'gateFt', 'production']) {
    if (!(key in phase2a)) throw new Error(`Phase 2 status missing expected property: ${key}`);
  }
  console.log('PASS: GET /api/phase2/status returns the expected JSON envelope.');

  const openapi = await getJson('/api/docs/openapi.json');
  if (openapi.openapi !== '3.1.0' || !openapi.paths?.['/api/inspect'] || !openapi.paths?.['/api/counterparty/check']) {
    throw new Error('OpenAPI document is missing its version or required API paths.');
  }
  console.log('PASS: GET /api/docs/openapi.json returns valid OpenAPI 3.1 JSON.');

  const integrations = await getJson('/api/integrations');
  if (!integrations.near || !integrations.nearAi || !integrations.outlayer) {
    throw new Error('Integration status response is incomplete.');
  }
  console.log('PASS: GET /api/integrations returns the expected integrations.');

  const phase2b = await getJson('/api/phase2/status');
  if (!phase2b.gateFt || !phase2b.production) {
    throw new Error('Second Phase 2 request failed after OpenAPI request.');
  }
  console.log('PASS: API remains responsive after all sequential requests.');

  if (child && child.exitCode !== null) {
    throw new Error(`API server terminated unexpectedly.\n${childOutput}`);
  }

  console.log('[NEARMARK] PASS: API response-dispatch regression cleared.');
} catch (error) {
  console.error('[NEARMARK] FAIL:', error.message);
  if (childOutput) console.error('\n--- API SERVER OUTPUT ---\n' + childOutput);
  process.exitCode = 1;
} finally {
  await stopChild();
}
