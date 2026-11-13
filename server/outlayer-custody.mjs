const DEFAULT_TESTNET_API = 'https://testnet-api.outlayer.ai';

function getBase() {
  const base = (process.env.OUTLAYER_API_URL || DEFAULT_TESTNET_API).replace(/\/$/, '');
  let parsed;
  try { parsed = new URL(base); } catch { throw Object.assign(new Error('OUTLAYER_API_URL must be a valid HTTPS URL.'), { status: 500, code: 'OUTLAYER_URL_INVALID' }); }
  if (parsed.protocol !== 'https:') throw Object.assign(new Error('OutLayer API must use HTTPS.'), { status: 403, code: 'OUTLAYER_HTTPS_REQUIRED' });
  if ((process.env.OUTLAYER_NETWORK || 'testnet') === 'testnet' && parsed.hostname !== 'testnet-api.outlayer.ai') {
    throw Object.assign(new Error('OutLayer is configured for Testnet but OUTLAYER_API_URL is not the official Testnet API host.'), { status: 409, code: 'OUTLAYER_NETWORK_MISMATCH' });
  }
  if ((process.env.OUTLAYER_NETWORK || 'testnet') !== 'testnet') {
    throw Object.assign(new Error('This NEARMARK release enables OutLayer custody operations on Testnet only.'), { status: 403, code: 'OUTLAYER_MAINNET_DISABLED' });
  }
  return base;
}

async function request(path, options = {}) {
  const key = process.env.OUTLAYER_API_KEY;
  if (!key) throw Object.assign(new Error('OUTLAYER_API_KEY is not configured.'), { status: 503 });
  const response = await fetch(`${getBase()}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${key}`,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data?.error?.message || data?.message || `OutLayer HTTP ${response.status}`), { status: response.status >= 400 && response.status < 500 ? response.status : 502, code: 'OUTLAYER_API_ERROR' });
  return data;
}

export async function inspectOutLayerCustody() {
  if (!process.env.OUTLAYER_API_KEY) throw Object.assign(new Error('OUTLAYER_API_KEY is not configured.'), { status: 503 });
  const [address, balance, policy, audit] = await Promise.all([
    request('/wallet/v1/address?chain=near'),
    request('/wallet/v1/balance?chain=near'),
    request('/wallet/v1/policy'),
    request('/wallet/v1/audit').catch(error => ({ unavailable: true, reason: error.message })),
  ]);
  return { address, balance, policy, audit, network: 'testnet', inspectedAt: new Date().toISOString(), executionAttestation: 'not-established-by-this-read' };
}

export function validateOutLayerTransfer(body, env = process.env) {
  if (env.OUTLAYER_ENABLE_MUTATIONS !== 'true') {
    throw Object.assign(new Error('OutLayer transfer is disabled. Set OUTLAYER_ENABLE_MUTATIONS=true only after configuring the custody wallet policy.'), { status: 403, code: 'OUTLAYER_MUTATIONS_DISABLED' });
  }
  const recipient = String(body?.to || '').trim().toLowerCase();
  const amount = String(body?.amount || '').trim();
  if (!/^[a-z0-9._-]+\.testnet$/.test(recipient)) throw Object.assign(new Error('OutLayer Testnet transfer recipient must be a .testnet account.'), { status: 400 });
  if (!/^\d+$/.test(amount) || BigInt(amount) <= 0n) throw Object.assign(new Error('amount must be a positive integer yoctoNEAR string.'), { status: 400 });
  const recipients = (env.OUTLAYER_ALLOWED_RECIPIENTS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  if (!recipients.includes(recipient)) throw Object.assign(new Error('Recipient is not on the server-side OutLayer allowlist.'), { status: 403, code: 'OUTLAYER_RECIPIENT_BLOCKED' });
  const max = env.OUTLAYER_MAX_TRANSFER_YOCTO;
  if (!max || !/^\d+$/.test(max) || BigInt(amount) > BigInt(max)) throw Object.assign(new Error('Transfer exceeds the configured OutLayer maximum or no maximum has been configured.'), { status: 403, code: 'OUTLAYER_AMOUNT_BLOCKED' });
  return { to: recipient, amount };
}

export async function submitOutLayerTransfer(body) {
  const transfer = validateOutLayerTransfer(body);
  // Do not retry this POST automatically: if the HTTP connection fails after
  // dispatch, the remote state may be ambiguous and repeating can double-pay.
  return request('/wallet/v1/transfer', { method: 'POST', body: JSON.stringify(transfer) });
}
