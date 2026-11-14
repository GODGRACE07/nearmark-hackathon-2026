# NEARMARK — MVP Implementation and Evidence Status

**Event:** NEAR HACKATHON 2026
**Product:** Early-stage security assessment and payment-control toolkit for autonomous agents on NEAR.

This document separates implemented code, partial integrations, recorded tests and planned strategy. A feature in the roadmap must not be described as shipped.

## Implemented in the current MVP

- Multi-page React/Vite application and Node.js API.
- Public NEAR account and access-key inspection through NEAR JSON-RPC.
- FullAccess/FunctionCall permission parsing and available receiver/method/allowance information.
- Owner-mandate payment policy decisions: ALLOW, WARN and BLOCK.
- Enforcement adapter checks designed to avoid Gate execution on BLOCK and require approval for WARN.
- Native NEAR Gate contract source.
- Separate NEP-141 FT Gate contract source.
- NASB-0.1 local deterministic six-scenario benchmark.
- Local Ed25519 benchmark receipt generation and verification.
- TypeScript SDK, CLI and minimal MCP server.
- Local Rust and NEAR Workspaces Sandbox test paths.
- OutLayer WASI Preview 2 receipt-signing worker source.
- NEAR AI attestation-aware inference adapter.
- NEAR Intents read-only token metadata and dry quote preview.
- Agent Market read-only service catalogue retrieval.
- Cloudflare Worker and D1 integration.

## Latest recorded local validation snapshot

Recorded during the successful local release build on 13 November 2026:

| Suite/check | Result |
|---|---:|
| Core JavaScript/backend/SDK tests | 44/44 passed |
| OutLayer receipt-verifier tests | 4/4 passed |
| Native Gate Rust tests | 10/10 passed |
| FT Gate Rust tests | 9/9 passed |
| Native Gate Sandbox smoke test | 1/1 passed |
| TypeScript check | Passed |
| Vite production build | Passed |
| API dispatch regression | Passed |

These are recorded results. They do not claim a new independent run by a judge.

## Partial functionality and integration boundaries

### Authority Shadow
Maps only known NEARMARK Gate paths when code-hash and agent/method bindings match. It does not reconstruct arbitrary third-party downstream contract behavior. Unknown paths remain unknown.

### Attack Laboratory
The current included benchmark runs six deterministic scenarios. It is not yet a general-purpose AI red-team engine, does not establish arbitrary malicious state changes, and does not include the full concurrency-testing program in the strategy.

### NASB
NASB-0.1 and local signed receipts exist. A standardized external benchmark with undisclosed test scenarios, independent reproductions, false-block measurement and public comparable passports remains future work.

### Runtime SDK/API/CLI/MCP
Initial developer interfaces exist. They do not automatically protect arbitrary agents or wallets. Protection requires the transaction to use the configured enforcement path.

### NEAR AI
An attestation-aware inference adapter exists. Prior development inference passed the recorded provider TEE verification flow. A full NEAR AI RED-driven attack-generation-to-Sandbox-execution pipeline is not claimed. Hosted operation needs supported model and credentials.

### OutLayer
The WASI worker was built. Recorded remote execution passed TDX authenticity, worker identity, execution binding and input integrity. On-chain output did not match the attested output hash. Remote output integrity is **NOT_PROVEN**. Full Agent Custody assessment and enforcement is not claimed.

### NEAR Intents
Read-only token metadata and dry quote preview only. No payment, swap, MPP or x402 execution is claimed.

### Agent Market
Read-only catalogue discovery. No published NEARMARK service, paid assignment or marketplace distribution is claimed.

### Native Gate and FT Gate deployment
Local Rust tests and local Sandbox evidence are recorded. Public Testnet/Mainnet deployment of either Gate is not claimed in this document.

## Roadmap: not shipped claims

- Complete downstream authority reconstruction for arbitrary contracts.
- AI-generated adversarial scenarios with actual controlled sandbox execution.
- Concurrency/race-condition spending tests.
- External reproducibility and undisclosed NASB evaluation suite.
- Public independent security passports and fair comparative leaderboard.
- Cross-custody testing including OutLayer Agent Custody.
- Production-grade runtime integration for arbitrary agents/wallets.
- NEAR Intents MPP/x402 payment interception and execution.
- Published Agent Market assessment service.
- Continuous monitoring and enterprise certification.

## Evidence labels

Confirmed on-chain; Sandbox-observed; Code-inferred; Unknown / not checked.

NEARMARK does not convert missing data into a positive security assertion.
