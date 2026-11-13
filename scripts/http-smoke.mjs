const base = process.argv[2] || 'http://127.0.0.1:18787';
const accountId = process.argv[3] || 'tony-nearmark-owner.testnet';
const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(12_000) });
if (!response.ok) throw new Error(`API health returned HTTP ${response.status}`);
const health = await response.json();
if (!health.ok || health.service !== 'nearmark-api') throw new Error('API health payload is invalid.');
if (health.integrations?.nearRpc !== 'connected') throw new Error(`NEAR RPC is not connected: ${health.integrations?.nearRpc ?? 'unknown'}`);
console.log(`PASS: API health (${health.network}; NEAR RPC connected).`);

const inspectResponse = await fetch(`${base}/api/inspect`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ accountId }), signal: AbortSignal.timeout(20_000),
});
if (!inspectResponse.ok) {
  const detail = await inspectResponse.text();
  throw new Error(`Live account inspection returned HTTP ${inspectResponse.status}: ${detail.slice(0, 1200)}`);
}
const inspection = await inspectResponse.json();
if (inspection.accountId !== accountId || !Array.isArray(inspection.keys) || !inspection.blockHeight) {
  throw new Error('Live NEAR account inspection did not return the expected public state.');
}
console.log(`PASS: Live finalized NEAR inspection (${accountId}; block ${inspection.blockHeight}; ${inspection.keys.length} keys).`);

const benchmarkResponse = await fetch(`${base}/api/benchmark/run`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ profile: 'nearmark-guard' }),
  signal: AbortSignal.timeout(12_000),
});
if (!benchmarkResponse.ok) throw new Error(`Benchmark API returned HTTP ${benchmarkResponse.status}`);
const benchmark = await benchmarkResponse.json();
if (benchmark.mode !== 'local-deterministic-harness' || !benchmark.summary?.total) {
  throw new Error('Benchmark API did not return a deterministic local run.');
}
console.log(`PASS: Benchmark API (${benchmark.summary.passed}/${benchmark.summary.total} assertions).`);
console.log('Note: this HTTP smoke test does not imply TEE verification or live Testnet payments.');
