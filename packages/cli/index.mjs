#!/usr/bin/env node
const args = process.argv.slice(2);
const command = args[0];
const baseUrl = process.env.NEARMARK_API_URL || 'http://localhost:8787';
const json = args.includes('--json');

async function request(path, method='GET', body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
function print(data) { console.log(json ? JSON.stringify(data, null, 2) : data); }

try {
  if (command === 'inspect') {
    if (!args[1]) throw new Error('Usage: node packages/cli/index.mjs inspect <account.near> [agent-public-key]');
    const data = await request('/api/inspect', 'POST', { accountId: args[1], agentPublicKey: args[2] });
    if (json) print(data); else {
      console.log(`\nNEARMARK / AUTHORITY X-RAY\n${data.accountId} · ${data.network} · block ${data.blockHeight}`);
      console.log(`Code: ${data.hasContract ? 'contract' : 'no contract'} · keys: ${data.keys.length}`);
      console.log(`Exposure: ${data.keyAssessment.exposure} · ${data.keyAssessment.summary}`);
      for (const key of data.keys) console.log(`- ${key.kind}: ${key.publicKey} ${key.receiverId ? `→ ${key.receiverId} (${key.methodNames?.join(',') || 'all methods'})` : ''}`);
      console.log(`History: ${data.history.available ? `${data.history.sampled} indexed rows` : 'unavailable'}`);
    }
  } else if (command === 'check') {
    if (!args[1] || !args[2]) throw new Error('Usage: node packages/cli/index.mjs check <receiver.near> <amount> [allowed-recipient.near]');
    const data = await request('/api/counterparty/check', 'POST', { receiver: args[1], amount: args[2], allowedRecipients: args[3] ? [args[3]] : [], strictRecipients: !!args[3], maxAmount: args[4] || '10' });
    print(data);
    if (data.decision === 'BLOCK') process.exitCode = 2;
  } else if (command === 'benchmark') {
    const data = await request('/api/benchmark/run', 'POST', { profile: args[1] || 'nearmark-guard' });
    print(data);
    if (data.summary.failed) process.exitCode = 2;
  } else if (command === 'health') {
    print(await request('/api/health'));
  } else {
    console.log('Nearmark CLI\n\nCommands:\n  health\n  inspect <account.near> [agent-public-key]\n  check <receiver.near> <amount> [allowed-recipient.near] [max-amount]\n  benchmark [nearmark-guard|function-call-baseline|full-access-baseline]\n\nSet NEARMARK_API_URL to use a remote API.');
  }
} catch (error) {
  console.error(`Nearmark: ${error.message}`);
  process.exitCode = 1;
}
