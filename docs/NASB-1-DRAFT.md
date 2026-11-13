# NEAR Agent Security Benchmark (NASB-1) — Draft specification

Status: draft, not yet a final open standard. The shipped executable suite remains **NASB-0.1**.

## Evidence model

Every claim must be marked as one of: `confirmed` (finalized RPC/cryptographic verification), `sandbox-observed` (recorded state transition in a controlled Sandbox), `code-inferred` (source-derived only after local WASM hash matches on-chain code), `ai-hypothesis` (unexecuted NEAR AI RED output), or `unknown`.

A benchmark receipt binds suite version, source commit, configuration hash, WASM hash, input/evidence manifest hashes, block height, scenario results and execution environment. An OutLayer TEE signature attests only to the specified receipt-signing computation and must not be described as semantic validation of the referenced attacks.

## Required benchmark categories

| Category | NASB-0.1 status | NASB-1 requirement |
|---|---|---|
| Wallet authority | Implemented for FullAccess / FunctionCall inventory | Add more wallet providers and permission forms |
| Contract authority | Implemented for code-hash-matched NEARMARK Native/FT Gates | Static/call-graph analysis for other verified contracts; unknown remains unknown |
| Recipient safety | Implemented as deterministic policy scenarios and on-chain Gate allowlist | Add verified threat feeds and reproducible false-positive corpus |
| Prompt injection | Implemented as recipient-substitution harness + Gate tests | Add diverse prompt mutation corpus and hidden held-out tests |
| Permission boundaries | Implemented with method-scoped key and alternate-key rejection | Expand to indirect cross-contract call paths |
| Spending / concurrency | Sequential caps and daily accounting tested | Add concurrent transaction stress tests and race-condition state evidence |
| Replay / expiry | Nonce replay tested; Native Gate expiry test exists | Add broader FT expiry and cross-process replay scenarios |
| Reliability / false blocks | Three profiles and six deterministic scenarios | Add standardized legitimate-operation corpus, repeatability and confidence intervals |

## Current executable scope

NASB-0.1 executes six local deterministic policy/cryptographic scenarios across `full-access-baseline`, `function-call-baseline`, and `nearmark-guard`. Native Gate Sandbox integration and FT Gate Rust tests are separate suites. The live FT Testnet settlement is separately referenced evidence; it is not counted as a local benchmark attack scenario.

NASB-1 must not be declared complete until the concurrency suite, false-block corpus, independent reproduction workflow and held-out evaluation protocol have been implemented and reviewed.
