# NEARMARK — AI and Human Judge Runbook

## What this MVP does

NEARMARK inspects public NEAR account/access-key data, evaluates payment proposals against owner-defined recipient/method/amount rules, provides a Native Gate and FT Gate codebase with local tests, and runs six included NASB-0.1 deterministic scenarios.

It is not yet a complete AI red-team engine or independent security-certification standard.

## Install and test

```bash
git clone https://github.com/GODGRACE07/nearmark-hackathon-2026.git
cd nearmark-hackathon-2026
npm ci
npm run check
npm run dev
```

## Judge walkthrough

1. `/` — review the problem and product scope.
2. `/app` — open the security workspace and inspect available account/payment workflows.
3. `/lab` — run the six included deterministic NASB scenarios.
4. `/benchmarks` — inspect scenario-level results.
5. `/developers` — review available API, SDK, CLI and MCP interfaces.
6. `/methodology` — review evidence classifications and limitations.

## What a 6/6 result means

The six included local cases passed: recipient substitution, legitimate payment, amount limit, permit binding, replay protection and restricted method. This is not a third-party audit, proof of general wallet safety or an independently reproduced benchmark.

## Contract tests

Where Rust and NEAR Sandbox are installed:

```bash
cargo test --manifest-path contracts/near-gate/Cargo.toml
cargo test --manifest-path contracts/near-gate-ft/Cargo.toml
bash scripts/test-gate-sandbox.sh
```

These are local test commands, not deployment instructions.

## Integration boundaries

- Authority Shadow: known, code-hash-matched NEARMARK Gate paths only.
- NEAR AI: attestation-aware adapter; not a complete RED-to-Sandbox attack pipeline.
- OutLayer: remote output integrity NOT_PROVEN.
- NEAR Intents: read-only metadata/dry quote.
- Agent Market: read-only catalogue discovery.
- Native/FT Gate: local tests; public deployment not claimed.

An API policy decision alone is not on-chain signer enforcement.
