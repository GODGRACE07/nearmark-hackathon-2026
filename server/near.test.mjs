import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { nearRpc } from './near.mjs';

function startServer(handler) {
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    handler(body, res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    resolve({ server, url: `http://127.0.0.1:${port}` });
  }));
}

test('NEAR RPC retries a configured fallback after primary HTTP failure', async t => {
  const primary = await startServer((_body, res) => {
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'maintenance' }));
  });
  const fallback = await startServer((_body, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', id: 'ok', result: { block_height: 123, amount: '1' } }));
  });
  t.after(() => { primary.server.close(); fallback.server.close(); });

  const result = await nearRpc('query', { request_type: 'view_account' }, {
    NEAR_NETWORK: 'testnet',
    NEAR_RPC_URL: primary.url,
    NEAR_RPC_FALLBACK_URL: fallback.url,
  });
  assert.equal(result.block_height, 123);
});

test('NEAR RPC reports every endpoint failure clearly', async t => {
  const primary = await startServer((_body, res) => {
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end('{}');
  });
  const fallback = await startServer((_body, res) => {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end('{}');
  });
  t.after(() => { primary.server.close(); fallback.server.close(); });

  await assert.rejects(
    nearRpc('query', {}, { NEAR_RPC_URL: primary.url, NEAR_RPC_FALLBACK_URL: fallback.url }),
    /All NEAR RPC endpoints failed for query/,
  );
});
