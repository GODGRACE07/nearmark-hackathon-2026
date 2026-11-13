import fs from 'node:fs';
import path from 'node:path';

const base = (process.argv[2] || 'http://127.0.0.1:18787').replace(/\/$/, '');
const artifactDir = path.resolve(process.argv[3] || 'artifacts');
fs.mkdirSync(artifactDir, { recursive: true });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getJson(route, label, validate) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const response = await fetch(`${base}${route}`, {
        method: 'GET',
        headers: { accept: 'application/json', 'cache-control': 'no-cache' },
        signal: AbortSignal.timeout(12000),
      });
      const raw = await response.text();
      if (!response.ok) {
        throw new Error(`${label}: HTTP ${response.status}: ${raw.slice(0, 500)}`);
      }
      let data;
      try { data = JSON.parse(raw); }
      catch { throw new Error(`${label}: response was not valid JSON: ${raw.slice(0, 300)}`); }
      if (validate && !validate(data)) {
        throw new Error(`${label}: JSON response did not satisfy its schema check.`);
      }
      console.log(`PASS: ${label} (HTTP ${response.status}, attempt ${attempt}).`);
      return data;
    } catch (error) {
      lastError = error;
      console.error(`RETRY ${attempt}/5: ${label}: ${error.message}`);
      if (attempt < 5) await sleep(attempt * 400);
    }
  }
  throw new Error(`${label} failed after 5 attempts: ${lastError?.message || 'unknown error'}`);
}

function writeAtomic(filename, value) {
  const target = path.join(artifactDir, filename);
  const temporary = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temporary, target);
  console.log(`WROTE: ${target}`);
}

const phase2 = await getJson(
  '/api/phase2/status',
  'Phase 2 status endpoint',
  value => value && typeof value === 'object' && value.nearAi && value.outLayer && value.production
);
writeAtomic('phase2-status.json', phase2);

const openapi = await getJson(
  '/api/docs/openapi.json',
  'OpenAPI endpoint',
  value => value && value.openapi === '3.1.0' && value.info?.title === 'Nearmark API' && value.paths?.['/api/inspect'] && value.paths?.['/api/counterparty/check'] && value.paths?.['/api/benchmark/run']
);
writeAtomic('openapi.json', openapi);

const health = await getJson(
  '/api/health',
  'API health after documentation request',
  value => value?.ok === true && value?.service === 'nearmark-api'
);

console.log(`PASS: API remained healthy after OpenAPI request (network: ${health.network}).`);
console.log('PASS: Phase 2 and OpenAPI artifacts validated and stored.');
