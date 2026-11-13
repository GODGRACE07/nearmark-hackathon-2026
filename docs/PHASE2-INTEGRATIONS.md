# NEARMARK Phase 2 — implementation and activation notes

Phase 2 adds verifiable NEAR AI inference, an OutLayer WASI Preview 2 receipt worker and custody adapter, a separate NEP-141 Gate, and user-scoped authentication/persistence/subscriptions.

## Build and test

The maintained full release path is `bash scripts/ONE-COMMAND-WSL.sh` from WSL; it includes the Phase 2 dependency, test and build steps as well as the native Gate Sandbox/API checks. For a Phase 2-only validation without the full release pipeline, `bash scripts/phase2-one-click.sh` remains available. Neither local build script submits blockchain transactions.

## NEAR AI

`POST /api/near-ai/verified-analyze` requires a Supabase-authenticated user. `server/near-ai-tee.mjs` calls the official Inference SDK `verify(model)` before inference, requires non-empty model attestation evidence, uses E2EE, and calls `verifyResponse(completion.id)` after inference. The app marks model TEE verified only for `signatureKind: provider_tee`. A Gateway signature is still reported as signed, but not as model TEE proof. The unverified legacy `/api/near-ai/analyze` route is disabled (HTTP 410).

Configure server-side `NEAR_AI_API_KEY` and `NEAR_AI_MODEL`. Select a model that the current SDK verifies as attested; Incognito models with no model-attestation reports fail closed. Do not treat model output as a security decision or proof that source code is safe. SDK docs currently require Node.js 24.22.1 or newer.

## OutLayer

`integrations/outlayer-worker` builds for `wasm32-wasip2` and uses OutLayer SDK 0.2.1 `signing-keys`. The TEE-derived Ed25519 private key remains outside the WASM guest. The worker signs a domain-separated NASB-0.1 receipt after strict input validation. It deliberately sets `execution_scope=TEE_EXECUTED_CANONICAL_RECEIPT_SIGNING_ONLY` and `semantic_claims_verified=false`. The worker signs the receipt only; it does not execute the benchmark scenarios or verify their semantic truth.

To obtain real evidence, create a Testnet OutLayer project, publish the resulting WASM as a project version, run the operation, then capture the exact input JSON, output JSON and call ID. Run:

```bash
export OUTLAYER_CALL_ID='REAL_CALL_ID'
export OUTLAYER_INPUT_JSON="$PWD/outlayer-input.json"
export OUTLAYER_OUTPUT_JSON="$PWD/outlayer-output.json"
bash scripts/verify-outlayer-call.sh
```

The script installs and calls the official `outlayer-verify` CLI explicitly on Testnet and stores a proof bundle. A local WASM build or receipt signature is not a TEE attestation. The official verifier checks the Intel TDX quote, on-chain approved measurements and input/output binding for the actual call. It does not prove benchmark semantics or that the approved measurement was built from the source commit.

Custody endpoints:

- `GET /api/outlayer/custody/status`
- `POST /api/outlayer/custody/transfer`

Both require an authenticated user. Transfer additionally requires the user UUID in `OUTLAYER_OPERATOR_USER_IDS`. It is disabled until `OUTLAYER_ENABLE_MUTATIONS=true`, a `.testnet` recipient allowlist and a maximum yoctoNEAR amount are configured. Use only an OutLayer Testnet custody API key (`wk_...`) and apply the provider's own on-chain policy. The server never automatically retries a transfer if the remote result is ambiguous. NEAR Intents is not called; its Testnet solver routes are not available.

## NEP-141 Gate

`contracts/near-gate-ft` is a new, separate contract. It accepts up to eight explicitly named token contracts and per-token recipient allowlists and limits. The restricted agent key must be scoped to only `execute_ft_payment`; the contract checks signer account and exact public key, then calls the approved token's `ft_transfer` with 1 yoctoNEAR. It has global single-use nonce/expiry checks, emergency pause and per-token daily accounting.

The runner compiles and tests this Gate, but does not deploy it. A real Testnet launch needs:

1. A fresh FT Gate contract account.
2. A restricted FunctionCall key scoped to only that FT Gate account and `execute_ft_payment`.
3. A known Testnet NEP-141 token contract.
4. The Gate and every intended recipient registered with that token's storage-management method and the Gate funded with tokens.
5. Owner initialization with the exact token contract, recipients and integer limits.

NEP-141 amounts are integer token base units (U128 strings), not decimal NEAR amounts. Do not reuse the native Gate method key.

## Supabase and Stripe

Apply `supabase/migrations/202611100001_nearmark_phase2.sql` in the target Supabase project. Set:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only; never `VITE_`)

Configure the Supabase Site URL and `/account` redirect URL. Test passwordless email sign-in. User-owned benchmark runs and evidence reports are written with the user's access token and protected by RLS. Only pending user threat reports can be inserted; users cannot self-verify them. Set `NEARMARK_REQUIRE_AUTH=true` after the full login and persistence test passes.

For Stripe, start in Test mode. Create a recurring Price and set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, plus correct success/cancel URLs. Configure the webhook endpoint `/api/billing/stripe-webhook` for `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`. Raw webhook bytes are verified with Stripe's signature before any subscription state is written. A Checkout redirect alone never activates a subscription.

## Production hardening boundary

The current server includes request-size caps, restrictive CORS configuration, security headers, per-process rate limits and secret separation. The rate limiter is process-local, not a distributed WAF. Before customer/mainnet use, deploy behind HTTPS, set a single exact `ALLOWED_ORIGIN`, use provider-side rate limits/abuse detection, protect secrets in a vault, configure backups/monitoring, review data-retention/privacy obligations, and commission an independent smart-contract/application security audit.
