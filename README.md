# NEARMARK
### Don't trust the permissions. Test the authority.

**NEARMARK is an early-stage security assessment and payment-control toolkit for autonomous agents on NEAR.**

It helps developers inspect an agent's public account permissions, evaluate payment requests against owner-defined rules, exercise selected security controls, and review reproducible benchmark evidence.

**Built for:** NEAR HACKATHON 2026
**Track:** AI Security & Defense
**Live application:** https://nearmark.nearmark-security.workers.dev
**Source code:** https://github.com/GODGRACE07/nearmark-hackathon-2026

> **Product status:** This repository contains a working hackathon MVP plus integrations at different maturity levels. It is not yet the complete independent security standard, universal custody layer, or comprehensive adversarial testing platform described in the long-term NEARMARK vision. This README separates implemented functionality from partial integrations and future work.

## The problem

Giving an autonomous agent a NEAR account or restricted access key does not, by itself, prove that every action the agent can trigger is safe. A permitted contract method may have effects beyond what the key's method list makes obvious. Developers also need to know whether recipient, method and spending rules are actually checked, and whether those checks can be independently reproduced.

NEARMARK addresses this problem through four connected areas: account and permission inspection, owner-mandate payment evaluation, selected contract-level enforcement, and a versioned deterministic benchmark.

## What works in this MVP

### 1. Authority Intelligence — account and key inspection

NEARMARK reads public NEAR account and access-key information through NEAR JSON-RPC. It can distinguish FullAccess and FunctionCall permissions and display available receiver, method and allowance information.

**Authority Shadow is partial.** It only maps NEARMARK Gate paths when the expected code hash and agent/method bindings match. It does not reconstruct the full downstream authority of arbitrary third-party contracts. Unverified paths must remain unknown.

### 2. Counterparty and payment policy

The policy engine evaluates proposed payment details against configured owner rules, including recipient, method and amount constraints. It returns ALLOW, WARN or BLOCK with reasons.

The execution adapter is designed to avoid calling the Gate for BLOCK decisions, and WARN requires explicit approval in the tested flow.

**Important:** an API policy response alone is not an on-chain restriction. Protection depends on the payment being routed through the configured Gate or enforcement adapter. NEARMARK does not protect every wallet or arbitrary agent automatically.

### 3. Native NEAR Gate

The Native Gate source implements checks for agent/key binding, recipient restrictions, payment and daily limits, expiry, nonce/replay protection and pause behavior.

It has Rust unit-test and local NEAR Workspaces Sandbox evidence. **A public Testnet or Mainnet deployment is not claimed in this release documentation.**

### 4. NEP-141 FT Gate

A separate fungible-token Gate source implements token-contract and recipient restrictions, U128 amount handling, expiry, nonce and pause checks.

It has local build and test evidence. **A public FT Gate deployment is not claimed.**

### 5. NASB-0.1 deterministic benchmark

The current local benchmark contains six scenarios:

1. Prompt-injected recipient substitution.
2. Legitimate owner-mandated payment.
3. Owner spending limit.
4. Transaction-bound permit.
5. Single-use nonce and replay protection.
6. Restricted method enforcement.

The recorded local run passed 6/6. It emits a locally signed Ed25519 receipt.

**What 6/6 means:** the six included deterministic cases passed in that local harness. It is not a third-party audit, proof of general wallet safety, an undisclosed red-team evaluation, or evidence that arbitrary smart contracts are safe. The demo signing key is not an OutLayer TEE key.

## Judge quickstart: do X, see Y

Requirements: Node.js 24+ and npm.

```bash
git clone https://github.com/GODGRACE07/nearmark-hackathon-2026.git
cd nearmark-hackathon-2026
npm ci
npm run check
npm run dev
```

Use the application pages:

| Route | Judge action | What to inspect |
|---|---|---|
| `/` | Read the product overview | Problem, users and product scope |
| `/app` | Open the security workspace | Available account and payment-policy workflows |
| `/lab` | Run the included benchmark | Six deterministic scenario outcomes |
| `/benchmarks` | Review benchmark results | Pass/fail evidence and suite information |
| `/developers` | Inspect developer surfaces | API, SDK, CLI and MCP information |
| `/methodology` | Review evidence methodology | Confirmed, sandbox-observed, inferred and unknown labels |

For a safe evaluation, use public account data and local test scenarios. Do not use Mainnet funds or production signing keys.

## Developer interfaces

The repository includes a Node.js API, TypeScript SDK, CLI and a minimal MCP server. Treat these as the current developer interfaces, not as a claim that a mature, independently audited public SDK package has been published to a package registry.

## NEAR tools and ecosystem integrations

| Technology | Current use | Status boundary |
|---|---|---|
| NEAR Protocol | Accounts, access keys and contracts | Core network |
| NEAR JSON-RPC | Public account/key inspection | Read-only inspection |
| FunctionCall access keys | Scoped agent permissions | Inspected and checked by Gate paths |
| near-sdk-rs | Native and FT Gate contracts | Local builds/tests |
| NEAR Workspaces | Contract testing | Local Sandbox |
| near-cli-rs | NEAR development tooling | Development workflow |
| NEP-141 | Fungible-token Gate | Local implementation/tests |
| FastNear | Indexed history information | Sampled data, not complete forensic history |
| NEAR AI Inference SDK | Attestation-aware inference adapter | Credentials and supported model required |
| OutLayer SDK | WASI receipt-signing worker | Recorded remote output integrity NOT_PROVEN |
| NEAR Intents | Token metadata and dry quote preview | Read-only; no swap/settlement execution claimed |
| Agent Market | Public service catalogue discovery | Read-only; no NEARMARK listing or paid assignment claimed |

### NEAR AI and NEAR AI RED

The repository contains an attestation-aware NEAR AI inference adapter. A prior development inference passed the recorded provider TEE verification path. Hosted operation requires credentials and a supported model.

The full NEAR AI RED/cybersecurity-model-to-attack-generation-to-NEAR-Sandbox-execution pipeline described in the broader strategy is **not yet implemented as an end-to-end feature**. AI-generated hypotheses must not be represented as executed attacks.

Learn about NEAR AI's cybersecurity models and NEAR AI RED: https://near.ai/cybersecurity and https://near.ai/blog/cybersecurity-models-and-near-ai-red-launch

### OutLayer

The WASI worker was built against the OutLayer SDK. In the recorded remote execution, TDX authenticity, worker identity, execution binding and input integrity passed. The on-chain output did not match the attested output hash.

**Remote output integrity: NOT_PROVEN.** The current evidence does not establish fully verified OutLayer custody protection or independently verified benchmark output.

### NEAR Intents

The current integration is limited to read-only token metadata and dry quote preview. It does not execute swaps, settlement or agent payments.

### Agent Market

The current integration retrieves the public service catalogue. It does not establish that NEARMARK has been published as a marketplace service, hired or paid.

## Recorded local validation

The latest recorded local release build on 13 November 2026 reported:

| Check | Recorded result |
|---|---:|
| Core JavaScript/backend/SDK tests | 44/44 passed |
| OutLayer receipt-verifier tests | 4/4 passed |
| Native Gate Rust tests | 10/10 passed |
| FT Gate Rust tests | 9/9 passed |
| Native Gate Sandbox smoke test | 1/1 passed |
| TypeScript check | Passed |
| Vite production build | Passed |
| API dispatch regression | Passed |

These are recorded local results, not a claim that every judge machine has already reproduced them. Run `npm run check` and the contract commands in the runbook to re-evaluate the current checkout.

## Evidence language

NEARMARK distinguishes:
- **Confirmed on-chain:** supported by queried chain data.
- **Sandbox-observed:** observed in a controlled local contract environment.
- **Code-inferred:** derived from inspected source or configured rules.
- **Unknown / not checked:** evidence is insufficient to make a positive claim.

A local benchmark receipt proves the integrity of the included receipt payload under its local signing flow; it does not independently prove the remote execution of every benchmark step.

## What is partial or planned

The following are part of the NEARMARK strategy but are not represented as completed features in this MVP:

- Complete downstream financial-authority reconstruction for arbitrary contracts.
- A full AI-driven adversarial attack generation and actual sandbox execution pipeline.
- Concurrent spending-limit attack evaluation.
- A standardized NASB release with undisclosed evaluation scenarios and external reproductions.
- Fully independent, publicly verifiable security passports and a comparative leaderboard.
- Cross-custody benchmarking across native wallets and OutLayer Agent Custody.
- A production-wide runtime SDK that automatically protects arbitrary agents and wallets.
- Full NEAR Intents MPP/x402 payment interception and execution.
- A published, purchasable NEARMARK Agent Market service.
- Continuous production monitoring and enterprise certification.

## Security limitations

NEARMARK is an engineering prototype, not a formal audit or guarantee of wallet safety. Account inspection cannot identify the person controlling a private key. Indexed history is not complete forensic history. A policy API can be bypassed if an agent signs through an unprotected path. Local Sandbox tests do not establish public deployment. The six local NASB cases do not cover all attack classes or arbitrary contract behavior.

## Repository map

| Path | Purpose |
|---|---|
| `src/` | Frontend application |
| `server/` | API, account inspection and policy logic |
| `packages/sdk/` | TypeScript SDK |
| `packages/cli/` | CLI |
| `packages/mcp/` | MCP server |
| `contracts/near-gate/` | Native NEAR Gate |
| `contracts/near-gate-ft/` | NEP-141 FT Gate |
| `integrations/outlayer-worker/` | OutLayer WASI worker |
| `cloudflare/` | Cloudflare Worker integration |
| `scripts/` | Build, test and deployment scripts |
| `docs/` | Judge runbooks, methodology and proof records |

## Hackathon

Built for NEAR HACKATHON 2026. NEARMARK's current MVP focuses on account authority inspection, owner-mandate payment checks, local Gate testing and reproducible NASB-0.1 scenarios. The longer-term direction is an independent security benchmark, passport and runtime protection platform for the NEAR agent ecosystem.

License: see `LICENSE`.
