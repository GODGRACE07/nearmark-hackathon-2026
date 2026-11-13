#!/usr/bin/env node
/** Minimal MCP stdio server exposing safe, read-only / local Nearmark tools. */
import readline from 'node:readline';
const baseUrl = process.env.NEARMARK_API_URL || 'http://localhost:8787';
const protocolVersion = '2024-11-05';

async function callApi(path, method='GET', body) {
  const response = await fetch(`${baseUrl}${path}`, { method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Nearmark API returned ${response.status}`);
  return data;
}
const tools = [
  { name:'nearmark_inspect_account', description:'Read public NEAR account state and registered access-key permissions. Does not identify private-key holders or sign transactions.', inputSchema:{type:'object',properties:{accountId:{type:'string'},agentPublicKey:{type:'string'}},required:['accountId']} },
  { name:'nearmark_authority_shadow', description:'Trace confirmed direct key scope into code-hash-matched NEARMARK Gate downstream effects; unsupported contracts remain UNKNOWN.', inputSchema:{type:'object',properties:{accountId:{type:'string'},agentPublicKey:{type:'string'}},required:['accountId']} },
  { name:'nearmark_near_ai_red_analysis', description:'Generate defensive test hypotheses using NEAR AI RED; no attack is executed.', inputSchema:{type:'object',properties:{prompt:{type:'string'},sourceCode:{type:'string'}},required:['prompt']} },
  { name:'nearmark_agent_market_services', description:'Browse NEAR Agent Market services (read-only).', inputSchema:{type:'object',properties:{category:{type:'string'}}} },
  { name:'nearmark_near_intents_tokens', description:'List NEAR Intents supported token metadata (read-only, mainnet).', inputSchema:{type:'object',properties:{}} },
  { name:'nearmark_check_counterparty', description:'Evaluate a proposed receiver against a supplied owner mandate and live public NEAR account state. Advisory only; caller must enforce the decision.', inputSchema:{type:'object',properties:{agentAccount:{type:'string'},receiver:{type:'string'},amount:{type:'string'},method:{type:'string'},allowedRecipients:{type:'array',items:{type:'string'}},maxAmount:{type:'string'},strictRecipients:{type:'boolean'}},required:['receiver','amount']} },
  { name:'nearmark_run_benchmark', description:'Run the deterministic local Nearmark security harness; does not broadcast mainnet transactions or prove general wallet safety.', inputSchema:{type:'object',properties:{profile:{type:'string',enum:['full-access-baseline','function-call-baseline','nearmark-guard']} }} },
];

async function dispatch(message) {
  const { id, method, params = {} } = message;
  if (method === 'initialize') return { jsonrpc:'2.0', id, result:{ protocolVersion: params.protocolVersion || protocolVersion, capabilities:{tools:{}}, serverInfo:{name:'nearmark-mcp',version:'0.1.0'} } };
  if (method === 'notifications/initialized') return null;
  if (method === 'ping') return { jsonrpc:'2.0', id, result:{} };
  if (method === 'tools/list') return { jsonrpc:'2.0', id, result:{tools} };
  if (method === 'tools/call') {
    const name = params.name;
    const args = params.arguments || {};
    let result;
    if (name === 'nearmark_inspect_account') result = await callApi('/api/inspect','POST',args);
    else if (name === 'nearmark_authority_shadow') result = await callApi('/api/authority-shadow','POST',args);
    else if (name === 'nearmark_near_ai_red_analysis') result = await callApi('/api/near-ai/red/analyze','POST',args);
    else if (name === 'nearmark_agent_market_services') result = await callApi(`/api/agent-market/services?category=${encodeURIComponent(args.category || 'security')}`);
    else if (name === 'nearmark_near_intents_tokens') result = await callApi('/api/intents/tokens');
    else if (name === 'nearmark_check_counterparty') result = await callApi('/api/counterparty/check','POST',args);
    else if (name === 'nearmark_run_benchmark') result = await callApi('/api/benchmark/run','POST',args);
    else throw new Error(`Unknown Nearmark tool: ${name}`);
    return { jsonrpc:'2.0', id, result:{ content:[{type:'text',text:JSON.stringify(result,null,2)}], structuredContent:result, isError:false } };
  }
  if (id !== undefined) return { jsonrpc:'2.0', id, error:{code:-32601,message:`Method not found: ${method}`} };
  return null;
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  let message;
  try {
    message = JSON.parse(line);
    const response = await dispatch(message);
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
  } catch (error) {
    const response = { jsonrpc:'2.0', id:message?.id ?? null, error:{code:-32000,message:error.message || 'Nearmark MCP error'} };
    process.stdout.write(`${JSON.stringify(response)}\n`);
  }
}
