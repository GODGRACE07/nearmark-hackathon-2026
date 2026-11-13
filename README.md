# NEARMARK

**Don't trust the permissions. Test the authority.**

NEARMARK is an evidence-first security assessment and payment-enforcement toolkit for autonomous agents on NEAR. It inspects what an agent's account keys expose, checks proposed recipients against owner-defined rules, and provides a restricted on-chain Gate plus reproducible local tests.

## Product surfaces

- `/` — product overview and architecture
- `/app` — operational overview
- `/inspect` — public NEAR account/access-key inspection
- `/counterparty` — owner-mandate recipient checks
- `/lab` — deterministic local security harness
- `/benchmarks` — benchmark runs and reference-profile comparisons
- `/developers` — SDK/API/CLI/MCP documentation
- `/methodology` — evidence definitions and limitations
- `/passport/:account` — account security passport
- `/account` — Supabase sign-in and billing area when configured

## One-command Windows + WSL setup

1. Download and extract the release ZIP, or save it to Windows `Downloads`.
2. Open Ubuntu/WSL. From the WSL prompt, use the one-paste command in `START-HERE.md`.
3. The runner installs the pinned tools, validates the project, builds the application/contracts/worker, runs tests and starts the app.

The default path does not submit blockchain transactions. The native Gate Testnet flow is offered separately and requires typing exactly `DEPLOY TESTNET` after the checks pass.

## Requirements / pinned build versions

- Node.js 24.22.1 (required by the integrated NEAR AI JS SDK)
- Rust 1.95.0 for NEAR Gate builds
- `wasm32-unknown-unknown` for NEAR contracts
- `wasm32-wasip2` for the OutLayer worker
- `near` CLI and `cargo-near`

## Local development

```bash
npm ci
cp .env.example .env
# Add any optional provider credentials to .env locally.
npm run dev
```

Open `http://localhost:5173`. The API listens on `http://localhost:8787`.

## Validation

```bash
npm test
node --test integrations/outlayer-worker/verify-receipt.test.mjs
npm run typecheck
npm run build
```

The release runner additionally executes Rust unit tests, builds both Gate contracts and the OutLayer WASI worker, runs the native Gate NEAR Sandbox integration, and performs API/RPC smoke tests.

## Security and evidence boundaries

- Account inspection is read-only.
- The local NASB-0.1 harness is not a third-party certification.
- NEAR Sandbox execution is local controlled evidence, not a Testnet deployment.
- The OutLayer worker currently signs a canonical receipt inside its TEE; it does not execute the benchmark attacks or verify their semantics.
- NEAR AI analysis is marked model-TEE-verified only after official model attestation and `provider_tee` response-signature verification.
- FT Gate, OutLayer remote TEE execution, Supabase, Stripe and hosting require external provider configuration and activation.
- Never use Mainnet funds or keys for the hackathon demo. Never commit `.env`, private keys or seed phrases.

See [implementation status](docs/IMPLEMENTATION-STATUS.md), [Phase 2 integration notes](docs/PHASE2-INTEGRATIONS.md), [production plan](docs/PRODUCTION-PLAN.md), [demo script](docs/DEMO-SCRIPT.md), and [submission checklist](docs/HACKATHON-SUBMISSION-CHECKLIST.md).
