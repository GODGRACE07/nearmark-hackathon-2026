/**
 * Nearmark SDK — policy client and fail-closed agent execution guard.
 *
 * This package never accepts or stores private keys. `executeThroughGate`
 * requires a caller-supplied adapter that reads the deployed Gate and submits
 * only `execute_payment` through the agent's FunctionCall-scoped key.
 * The Gate contract remains the final on-chain enforcement boundary.
 */

const YOCTO_PER_NEAR = 10n ** 24n;
const GATE_METHOD = 'execute_payment';
const FT_GATE_METHOD = 'execute_ft_payment';

function nearmarkError(code, message, decision) {
  const error = new Error(message);
  error.code = code;
  if (decision) error.decision = decision;
  return error;
}

function toYocto(value) {
  const raw = String(value ?? '').trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,24})?$/.test(raw)) {
    throw nearmarkError('NEARMARK_INVALID_AMOUNT', 'Amount must be a positive decimal with at most 24 fractional digits.');
  }
  const [whole, fraction = ''] = raw.split('.');
  const units = BigInt(whole) * YOCTO_PER_NEAR
    + BigInt((fraction + '0'.repeat(24)).slice(0, 24));
  if (units <= 0n) {
    throw nearmarkError('NEARMARK_INVALID_AMOUNT', 'Amount must be greater than zero.');
  }
  return units.toString();
}

function assertDecisionMatchesRequest(decision, input) {
  if (!decision || !['ALLOW', 'WARN', 'BLOCK'].includes(decision.decision)) {
    throw nearmarkError('NEARMARK_INVALID_DECISION', 'Nearmark returned an invalid decision. Execution was stopped.');
  }
  const expectedReceiver = String(input.receiver ?? '').trim().toLowerCase();
  const returnedReceiver = String(decision.receiver ?? '').trim().toLowerCase();
  const expectedAmount = String(input.amount ?? '').trim();
  const returnedAmount = String(decision.amount ?? '').trim();
  if (!expectedReceiver || expectedReceiver !== returnedReceiver || !expectedAmount || expectedAmount !== returnedAmount) {
    throw nearmarkError(
      'NEARMARK_DECISION_MISMATCH',
      'The policy response does not match the exact receiver and amount requested. Execution was stopped.',
      decision,
    );
  }
}

function readGateField(status, snake, camel) {
  return status?.[snake] ?? status?.[camel];
}

/**
 * Build a narrow adapter for near-api-js v7. The supplied Account MUST have
 * been constructed with the agent's restricted FunctionCall key. The SDK
 * never receives the secret key; it only receives this already-configured
 * account object from the caller.
 */
export function createNearApiJsGateAdapter({ account, provider, agentAccountId, gateAccountId, gas = 30_000_000_000_000n } = {}) {
  if (!account || typeof account.callFunction !== 'function' || !account.accountId) {
    throw nearmarkError('NEARMARK_NEAR_ACCOUNT_REQUIRED', 'Provide a near-api-js Account configured with the restricted agent key.');
  }
  if (!provider || typeof provider.callFunction !== 'function') {
    throw nearmarkError('NEARMARK_NEAR_PROVIDER_REQUIRED', 'Provide a near-api-js JsonRpcProvider.');
  }
  if (!agentAccountId || account.accountId !== agentAccountId) {
    throw nearmarkError('NEARMARK_AGENT_ACCOUNT_MISMATCH', 'The near-api-js signer account does not match the configured agent account.');
  }
  if (!gateAccountId || typeof gateAccountId !== 'string') {
    throw nearmarkError('NEARMARK_GATE_TARGET_MISMATCH', 'A valid Gate account ID is required.');
  }
  if (!/^\d+$/.test(String(gas)) || BigInt(gas) <= 0n) {
    throw nearmarkError('NEARMARK_INVALID_GAS', 'Gate function-call gas must be a positive integer string.');
  }

  return Object.freeze({
    accountId: gateAccountId,
    async getStatus() {
      return provider.callFunction({
        contractId: gateAccountId,
        method: 'get_status',
        args: {},
      });
    },
    async executePayment(args) {
      // Single action, exact Gate receiver, zero deposit, fixed method.
      return account.callFunction({
        contractId: gateAccountId,
        methodName: GATE_METHOD,
        args,
        gas: BigInt(gas),
        deposit: 0n,
      });
    },
  });
}

/**
 * Build a narrow adapter for the NEP-141 Gate. The FunctionCall key must be
 * scoped only to Gate.execute_ft_payment; the Gate itself calls ft_transfer.
 */
export function createNearApiJsFtGateAdapter({ account, provider, agentAccountId, gateAccountId, gas = 60_000_000_000_000n } = {}) {
  if (!account || typeof account.callFunction !== 'function' || !account.accountId) {
    throw nearmarkError('NEARMARK_NEAR_ACCOUNT_REQUIRED', 'Provide a near-api-js Account configured with the restricted FT agent key.');
  }
  if (!provider || typeof provider.callFunction !== 'function') {
    throw nearmarkError('NEARMARK_NEAR_PROVIDER_REQUIRED', 'Provide a near-api-js JsonRpcProvider.');
  }
  if (!agentAccountId || account.accountId !== agentAccountId) {
    throw nearmarkError('NEARMARK_AGENT_ACCOUNT_MISMATCH', 'The near-api-js signer account does not match the configured agent account.');
  }
  if (!gateAccountId || typeof gateAccountId !== 'string') {
    throw nearmarkError('NEARMARK_GATE_TARGET_MISMATCH', 'A valid FT Gate account ID is required.');
  }
  if (!/^\d+$/.test(String(gas)) || BigInt(gas) <= 0n) {
    throw nearmarkError('NEARMARK_INVALID_GAS', 'FT Gate function-call gas must be a positive integer string.');
  }
  return Object.freeze({
    accountId: gateAccountId,
    async getStatus() {
      return provider.callFunction({ contractId: gateAccountId, method: 'get_status', args: {} });
    },
    async executeFtPayment(args) {
      return account.callFunction({
        contractId: gateAccountId,
        methodName: FT_GATE_METHOD,
        args,
        gas: BigInt(gas),
        deposit: 0n,
      });
    },
  });
}

export class NearmarkClient {
  constructor({ baseUrl = 'http://localhost:8787', fetchImpl = fetch } = {}) {
    this.baseUrl = String(baseUrl).replace(/\/$/, '');
    this.fetch = fetchImpl;
  }

  async request(path, options = {}) {
    const headers = { 'content-type': 'application/json', ...(options.headers || {}) };
    const response = await this.fetch(`${this.baseUrl}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Nearmark API returned ${response.status}`);
    return data;
  }

  inspect(accountId, agentPublicKey) {
    return this.request('/api/inspect', { method: 'POST', body: JSON.stringify({ accountId, agentPublicKey }) });
  }

  checkCounterparty(input) {
    return this.request('/api/counterparty/check', { method: 'POST', body: JSON.stringify(input) });
  }

  runBenchmark(profile = 'nearmark-guard') {
    return this.request('/api/benchmark/run', { method: 'POST', body: JSON.stringify({ profile }) });
  }

  getBenchmarkRuns() { return this.request('/api/benchmark/runs'); }
  getReports() { return this.request('/api/reports'); }
  authorityShadow(accountId, agentPublicKey) { return this.request('/api/authority-shadow', { method: 'POST', body: JSON.stringify({ accountId, agentPublicKey }) }); }
  nearAiRedAnalysis(prompt, sourceCode) { return this.request('/api/near-ai/red/analyze', { method: 'POST', body: JSON.stringify({ prompt, sourceCode }) }); }
  listAgentMarketServices(category = 'security') { return this.request(`/api/agent-market/services?category=${encodeURIComponent(category)}`); }
  listNearIntentsTokens() { return this.request('/api/intents/tokens'); }
  previewNearIntentsQuote(input) { return this.request('/api/intents/quote-preview', { method: 'POST', body: JSON.stringify(input) }); }

  async enforceDecision(input, { onWarn } = {}) {
    const decision = await this.checkCounterparty(input);
    assertDecisionMatchesRequest(decision, input);

    if (decision.decision === 'BLOCK') {
      throw nearmarkError(
        'NEARMARK_BLOCKED',
        `Nearmark blocked payment: ${(decision.reasons || []).join(', ')}`,
        decision,
      );
    }

    if (decision.decision === 'WARN') {
      if (typeof onWarn !== 'function' || !(await onWarn(decision))) {
        throw nearmarkError(
          'NEARMARK_HUMAN_APPROVAL_REQUIRED',
          'Human approval was not granted for this warning. No execution was attempted.',
          decision,
        );
      }
    }

    return decision;
  }

  /**
   * Run the policy check, verify that the selected agent key is scoped only to
   * this Gate + execute_payment, check the Gate's on-chain status, then submit
   * the exact approved native-NEAR payment through the supplied adapter.
   *
   * `gate` adapter contract:
   *   { accountId, getStatus(): Promise<GateStatus>,
   *     executePayment(args): Promise<executionResult> }
   *
   * The adapter MUST use the agent's restricted FunctionCall key and call only
   * Gate.execute_payment. It must never transfer directly to the recipient.
   */
  async executeThroughGate(input, {
    gate,
    gateAccountId,
    onWarn,
    memo = 'NEARMARK guarded payment',
    expiresInMs = 60_000,
    nowNs = () => BigInt(Date.now()) * 1_000_000n,
  } = {}) {
    if (!gate || typeof gate.getStatus !== 'function' || typeof gate.executePayment !== 'function') {
      throw nearmarkError('NEARMARK_GATE_ADAPTER_REQUIRED', 'A Gate adapter with getStatus and executePayment is required.');
    }
    if (!gateAccountId || gate.accountId !== gateAccountId) {
      throw nearmarkError('NEARMARK_GATE_TARGET_MISMATCH', 'The Gate adapter account does not match the configured Gate account.');
    }
    if (!input?.agentAccount || !input?.agentPublicKey) {
      throw nearmarkError('NEARMARK_AGENT_IDENTITY_REQUIRED', 'agentAccount and agentPublicKey are required.');
    }
    if (!Number.isInteger(expiresInMs) || expiresInMs < 1 || expiresInMs > 300_000) {
      throw nearmarkError('NEARMARK_INVALID_EXPIRY', 'Permit lifetime must be between 1 and 300000 milliseconds.');
    }

    const amountYocto = toYocto(input.amount);

    // Inspect the actual registered key before any execution attempt.
    const inspection = await this.inspect(input.agentAccount, input.agentPublicKey);
    const selected = inspection?.keyAssessment?.selectedKey;
    const methods = selected?.methodNames;
    const keyIsPreciselyScoped = selected?.kind === 'FunctionCall'
      && selected.publicKey === input.agentPublicKey
      && selected.receiverId === gateAccountId
      && Array.isArray(methods)
      && methods.length === 1
      && methods[0] === GATE_METHOD
      && selected.unrestrictedMethods !== true;

    if (!keyIsPreciselyScoped) {
      throw nearmarkError(
        'NEARMARK_AGENT_KEY_NOT_SCOPED',
        `The selected key must be a FunctionCall key scoped only to ${gateAccountId}.${GATE_METHOD}. No execution was attempted.`,
      );
    }

    // Read the authoritative Gate policy; the contract rechecks it on-chain.
    const status = await gate.getStatus();
    const statusAgent = readGateField(status, 'agent_id', 'agentId');
    const statusPublicKey = readGateField(status, 'agent_public_key', 'agentPublicKey');
    const gateReceivers = readGateField(status, 'allowed_receivers', 'allowedReceivers');
    const maxPayment = readGateField(status, 'max_payment_yocto', 'maxPaymentYocto');
    const nonceValue = readGateField(status, 'next_nonce', 'nextNonce');

    if (statusAgent !== input.agentAccount || statusPublicKey !== input.agentPublicKey) {
      throw nearmarkError('NEARMARK_GATE_AGENT_MISMATCH', 'The on-chain Gate is configured for a different agent account or public key.');
    }
    const paused = readGateField(status, 'paused', 'paused');
    if (typeof paused !== 'boolean') {
      throw nearmarkError('NEARMARK_GATE_STATUS_INVALID', 'The Gate did not return a valid pause state.');
    }
    if (paused) {
      throw nearmarkError('NEARMARK_GATE_PAUSED', 'The Gate is paused. No execution was attempted.');
    }
    if (!Array.isArray(gateReceivers) || !gateReceivers.every(x => typeof x === 'string') || !gateReceivers.includes(input.receiver)) {
      throw nearmarkError('NEARMARK_GATE_RECIPIENT_DENIED', 'The recipient is not in the Gate on-chain allowlist.');
    }
    let maxUnits;
    try { maxUnits = BigInt(maxPayment); } catch {
      throw nearmarkError('NEARMARK_GATE_STATUS_INVALID', 'The Gate returned an invalid per-payment limit.');
    }
    if (BigInt(amountYocto) > maxUnits) {
      throw nearmarkError('NEARMARK_GATE_AMOUNT_DENIED', 'The payment exceeds the Gate on-chain per-payment limit.');
    }
    let dailyLimit;
    let spentToday;
    try {
      dailyLimit = BigInt(readGateField(status, 'daily_limit_yocto', 'dailyLimitYocto'));
      spentToday = BigInt(readGateField(status, 'spent_today_yocto', 'spentTodayYocto'));
    } catch {
      throw nearmarkError('NEARMARK_GATE_STATUS_INVALID', 'The Gate returned invalid daily spending counters.');
    }
    if (dailyLimit <= 0n || spentToday < 0n || spentToday > dailyLimit) {
      throw nearmarkError('NEARMARK_GATE_STATUS_INVALID', 'The Gate returned inconsistent daily spending counters.');
    }
    if (BigInt(amountYocto) > dailyLimit - spentToday) {
      throw nearmarkError('NEARMARK_GATE_DAILY_LIMIT_DENIED', 'The payment exceeds the Gate remaining daily allowance.');
    }

    // Ask Nearmark for ALLOW/WARN/BLOCK. WARN requires a human callback.
    const decision = await this.enforceDecision(input, { onWarn });

    const nonce = (() => {
      try {
        const value = BigInt(nonceValue);
        if (value < 0n) throw new Error('negative nonce');
        return value.toString();
      } catch {
        throw nearmarkError('NEARMARK_GATE_STATUS_INVALID', 'The Gate returned an invalid next nonce.');
      }
    })();
    let expiry;
    try {
      const currentNs = BigInt(nowNs());
      if (currentNs < 0n) throw new Error('negative clock');
      expiry = currentNs + BigInt(expiresInMs) * 1_000_000n;
    } catch {
      throw nearmarkError('NEARMARK_INVALID_EXPIRY', 'A valid non-negative nanosecond clock is required.');
    }

    const args = Object.freeze({
      receiver_id: input.receiver,
      amount_yocto: amountYocto,
      nonce,
      expires_at_ns: expiry.toString(),
      memo: String(memo).slice(0, 160),
    });

    // The adapter must call Gate.execute_payment using the scoped key.
    const execution = await gate.executePayment(args);
    return { decision, gateAccountId, args, execution };
  }

  /**
   * NEP-141 guarded execution. Amounts are integer strings in the token's
   * smallest units (never floating point). The FunctionCall key must be scoped
   * only to Gate.execute_ft_payment; arbitrary token methods are never called.
   */
  async executeFtThroughGate(input, {
    gate, gateAccountId, onWarn, memo = 'NEARMARK guarded FT payment',
    expiresInMs = 60_000, nowNs = () => BigInt(Date.now()) * 1_000_000n,
  } = {}) {
    if (!gate || typeof gate.getStatus !== 'function' || typeof gate.executeFtPayment !== 'function') {
      throw nearmarkError('NEARMARK_FT_GATE_ADAPTER_REQUIRED', 'An FT Gate adapter with getStatus and executeFtPayment is required.');
    }
    if (!gateAccountId || gate.accountId !== gateAccountId) {
      throw nearmarkError('NEARMARK_GATE_TARGET_MISMATCH', 'The FT Gate adapter account does not match the configured Gate account.');
    }
    if (!input?.agentAccount || !input?.agentPublicKey || !input?.tokenId) {
      throw nearmarkError('NEARMARK_FT_IDENTITY_REQUIRED', 'agentAccount, agentPublicKey and tokenId are required.');
    }
    if (!/^\d+$/.test(String(input.amount ?? '')) || BigInt(input.amount) <= 0n) {
      throw nearmarkError('NEARMARK_INVALID_FT_AMOUNT', 'FT amount must be a positive integer string in the token smallest unit.');
    }
    if (!Number.isInteger(expiresInMs) || expiresInMs < 1 || expiresInMs > 300_000) {
      throw nearmarkError('NEARMARK_INVALID_EXPIRY', 'Permit lifetime must be between 1 and 300000 milliseconds.');
    }

    const inspection = await this.inspect(input.agentAccount, input.agentPublicKey);
    const selected = inspection?.keyAssessment?.selectedKey;
    const methods = selected?.methodNames;
    const keyIsPreciselyScoped = selected?.kind === 'FunctionCall'
      && selected.publicKey === input.agentPublicKey
      && selected.receiverId === gateAccountId
      && Array.isArray(methods) && methods.length === 1
      && methods[0] === FT_GATE_METHOD
      && selected.unrestrictedMethods !== true;
    if (!keyIsPreciselyScoped) {
      throw nearmarkError('NEARMARK_AGENT_KEY_NOT_SCOPED', `The selected key must be a FunctionCall key scoped only to ${gateAccountId}.${FT_GATE_METHOD}. No execution was attempted.`);
    }

    const status = await gate.getStatus();
    if (readGateField(status, 'agent_id', 'agentId') !== input.agentAccount
      || readGateField(status, 'agent_public_key', 'agentPublicKey') !== input.agentPublicKey) {
      throw nearmarkError('NEARMARK_GATE_AGENT_MISMATCH', 'The FT Gate is configured for a different agent account or public key.');
    }
    if (readGateField(status, 'paused', 'paused') !== false) {
      throw nearmarkError('NEARMARK_GATE_PAUSED', 'The FT Gate is paused or returned an invalid pause state.');
    }
    const policies = readGateField(status, 'token_policies', 'tokenPolicies');
    if (!Array.isArray(policies)) throw nearmarkError('NEARMARK_GATE_STATUS_INVALID', 'The FT Gate returned no token policies.');
    const policy = policies.find(p => readGateField(p, 'token_id', 'tokenId') === input.tokenId);
    if (!policy) throw nearmarkError('NEARMARK_FT_TOKEN_DENIED', 'The token contract is not on the FT Gate owner allowlist.');
    const recipients = readGateField(policy, 'allowed_receivers', 'allowedReceivers');
    if (!Array.isArray(recipients) || !recipients.includes(input.receiver)) {
      throw nearmarkError('NEARMARK_FT_RECIPIENT_DENIED', 'The receiver is not approved for this token by the FT Gate.');
    }
    let maxPayment, dailyLimit, storedSpentToday, policyDay;
    try {
      maxPayment = BigInt(readGateField(policy, 'max_payment', 'maxPayment'));
      dailyLimit = BigInt(readGateField(policy, 'daily_limit', 'dailyLimit'));
      storedSpentToday = BigInt(readGateField(policy, 'spent_today', 'spentToday'));
      policyDay = BigInt(readGateField(policy, 'current_day', 'currentDay'));
    } catch {
      throw nearmarkError('NEARMARK_GATE_STATUS_INVALID', 'The FT Gate returned invalid token spending counters.');
    }
    let currentNs;
    try {
      currentNs = BigInt(nowNs());
      if (currentNs < 0n) throw new Error('negative clock');
    } catch { throw nearmarkError('NEARMARK_INVALID_EXPIRY', 'A valid non-negative nanosecond clock is required.'); }
    const currentDay = currentNs / 86_400_000_000_000n;
    // The on-chain contract rolls this token's budget to zero on the first
    // payment of a new day. Mirror that rule for the client preflight.
    const spentToday = policyDay === currentDay ? storedSpentToday : 0n;
    const amount = BigInt(input.amount);
    if (amount > ((1n << 128n) - 1n)) throw nearmarkError('NEARMARK_INVALID_FT_AMOUNT', 'FT amount exceeds the NEP-141 U128 maximum.');
    if (amount > maxPayment) throw nearmarkError('NEARMARK_FT_AMOUNT_DENIED', 'The FT payment exceeds the on-chain per-payment limit.');
    if (dailyLimit <= 0n || spentToday > dailyLimit || amount > dailyLimit - spentToday) {
      throw nearmarkError('NEARMARK_FT_DAILY_LIMIT_DENIED', 'The FT payment exceeds the remaining on-chain daily allowance.');
    }

    // The generic counterparty endpoint remains advisory for the recipient;
    // the on-chain FT-specific token and spending policy is authoritative.
    const decision = await this.enforceDecision(input, { onWarn });
    let nonce;
    try {
      const value = BigInt(readGateField(status, 'next_nonce', 'nextNonce'));
      if (value < 0n) throw new Error('negative nonce');
      nonce = value.toString();
    } catch { throw nearmarkError('NEARMARK_GATE_STATUS_INVALID', 'The FT Gate returned an invalid next nonce.'); }
    const expiry = currentNs + BigInt(expiresInMs) * 1_000_000n;
    const args = Object.freeze({
      token_id: input.tokenId,
      receiver_id: input.receiver,
      amount: amount.toString(),
      nonce,
      expires_at_ns: expiry.toString(),
      memo: String(memo).slice(0, 160),
    });
    const execution = await gate.executeFtPayment(args);
    return { decision, gateAccountId, tokenId: input.tokenId, args, execution };
  }
}
