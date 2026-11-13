# NEARMARK release and production hardening plan

## Hackathon release path

The repeatable release runner is `scripts/NEARMARK-ONE-CLICK.sh`. It checks the application/API, SDK, local benchmark harness, Rust Gate, WASM build, modern local Sandbox, and optional configured provider endpoints. With explicit `DEPLOY TESTNET` authorization it then deploys the Gate to the dedicated Testnet owner account, installs/verifies the method-restricted agent key, executes a low-value Testnet payment, and records a public-chain evidence summary.

Before submitting, finish the remaining human-controlled steps:

1. Run the complete release runner on the WSL machine and inspect the final log plus `artifacts/nearmark-testnet-evidence.json`. Do not say Testnet passed until the evidence file exists and its transaction is visible on the Testnet explorer.
2. Use the app in a browser at `http://localhost:5173`. Capture the public account inspection, owner-mandate ALLOW/BLOCK, deterministic browser lab, benchmark comparison and SDK/API surfaces.
3. Record the separate Rust Sandbox run and (if Testnet deployment completed) show the Testnet payment and protocol-level method restriction. Label each environment correctly.
4. Confirm optional NEAR AI and OutLayer services only if the provider smoke tests passed. Raw NEAR AI inference is not a TEE-verification result; OutLayer remains read-only here.
5. Publish a public GitHub repository, a public X demo post and submit both links through the official hackathon form before the stated deadline. Keep the payout address under the user's control.
6. Keep README, demo narration and screenshots aligned with the current implementation-status document.

## Gaps to disclose or address after the hackathon

- Connect the Rust Sandbox runner to the browser Attack Lab and save structured, reproducible receipts from both environments.
- Add historical contract deployment/code-hash changes and robust agent-to-counterparty history joins. Until then, retain explicit UNKNOWN / `not_checked` output.
- Complete NASB-1 specification, versioned attack fixtures, independent reproduction guide, false-positive/false-negative measurement and threat-model review. The current suite is NASB-0.1 prototype evidence.
- Integrate the official NEAR AI Cloud verifier end to end (fresh nonce, gateway/model TDX evidence, request/response signature binding) before displaying any verified badge.
- Deploy a separate OutLayer WASI Preview 2 worker for canonical benchmark execution and receipt signing; independently verify its WASM/input/output/attestation binding. The current OutLayer integration is read-only.
- Add durable database storage, migrations, account authentication, tenant isolation, API-key scopes, per-user quotas, admin moderation/appeal, audit logs, observability, backups and incident response.
- Obtain independent smart-contract and application security reviews before securing real value.

## Production security boundary

The current Gate only sends native NEAR from its own account under the installed owner policy. It does not transfer FT/NFT assets or call arbitrary business contracts. The SDK guard is a cooperating-runtime layer; a compromised caller can bypass it. The on-chain Gate and protocol-level FunctionCall scope are the actual demo enforcement boundary, but they have not been independently audited. Keep the product read-only or limited to disposable Testnet/Sandbox funds until the release gate is independently reviewed.
