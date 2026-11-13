const YOCTO = 10n ** 24n;
const NO_CONTRACT_HASH = '11111111111111111111111111111111';
const ACCOUNT_RE = /^(?:[a-z0-9]+(?:[-_.][a-z0-9]+)*)$|^[0-9a-f]{64}$/;

export function validateAccountId(value) {
  return typeof value === 'string' && value.length >= 2 && value.length <= 64 && ACCOUNT_RE.test(value);
}

async function postJson(url, body, timeoutMs = 12000, extraHeaders = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...extraHeaders },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch { throw new Error(`Upstream returned invalid JSON (${response.status})`); }
    if (!response.ok) throw new Error(json?.error?.message || `Upstream HTTP ${response.status}`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

function rpcCandidates(env) {
  const network = String(env.NEAR_NETWORK || 'testnet').toLowerCase();
  const defaults = network === 'mainnet'
    ? ['https://rpc.mainnet.near.org', 'https://rpc.mainnet.fastnear.com']
    : ['https://rpc.testnet.near.org', 'https://rpc.testnet.fastnear.com'];
  return [...new Set([
    env.NEAR_RPC_URL,
    env.NEAR_RPC_FALLBACK_URL,
    ...defaults,
  ].map(value => String(value || '').trim().replace(/\/$/, '')).filter(Boolean))];
}

export async function nearRpc(method, params, env = process.env) {
  const payload = { jsonrpc: '2.0', id: `nearmark-${Date.now()}`, method, params };
  const failures = [];

  // Public RPCs occasionally differ in availability/capabilities. Try the configured
  // primary first, then an explicitly configured fallback, then the official/FastNear
  // network endpoints. Read operations only; this function never submits transactions.
  for (const url of rpcCandidates(env)) {
    try {
      const response = await postJson(url, payload);
      if (response.error) {
        const message = response.error.message || response.error.data || 'NEAR RPC error';
        const error = new Error(typeof message === 'string' ? message : JSON.stringify(message));
        error.code = response.error.name || response.error.cause?.name || 'RPC_ERROR';
        throw error;
      }
      if (response.result === undefined || response.result === null) {
        throw new Error('NEAR RPC did not return a result');
      }
      return response.result;
    } catch (error) {
      failures.push(`${new URL(url).host}: ${error?.code || 'RPC_ERROR'} ${String(error?.message || error).slice(0, 180)}`);
    }
  }

  const error = new Error(`All NEAR RPC endpoints failed for ${method}: ${failures.join(' | ')}`);
  error.code = 'ALL_RPC_ENDPOINTS_FAILED';
  throw error;
}

export async function getFastNearHistory(accountId, env = process.env, options = {}) {
  const endpoint = env.FASTNEAR_TX_API || 'https://tx.test.fastnear.com/v0/account';
  try {
    const result = await postJson(endpoint, {
      account_id: accountId,
      limit: Math.min(Math.max(options.limit || 40, 1), 200),
      desc: options.desc === false ? false : true,
      ...(options.isReceiver ? { is_real_receiver: true } : {}),
      ...(options.isSigner ? { is_real_signer: true } : {}),
    }, 14000, env.FASTNEAR_API_KEY ? { authorization: `Bearer ${env.FASTNEAR_API_KEY}` } : {});
    const rows = Array.isArray(result.account_txs) ? result.account_txs : [];
    return {
      available: true,
      txCountOnFirstPage: Number.isFinite(result.txs_count) ? result.txs_count : null,
      rows,
      resumeToken: result.resume_token || null,
      sampled: rows.length,
      latestBlock: rows.reduce((max, row) => Math.max(max, Number(row.tx_block_height || 0)), 0) || null,
      source: 'FastNear Transactions API',
    };
  } catch (error) {
    return { available: false, rows: [], sampled: 0, source: 'FastNear Transactions API', error: error.message };
  }
}

function yoctoToNear(value) {
  if (value == null) return null;
  try {
    const n = BigInt(value);
    const whole = n / YOCTO;
    const fraction = (n % YOCTO).toString().padStart(24, '0').slice(0, 6).replace(/0+$/, '');
    return `${whole}${fraction ? `.${fraction}` : ''}`;
  } catch { return null; }
}

function summarizeKey(key) {
  const access = key.access_key || {};
  const permission = access.permission;
  const functionCall = permission && typeof permission === 'object' ? permission.FunctionCall : null;
  const isFullAccess = permission === 'FullAccess' || permission?.FullAccess != null;
  return {
    publicKey: key.public_key,
    nonce: access.nonce ?? null,
    kind: isFullAccess ? 'FullAccess' : functionCall ? 'FunctionCall' : 'Unknown',
    receiverId: functionCall?.receiver_id || null,
    methodNames: Array.isArray(functionCall?.method_names) ? functionCall.method_names : null,
    unrestrictedMethods: !!functionCall && (!Array.isArray(functionCall.method_names) || functionCall.method_names.length === 0),
    allowanceYocto: functionCall?.allowance || null,
    allowanceNear: yoctoToNear(functionCall?.allowance),
  };
}

function assessKeys(keys, selectedPublicKey) {
  const selected = selectedPublicKey ? keys.find(k => k.publicKey === selectedPublicKey) : null;
  const targetKeys = selected ? [selected] : keys;
  const fullAccessCount = targetKeys.filter(k => k.kind === 'FullAccess').length;
  const functionCallCount = targetKeys.filter(k => k.kind === 'FunctionCall').length;
  const unrestrictedCalls = targetKeys.filter(k => k.kind === 'FunctionCall' && k.unrestrictedMethods).length;
  let exposure = 'UNKNOWN';
  let summary = 'Select the agent public key to attribute permissions to a specific agent.';
  let grade = null;
  if (selected) {
    if (selected.kind === 'FullAccess') {
      exposure = 'CRITICAL'; grade = 0; summary = 'The selected agent key has Full Access permissions. It is not scoped to one contract.';
    } else if (selected.kind === 'FunctionCall' && selected.unrestrictedMethods) {
      exposure = 'HIGH'; grade = 1; summary = 'The selected key is contract-scoped, but its method list is unrestricted.';
    } else if (selected.kind === 'FunctionCall') {
      exposure = 'SCOPED'; grade = 2; summary = 'The selected key is scoped to one receiver and an explicit method list. This does not prove downstream contract behaviour is safe.';
    } else {
      exposure = 'UNKNOWN'; summary = 'The selected key permission could not be classified.';
    }
  } else {
    if (fullAccessCount > 0) { exposure = 'ELEVATED'; summary = `${fullAccessCount} Full Access key(s) are present on the account. The keys are not attributed to a specific agent.`; }
    else if (functionCallCount > 0) { exposure = 'RESTRICTED'; summary = 'The sampled account keys are FunctionCall keys. Select the agent public key for an attributable assessment.'; }
    else { exposure = 'UNKNOWN'; summary = 'No supported key permissions were returned.'; }
  }
  return { selectedKeyFound: !!selected, selectedKey: selected || null, fullAccessCount, functionCallCount, unrestrictedCalls, exposure, provisionalStage: grade, summary, scope: selected ? 'agent-key' : 'account-overview' };
}

export async function inspectNearAccount(accountId, agentPublicKey, env = process.env) {
  if (!validateAccountId(accountId)) throw new Error('Enter a valid NEAR account ID (2–64 lowercase characters, or a 64-character implicit account).');
  const [account, accessList, history] = await Promise.all([
    nearRpc('query', { request_type: 'view_account', finality: 'final', account_id: accountId }, env),
    nearRpc('query', { request_type: 'view_access_key_list', finality: 'final', account_id: accountId }, env),
    getFastNearHistory(accountId, env, { limit: 40 }),
  ]);
  const keys = (accessList.keys || []).map(summarizeKey);
  const hasContract = !!account.code_hash && account.code_hash !== NO_CONTRACT_HASH;
  const assessment = assessKeys(keys, agentPublicKey || null);
  const historyRows = history.rows || [];
  const transactions = historyRows.map(row => ({
    hash: row.transaction_hash || null,
    blockHeight: row.tx_block_height ?? null,
    timestamp: row.tx_block_timestamp || null,
    isSigner: !!row.is_real_signer,
    isReceiver: !!row.is_real_receiver,
    success: row.is_success ?? null,
  }));
  return {
    accountId,
    network: env.NEAR_NETWORK || 'testnet',
    inspectedAt: new Date().toISOString(),
    blockHeight: account.block_height ?? null,
    amountYocto: account.amount ?? null,
    codeHash: account.code_hash || null,
    hasContract,
    storageUsage: account.storage_usage ?? null,
    keys,
    keyAssessment: assessment,
    history: {
      available: history.available,
      sampled: history.sampled,
      txCountOnFirstPage: history.txCountOnFirstPage,
      latestBlock: history.latestBlock,
      transactions,
      source: history.source,
      error: history.error || null,
    },
    limitations: [
      'Public account data shows registered permissions; it does not identify who physically holds each private key.',
      'Account-level permissions are not attributed to an AI agent unless its public key is supplied and matched.',
      'A contract code hash identifies deployed code; it does not by itself prove ownership, upgrade authority or safety.',
      'Transaction history is an indexed sample, not a complete forensic analysis of all historical contract effects.',
    ],
  };
}

export { yoctoToNear };
