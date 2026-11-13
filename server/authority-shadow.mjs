const KNOWN = {
  native: {
    label: 'NEARMARK Native Gate',
    method: 'execute_payment',
    effects: [
      'Promise::new(receiver_id).transfer(amount_yocto)',
      'Promise callback on_transfer_complete releases a daily reservation if transfer fails; nonce remains consumed'
    ],
    controls: [
      'predecessor account, signer account and signer public key must match the owner-configured agent identity',
      'receiver must be in the owner allowlist',
      'per-payment and daily native-NEAR limits are enforced on-chain',
      'nonce must be next and authorization must expire within five minutes',
      'emergency pause blocks agent payments'
    ],
    localTests: 'Native Gate Rust suite and NEAR Sandbox integration test passed in the release checks.'
  },
  ft: {
    label: 'NEARMARK FT Gate',
    method: 'execute_ft_payment',
    effects: [
      'Calls the owner-approved NEP-141 token contract ft_transfer(receiver_id, amount, memo) with 1 yoctoNEAR',
      'Promise callback on_ft_transfer_complete releases the daily reservation on token-call failure; nonce remains consumed'
    ],
    controls: [
      'predecessor account, signer account and signer public key must match the owner-configured agent identity',
      'token contract must have an owner-approved token policy',
      'recipient must be in that token policy allowlist',
      'per-payment and daily token-unit limits are enforced on-chain',
      'nonce must be next and authorization has a bounded expiry',
      'emergency pause blocks agent payments'
    ],
    localTests: 'FT Gate Rust suite passed 9/9; a separate live Testnet payment settled successfully.'
  }
};

export async function buildAuthorityShadow({ agentAccount, keys = [], env = {}, readAccount, readStatus }) {
  const edges = [];
  for (const key of keys) {
    if (key.kind !== 'FunctionCall' || !key.receiverId) continue;
    const receiver = key.receiverId;
    let kind = null;
    if (receiver === (env.NEARMARK_NATIVE_GATE_ACCOUNT || 'tony-nearmark-owner.testnet')) kind = 'native';
    if (receiver === (env.NEARMARK_FT_GATE_ACCOUNT || 'ft-gate.tony-nearmark-owner.testnet')) kind = 'ft';
    if (!kind) {
      edges.push({ receiver, publicKey: key.publicKey, methods: key.methodNames || [], status: 'UNKNOWN', evidence: [{ label: 'confirmed', detail: 'The direct FunctionCall receiver and method scope were returned by NEAR RPC.' }, { label: 'unknown', detail: 'No verified source catalog is available for this downstream contract.' }], downstreamEffects: 'UNKNOWN — arbitrary contract effects have not been analyzed.' });
      continue;
    }
    const spec = KNOWN[kind];
    const expected = kind === 'ft' ? env.NEARMARK_FT_GATE_CODE_HASH : env.NEARMARK_NATIVE_GATE_CODE_HASH;
    let account = null;
    let status = null;
    let readError = null;
    try { account = await readAccount(receiver); } catch (e) { readError = e?.message || String(e); }
    const codeMatch = !!expected && !!account?.code_hash && account.code_hash === expected;
    if (codeMatch && typeof readStatus === 'function') {
      try { status = await readStatus(receiver); } catch (e) { readError = e?.message || String(e); }
    }
    const expectedAgentKeyMatches = status && status.agent_id === agentAccount && status.agent_public_key === key.publicKey;
    const methodAllowed = Array.isArray(key.methodNames) && key.methodNames.length === 1 && key.methodNames[0] === spec.method;
    const verified = codeMatch && expectedAgentKeyMatches && methodAllowed;
    if (!verified) {
      edges.push({
        receiver, publicKey: key.publicKey, methods: key.methodNames || [], status: 'PARTIAL',
        evidence: [
          { label: 'confirmed', detail: 'The FunctionCall receiver and method scope are confirmed by NEAR RPC.' },
          { label: codeMatch ? 'confirmed' : 'unknown', detail: codeMatch ? 'On-chain code hash matches the locally built NEARMARK Gate WASM.' : 'The contract code hash could not be matched to the local NEARMARK Gate build.' },
          { label: 'unknown', detail: expectedAgentKeyMatches ? 'The key scope does not exactly match the Gate entrypoint.' : 'The Gate on-chain agent identity could not be matched to this exact key.' }
        ],
        downstreamEffects: 'UNKNOWN — full code-to-chain identity binding was not established.',
        readError: readError || null
      });
      continue;
    }
    edges.push({
      receiver, publicKey: key.publicKey, methods: key.methodNames, status: 'CODE_HASH_AND_AGENT_BINDING_CONFIRMED',
      contract: spec.label,
      onChainCodeHash: account.code_hash,
      localWasmSha256: kind === 'ft' ? env.NEARMARK_FT_GATE_WASM_SHA256 || null : env.NEARMARK_NATIVE_GATE_WASM_SHA256 || null,
      onChainPolicy: kind === 'ft' ? {
        ownerId: status.owner_id, agentId: status.agent_id, paused: status.paused,
        nextNonce: status.next_nonce, policyVersion: status.policy_version,
        tokenPolicies: (status.token_policies || []).map(p => ({ tokenId: p.token_id, allowedReceivers: p.allowed_receivers, maxPayment: p.max_payment, dailyLimit: p.daily_limit, spentToday: p.spent_today }))
      } : {
        ownerId: status.owner_id, agentId: status.agent_id, paused: status.paused,
        nextNonce: status.next_nonce, policyVersion: status.policy_version,
        allowedReceivers: status.allowed_receivers, maxPaymentYocto: status.max_payment_yocto, dailyLimitYocto: status.daily_limit_yocto
      },
      downstreamEffects: spec.effects,
      controls: spec.controls,
      evidence: [
        { label: 'confirmed', detail: 'NEAR finalized account data confirms the deployed code hash.' },
        { label: 'confirmed', detail: 'The Gate get_status response binds the configured agent account and public key to this FunctionCall key.' },
        { label: 'code-inferred', detail: 'The downstream call graph and guard conditions are derived from the exact local Rust source whose WASM hash matches the on-chain code hash.' },
        { label: 'sandbox-observed', detail: spec.localTests }
      ],
      limitations: ['Code-hash matching and local tests do not prove arbitrary contract safety.', 'Sandbox-observed evidence is not a claim that all attack classes have been tested on public Testnet.']
    });
  }
  return {
    standard: 'NEARMARK-AUTHORITY-SHADOW-0.1',
    agentAccount,
    inspectedAt: new Date().toISOString(),
    directAuthority: keys.map(k => ({ publicKey: k.publicKey, kind: k.kind, receiverId: k.receiverId, methodNames: k.methodNames, allowanceYocto: k.allowanceYocto })),
    downstreamAuthority: edges,
    summary: edges.some(e => e.status === 'CODE_HASH_AND_AGENT_BINDING_CONFIRMED') ? 'Some FunctionCall paths are bound to verified NEARMARK Gate source and on-chain policy.' : 'Direct permissions were inspected, but downstream effects remain unknown or partially verified.',
    disclaimer: 'Authority Shadow reports confirmed permissions, code-inferred call paths, sandbox observations and unknowns separately. It is not a proof of general contract safety.'
  };
}
