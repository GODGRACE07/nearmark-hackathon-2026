# NEARMARK one-command release pipeline

The maintained entry point is `scripts/ONE-COMMAND-WSL.sh`, which installs the required WSL toolchain and runs `scripts/NEARMARK-ONE-CLICK.sh`. On Windows PowerShell, `RUN-NEARMARK.ps1` delegates to that Bash runner through WSL.

## What is run

- Node 24.22.1 installation/selection, Rust 1.95.0, WASI P2 target, NEAR CLI 0.31.1 and cargo-near 0.23.0.
- Locked root npm and near-api-js integration dependencies.
- 41 Node backend/SDK tests plus 3 OutLayer receipt verifier tests.
- TypeScript validation and Vite production build.
- Native Gate and FT Gate Rust formatting/unit tests and WASM builds.
- OutLayer WASI Preview 2 worker build.
- Native Gate NEAR Sandbox integration test.
- Temporary API health, live Testnet inspection, local benchmark and Phase 2/OpenAPI checks.
- Non-secret readiness JSON and timestamped logs.
- App launch at `http://localhost:5173` with API at `http://localhost:8787`.

## Testnet writes

The local build path is read-only with respect to NEAR. After all local checks pass, the script asks for the exact phrase `DEPLOY TESTNET`. Only then does it run the native Gate Testnet flow. The flow checks the owner account's Full Access key and balance, scopes a separate agent FunctionCall key to `Gate.execute_payment`, verifies the Gate WASM hash and records the approved/rejected Testnet smoke outcomes.

It never deploys to Mainnet. FT Gate is not deployed because the token contract, storage registrations and token funding must be explicitly selected. OutLayer publish/execute is not performed because it needs the user's project and payment credentials.

## Provider activation still required

- NEAR AI: server-side key/model, supported attestation and authenticated user; the app labels model TEE only after `provider_tee` signature verification.
- OutLayer: Testnet project, published worker hash, exact execution input/output/call ID and independent `outlayer-verify` bundle.
- Supabase: apply SQL migration, configure URL/publishable/service-role keys, confirm email redirect and test RLS before enabling required auth.
- Stripe: Test-mode recurring Price, API/webhook secrets and endpoint setup. No checkout or charge is run during release validation.
- Hosting/public release: HTTPS deployment, exact CORS origin, secret storage, monitoring, repository publication, demo video/X post and final hackathon form.

## Security limits

NASB-0.1 is the six-scenario deterministic prototype harness. The OutLayer worker signs a canonical receipt only; it does not execute attack scenarios or verify semantic claims. Local Sandbox evidence is not a Testnet deployment. No independent audit or production security guarantee is claimed.
