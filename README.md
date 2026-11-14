# NEARMARK
### Measure what an autonomous agent can actually do with money.

NEARMARK is an evidence-first security assessment and payment-enforcement toolkit for autonomous agents on NEAR.

**Built for:** NEAR HACKATHON 2026 — Track 06: AI Security & Defense
**Live app:** https://nearmark.nearmark-security.workers.dev
**Repository:** https://github.com/GODGRACE07/nearmark-hackathon-2026

## Run locally
Node.js 24+ and npm:
```bash
git clone https://github.com/GODGRACE07/nearmark-hackathon-2026.git
cd nearmark-hackathon-2026
npm ci
npm run check
npm run dev
```

## Judge walkthrough
`/` product overview · `/app` security workspace · `/lab` attack scenarios · `/benchmarks` NASB results · `/developers` SDK/API/CLI/MCP · `/methodology` evidence and limitations.

## Product
**Authority Intelligence** reads public NEAR account and access-key data through NEAR JSON-RPC. It distinguishes FullAccess and FunctionCall permissions, receiver, methods and allowance. FastNear indexed history is sampled, not complete forensic history.

**Counterparty Policy Engine** evaluates recipient, method and exact amount against owner-defined rules, returning ALLOW, WARN or BLOCK with reasons. An API decision alone does not stop transactions signed outside the Gate.

**Native NEAR Gate** implements agent/key binding, recipient limits, per-payment and daily caps, expiry, single-use nonce and emergency pause. Recorded local Rust and NEAR Workspaces Sandbox tests exist; public deployment is not claimed.

**NEP-141 FT Gate** includes token allowlists, recipient restrictions, U128 amount handling, expiry, nonce and pause controls. Built/tested locally; public deployment is not claimed.

**NASB-0.1** covers recipient substitution, legitimate payment, amount limit, permit binding, replay protection and restricted method. The recorded local deterministic run passed six of six. This proves included scenarios only, not general wallet safety or independent certification.

## NEAR tools and integrations

| Tool | Use | Evidence boundary |
|---|---|---|
| NEAR Protocol / JSON-RPC | Accounts, keys, contracts, read-only inspection | Core network/read-only |
| FunctionCall access keys | Restricted agent authority | Gate checks |
| NEAR Rust SDK / NEAR Workspaces | Contracts and Sandbox tests | Local tests |
| near-cli-rs | Development tooling | Development |
| NEP-141 | FT Gate | Local implementation |
| FastNear | Indexed history | Sampled information |
| NEAR AI Inference SDK | Attestation-aware inference | Credentials/model required |
| OutLayer SDK | WASI receipt-signing worker | Remote output integrity NOT_PROVEN |
| NEAR Intents | Token metadata and dry quote | Read-only, no execution |
| Agent Market | Service catalogue | Read-only, no listing claimed |

NEAR AI: a previous development inference passed the recorded `provider_tee` verification path; hosted use requires credentials and a supported model.

OutLayer: recorded TDX authenticity, worker identity, execution binding and input integrity checks passed. On-chain output did not match the attested hash. **Remote output integrity is NOT_PROVEN.**

NEAR Intents does not execute swaps or payments. Agent Market catalogue discovery is not a published NEARMARK listing or paid assignment.

Ecosystem acknowledgement: NEAR AI, OutLayer, NEAR Intents and Agent Market are tools used or explored. This is not a claim of cash sponsorship, endorsement or certification.

## Recorded local validation (13 Nov 2026)
Core JS/backend/SDK 44/44; OutLayer verifier 4/4; Native Gate Rust 10/10; FT Gate Rust 9/9; Native Gate Sandbox 1/1; TypeScript, Vite and API dispatch checks passed. These are recorded local results; rerun `npm run check` and contract tests to reproduce.

## Evidence and limitations
Evidence labels: confirmed on-chain, Sandbox-observed, code-inferred, unknown. No complete downstream call graph, third-party audit, general wallet-safety guarantee, public Gate deployment, FT Gate deployment or independently verified OutLayer output is claimed. A policy API decision alone is not on-chain enforcement.

## Judge evaluation guide

Install and run:
```bash
npm ci
npm run check
npm run dev
```

### Evaluate the product
1. Open `/inspect` and inspect a public NEAR account.
2. Review FullAccess and FunctionCall permissions.
3. Open `/counterparty` and test an approved payment.
4. Change the recipient to an unauthorized address and inspect the BLOCK reason.
5. Open `/lab` and run the six deterministic security scenarios.
6. Open `/benchmarks` and review individual results.
7. Open `/developers` to inspect SDK, API, CLI and MCP interfaces.
8. Open `/methodology` to review evidence classifications.

### NEAR ecosystem tools
NEAR Protocol, NEAR JSON-RPC, FunctionCall access keys, NEAR Rust SDK, NEAR Workspaces, near-cli-rs, NEP-141, FastNear, NEAR AI Inference SDK, OutLayer SDK, NEAR Intents and Agent Market.

NEAR AI provides attestation-aware inference. OutLayer remote output integrity remains NOT_PROVEN. NEAR Intents provides read-only metadata and dry quote preview. Agent Market provides read-only catalogue discovery.

### Security limitations
A policy API decision alone is not on-chain signer enforcement. Local Sandbox testing is not public deployment. FT Gate deployment is not claimed. NASB is not a third-party security certification.
