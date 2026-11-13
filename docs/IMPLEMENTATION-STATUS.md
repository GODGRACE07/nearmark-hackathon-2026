# NEARMARK implementation status — release snapshot

**Product:** evidence-first security assessment and payment-enforcement toolkit for NEAR agents.
**Tagline:** Don't trust the permissions. Test the authority.

This file is the release truth source. “Implemented”, “built”, “observed”, and “deployed” are different states; the UI and demo must preserve those distinctions.

## Implemented in this source snapshot

- Multi-route React/Vite app with responsive UI, Motion transitions and a procedural Three.js authority scene.
- Node API with request-size limits, exact CORS origin checks, security headers, process-local rate limits and server-side secret handling.
- NEAR account and access-key inspection through read-only JSON-RPC; FastNear indexed history samples are explicitly samples, not complete forensic history.
- Counterparty policy engine with exact 24-decimal arithmetic, owner-defined recipient/method/amount mandates, ALLOW/WARN/BLOCK decisions and evidence reasons.
- Local deterministic NASB-0.1 six-scenario JavaScript harness, Ed25519 local receipts and controlled reference profiles.
- TypeScript SDK, native Gate adapter, FT Gate adapter, CLI and minimal MCP server.
- Native NEAR Rust Gate: owner/agent identity, exact FunctionCall public key, recipient allowlist, per-payment/daily limits, expiry, single-use nonce and emergency pause.
- Separate NEP-141 FT Gate source with token allowlists, recipient policy, U128 amounts, expiry/nonce and pause controls.
- NEAR Workspaces Sandbox integration test for the native Gate. Source and prior supplied logs indicate an approved test payment plus rejected attack attempts in the isolated Sandbox; this is not a public Testnet deployment.
- NEAR AI official JS SDK adapter: preflight model attestation, response verification and `provider_tee`-only model-TEE status. It requires a configured API key/model and an authenticated Supabase user for the application route.
- OutLayer WASI Preview 2 worker. It validates fields and signs a canonical receipt with a TEE-derived Ed25519 key when executed remotely. It does **not** run the NASB scenarios or prove their semantics.
- Supabase Auth/database route and SQL migration; Stripe Checkout/webhook signature-validation code; OutLayer custody status/guarded transfer code. Provider activation requires customer-owned accounts and credentials.

## Evidence state

- The 41 JavaScript/backend/SDK tests in the supplied source snapshot pass under Node's built-in test runner.
- The three OutLayer receipt-verifier unit tests are a separate suite.
- Native Gate and FT Gate Rust unit tests are included; the consolidated release runner executes them.
- TypeScript/Vite, Rust WASM, WASI and live RPC checks are executed on the user's WSL machine by the release runner. Do not claim a check passed until the new run log shows it.
- A previous successful local Sandbox run is reported in the supplied audit; rerun it with the release runner and retain the new output.

## Deliberately not claimed as complete

- No public Testnet Gate deployment is claimed until the deployment runner writes `artifacts/nearmark-testnet-evidence.json` with transaction references.
- FT Gate is compiled/tested locally but not automatically deployed: a real token contract, storage registration, funded Gate and separate restricted agent key are required.
- The OutLayer worker currently performs **TEE-backed receipt signing only**. A real OutLayer project version, remote execution ID and independent `outlayer-verify` proof bundle are still required. A TEE quote proves execution binding to the worker measurement, not benchmark correctness.
- NEAR AI's live `provider_tee` result must be obtained with the configured model and account. Model catalogue presence or an ordinary inference response is not that proof.
- Supabase migration must be applied to the user's project and login/RLS tested. Stripe needs a Test-mode Price, keys and webhook endpoint. `NEARMARK_REQUIRE_AUTH` must remain false until auth is fully tested.
- Historical contract code-change timelines, full downstream call graphs and an agent-to-recipient transaction-history join are not implemented; unavailable data remains UNKNOWN/not checked.
- Community threat reports are not a mature reputation network: submitted reports remain pending until reviewed. No automatic third-party competitor benchmarking is present.
- No production hosting, distributed rate limiting, formal audit, SLA, customer support, backup/monitoring or production custody policy is supplied by this source package.

## What the one-command release runner does

1. Installs Node 24.22.1, Rust 1.95.0, the WASI Preview 2 target, `near` CLI and `cargo-near` in the WSL user profile if missing.
2. Creates a private `.env` from safe templates without overwriting existing values, and fills missing Phase 2 settings.
3. Installs locked dependencies; runs 41 backend/SDK tests plus three OutLayer verifier tests.
4. Runs TypeScript and Vite production build.
5. Checks and builds native Gate and FT Gate Rust crates/WASM; builds the OutLayer WASI worker.
6. Runs the real native Gate NEAR Sandbox integration test.
7. Starts the API temporarily and checks health, a live Testnet account inspection, the benchmark endpoint and Phase 2 status.
8. Runs optional read-only OutLayer checks if credentials are present. It does not silently make paid AI requests.
9. Offers a separate, explicit `DEPLOY TESTNET` confirmation for the native Gate demo only.
10. Writes logs and a non-secret readiness report, then starts the local application.

## Security boundaries

- Keep private keys, seed phrases, `.env`, `.near-credentials` and `~/.nearmark` out of GitHub and chat.
- Do not enable OutLayer mutations by default; keep a server-side allowlist and cap.
- Do not mark NEAR AI output as model-TEE-verified unless response verification returns `provider_tee`.
- Do not present a local benchmark, local receipt signature or Sandbox run as a public Testnet/OutLayer proof.
- Do not deploy to Mainnet using this hackathon runner.
