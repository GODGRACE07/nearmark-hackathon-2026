import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const evidencePath = path.join(root, 'artifacts/nearmark-testnet-evidence.json');
const attemptPath = evidencePath + '.payment-attempt.json';
const recoveryPath = path.join(root, 'artifacts/nearmark-testnet-transaction-recovery.json');
const api = 'https://tx.test.fastnear.com/v0';

if (!fs.existsSync(evidencePath)) {
  console.log('[RECOVERY] No Testnet evidence file; transaction recovery skipped.');
  process.exit(0);
}

const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
const payment = evidence.approvedPayment || {};
if (payment.transactionHash) {
  console.log('[RECOVERY] Evidence already contains a transaction hash:', payment.transactionHash);
  process.exit(0);
}

const { agentId, gateId, vendorId } = evidence;
const amount = String(payment.amountYocto || '');
const nonce = String(payment.nonce ?? '');
const anchor = Number(evidence.finalBlockHeightAtPayment || 0);
if (!agentId || !gateId || !vendorId || !/^\d+$/.test(amount) || !/^\d+$/.test(nonce) || !anchor) {
  console.log('[RECOVERY] Evidence lacks required account/payment/block fields; no changes made.');
  process.exit(0);
}

async function post(endpoint, body) {
  const response = await fetch(`${api}/${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

function decodeArgs(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return null;
  try { return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')); } catch {}
  try { return JSON.parse(raw); } catch {}
  return null;
}

function functionCall(action) {
  return action?.FunctionCall ?? action?.function_call ?? action?.functionCall ?? null;
}

try {
  console.log('[RECOVERY] Searching indexed Testnet history; this is read-only.');
  console.log('[RECOVERY] Agent:', agentId, '| Gate:', gateId, '| block anchor:', anchor);

  const history = await post('account', {
    account_id: agentId,
    is_real_signer: true,
    is_function_call: true,
    is_success: true,
    from_tx_block_height: Math.max(0, anchor - 100),
    to_tx_block_height: anchor + 500,
    limit: 200,
    desc: false
  });

  const rows = Array.isArray(history.account_txs) ? history.account_txs : [];
  const hashes = [...new Set(rows
    .filter(row => Number(row.tx_block_height || 0) >= anchor - 100 && Number(row.tx_block_height || 0) <= anchor + 500)
    .map(row => row.transaction_hash)
    .filter(hash => typeof hash === 'string' && hash.length >= 32))];

  console.log('[RECOVERY] Indexed candidate transactions:', hashes.length);

  const matches = [];
  for (let i = 0; i < hashes.length; i += 20) {
    const result = await post('transactions', { tx_hashes: hashes.slice(i, i + 20) });
    for (const item of (result.transactions || [])) {
      const tx = item.transaction || {};
      if (tx.signer_id !== agentId || tx.receiver_id !== gateId) continue;
      const height = Number(item.execution_outcome?.block_height || item.transaction?.block_height || 0);
      const actions = Array.isArray(tx.actions) ? tx.actions : [];
      for (const action of actions) {
        const fc = functionCall(action);
        if (!fc || fc.method_name !== 'execute_payment') continue;
        const args = decodeArgs(fc.args);
        if (!args) continue;
        if (String(args.receiver_id) !== vendorId) continue;
        if (String(args.amount_yocto) !== amount) continue;
        if (String(args.nonce) !== nonce) continue;

        const txHash = tx.hash || item.transaction_hash || null;
        if (!txHash) continue;

        matches.push({
          transactionHash: txHash,
          blockHeight: height || null,
          signerId: tx.signer_id,
          receiverId: tx.receiver_id,
          method: fc.method_name,
          paymentReceiver: args.receiver_id,
          amountYocto: String(args.amount_yocto),
          nonce: String(args.nonce),
          indexedSuccess: rows.some(row => row.transaction_hash === txHash && row.is_success === true),
          receiptCount: Array.isArray(item.receipts) ? item.receipts.length : null
        });
      }
    }
  }

  const unique = [...new Map(matches.map(m => [m.transactionHash, m])).values()];
  if (unique.length !== 1) {
    const result = {
      status: unique.length === 0 ? 'NOT_FOUND' : 'AMBIGUOUS',
      checkedAt: new Date().toISOString(),
      anchorBlockHeight: anchor,
      candidateCount: unique.length,
      note: 'No existing Testnet payment was repeated or changed. Evidence remains unchanged.'
    };
    fs.writeFileSync(recoveryPath, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
    console.log('[RECOVERY]', result.status, '- no evidence was modified.');
    process.exit(0);
  }

  const found = unique[0];
  payment.transactionHash = found.transactionHash;
  payment.transactionBlockHeight = found.blockHeight;
  payment.transactionExplorerUrl = `https://testnet.nearblocks.io/txns/${found.transactionHash}`;
  payment.transactionHashRecoveredAt = new Date().toISOString();
  evidence.approvedPayment = payment;
  evidence.transactionHashRecovery = {
    method: 'FastNear Transactions API indexed account history + exact transaction/action argument match',
    recoveredAt: payment.transactionHashRecoveredAt,
    match: found
  };

  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });

  if (fs.existsSync(attemptPath)) {
    const attempt = JSON.parse(fs.readFileSync(attemptPath, 'utf8'));
    attempt.transactionHash = found.transactionHash;
    attempt.transactionBlockHeight = found.blockHeight;
    attempt.recoveredAt = payment.transactionHashRecoveredAt;
    fs.writeFileSync(attemptPath, JSON.stringify(attempt, null, 2) + '\n', { mode: 0o600 });
  }

  const recovery = {
    status: 'RECOVERED',
    checkedAt: new Date().toISOString(),
    transactionHash: found.transactionHash,
    blockHeight: found.blockHeight,
    signerId: found.signerId,
    receiverId: found.receiverId,
    method: found.method,
    paymentReceiver: found.paymentReceiver,
    amountYocto: found.amountYocto,
    nonce: found.nonce,
    explorerUrl: payment.transactionExplorerUrl,
    evidenceFile: path.relative(root, evidencePath)
  };
  fs.writeFileSync(recoveryPath, JSON.stringify(recovery, null, 2) + '\n', { mode: 0o600 });

  console.log('[RECOVERY] PASS: Exact transaction matched by signer, Gate, method, recipient, amount and nonce.');
  console.log('[RECOVERY] Transaction hash:', found.transactionHash);
  console.log('[RECOVERY] Block:', found.blockHeight || 'not supplied');
  console.log('[RECOVERY] Explorer:', payment.transactionExplorerUrl);
} catch (error) {
  const result = {
    status: 'LOOKUP_ERROR',
    checkedAt: new Date().toISOString(),
    error: error.message,
    note: 'Read-only lookup failed; existing evidence and chain state were not changed.'
  };
  fs.writeFileSync(recoveryPath, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
  console.error('[RECOVERY] Read-only lookup failed:', error.message);
  process.exitCode = 0;
}
