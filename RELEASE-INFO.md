# NEARMARK release bundle — 12 November 2026

This archive is the consolidated root application package built from the supplied `Nearmark-slim.zip` source. It removes duplicate historical copies, old backup archives, runtime logs and environment backups. It keeps only blank environment templates; no `.env`, provider secret, wallet seed phrase, or generated deployment key is included.

## Packaging checks

- `npm test`: 41 passed, 0 failed (run in the packaging environment on Node 22.16.0; the integrated NEAR AI SDK and release runner require Node 24.22.1+).
- OutLayer receipt-verifier tests: 3 passed, 0 failed.
- `bash -n` passed for the maintained WSL setup, main release runner, Testnet deploy helper, Phase 2 runner and Sandbox helper.

The release runner repeats the application tests on the required Node version and performs the TypeScript/Vite build, Rust tests and builds, WASI worker build, local NEAR Sandbox integration and read-only API/Testnet smoke checks on the target WSL machine. Do not report those target-machine checks as passed until the new log says so.

## External work that cannot be auto-created by a ZIP

Provider account activation and secrets, remote OutLayer project publication and independent TEE proof, live NEAR AI `provider_tee` verification, Supabase project migration/auth/RLS, Stripe Test-mode setup, FT Gate Testnet token/storage/funding setup, hosting, public GitHub publication, X demo posting, final hackathon submission and independent security review still require owner-controlled accounts and approval. See `docs/IMPLEMENTATION-STATUS.md` and `docs/PHASE2-INTEGRATIONS.md`.
