# NEARMARK — Complete Project Audit

Generated: 2026-11-13T07:59:14.983381+00:00

## Executive decision

**PROJECT COMPLETION: NOT YET CERTIFIED.**

Static source discovery is not proof of runtime behavior. Critical contract, attack, sandbox and integration acceptance tests must be demonstrated.

- Source files: 53
- Test files: 7
- Core features audited: 10
- Missing core source signals: 0
- Partial core source signals: 0
- Core features without targeted tests: 0

## Feature-by-feature status

### Native NEAR Gate contract

**Priority:** CRITICAL
**Status:** `SOURCE_AND_TEST_REFERENCES_FOUND_RUNTIME_UNVERIFIED`
**Signals:** 3/3

- NEAR contract SDK: FOUND
  - `scripts/nearmark-completion-audit.py`
- Contract implementation: FOUND
  - `contracts/near-gate-ft/src/lib.rs`
  - `contracts/near-gate/src/lib.rs`
  - `scripts/nearmark-completion-audit.py`
- Payment or mandate enforcement: FOUND
  - `server/outlayer-custody.mjs`
  - `server/index.mjs`
  - `server/phase2-routes.mjs`
  - `server/engine.mjs`
Test references:
- `server/phase2.test.mjs`
- `server/engine.test.mjs`
- `contracts/near-gate/tests/sandbox_smoke.rs`
- `packages/sdk/ft-gate.test.mjs`
- `packages/sdk/index.test.mjs`
- `integrations/outlayer-worker/verify-receipt.test.mjs`
- Runtime behavior: NOT CERTIFIED BY STATIC AUDIT.

### Restricted FunctionCall access key

**Priority:** CRITICAL
**Status:** `SOURCE_AND_TEST_REFERENCES_FOUND_RUNTIME_UNVERIFIED`
**Signals:** 3/3

- FunctionCall permissions: FOUND
  - `server/near.mjs`
  - `server/engine.mjs`
  - `contracts/near-gate-ft/src/lib.rs`
  - `contracts/near-gate/near-api-js-integration/testnet-smoke.mjs`
- Restricted receiver or methods: FOUND
  - `server/near.mjs`
  - `contracts/near-gate-ft/src/lib.rs`
  - `contracts/near-gate/near-api-js-integration/testnet-smoke.mjs`
  - `contracts/near-gate/near-api-js-integration/adapter-smoke.mjs`
- Access-key inspection: FOUND
  - `server/near.mjs`
  - `server/index.mjs`
  - `contracts/near-gate/sandbox/sandbox.mjs`
  - `packages/mcp/server.mjs`
Test references:
- `server/engine.test.mjs`
- `contracts/near-gate/tests/sandbox_smoke.rs`
- `packages/sdk/ft-gate.test.mjs`
- `packages/sdk/index.test.mjs`
- Runtime behavior: NOT CERTIFIED BY STATIC AUDIT.

### Authority Intelligence

**Priority:** CRITICAL
**Status:** `SOURCE_AND_TEST_REFERENCES_FOUND_RUNTIME_UNVERIFIED`
**Signals:** 3/3

- Access-key inspection: FOUND
  - `server/near.mjs`
  - `scripts/nearmark-completion-audit.py`
  - `scripts/near-testnet-rpc.mjs`
- Permission classification: FOUND
  - `server/near.mjs`
  - `server/engine.mjs`
  - `contracts/near-gate-ft/src/lib.rs`
  - `contracts/near-gate/near-api-js-integration/testnet-smoke.mjs`
- Authority analysis: FOUND
  - `server/near.mjs`
  - `server/index.mjs`
  - `contracts/near-gate/sandbox/sandbox.mjs`
  - `packages/mcp/server.mjs`
Test references:
- `contracts/near-gate/tests/sandbox_smoke.rs`
- Runtime behavior: NOT CERTIFIED BY STATIC AUDIT.

### Counterparty Intelligence

**Priority:** CRITICAL
**Status:** `SOURCE_AND_TEST_REFERENCES_FOUND_RUNTIME_UNVERIFIED`
**Signals:** 3/3

- Counterparty assessment: FOUND
  - `server/index.mjs`
  - `server/engine.mjs`
  - `packages/mcp/server.mjs`
  - `packages/cli/index.mjs`
- Decision states: FOUND
  - `server/near.mjs`
  - `server/outlayer-custody.mjs`
  - `server/index.mjs`
  - `server/near-ai-tee.mjs`
- Evidence and reasons: FOUND
  - `server/outlayer-custody.mjs`
  - `server/index.mjs`
  - `server/near-ai-tee.mjs`
  - `server/engine.mjs`
Test references:
- `server/phase2.test.mjs`
- `server/near.test.mjs`
- `server/engine.test.mjs`
- `contracts/near-gate/tests/sandbox_smoke.rs`
- `packages/sdk/ft-gate.test.mjs`
- `packages/sdk/index.test.mjs`
- `integrations/outlayer-worker/verify-receipt.test.mjs`
- Runtime behavior: NOT CERTIFIED BY STATIC AUDIT.

### Agent-side runtime security guard

**Priority:** CRITICAL
**Status:** `SOURCE_AND_TEST_REFERENCES_FOUND_RUNTIME_UNVERIFIED`
**Signals:** 3/3

- Transaction signing integration: FOUND
  - `scripts/nearmark-completion-audit.py`
- Decision enforcement: FOUND
  - `server/near.mjs`
  - `server/outlayer-custody.mjs`
  - `server/index.mjs`
  - `server/engine.mjs`
- Human approval: FOUND
  - `server/engine.mjs`
  - `packages/sdk/index.mjs`
  - `scripts/nearmark-completion-audit.py`
  - `src/pages/Developers.tsx`
Test references:
- `server/phase2.test.mjs`
- `server/near.test.mjs`
- `server/engine.test.mjs`
- `contracts/near-gate/tests/sandbox_smoke.rs`
- `packages/sdk/ft-gate.test.mjs`
- `packages/sdk/index.test.mjs`
- `integrations/outlayer-worker/verify-receipt.test.mjs`
- Runtime behavior: NOT CERTIFIED BY STATIC AUDIT.

### Prompt-injection Attack Laboratory

**Priority:** CRITICAL
**Status:** `SOURCE_AND_TEST_REFERENCES_FOUND_RUNTIME_UNVERIFIED`
**Signals:** 3/3

- Prompt-injection scenario: FOUND
  - `server/engine.mjs`
  - `contracts/near-gate-ft/src/lib.rs`
  - `contracts/near-gate/near-api-js-integration/testnet-smoke.mjs`
  - `contracts/near-gate/sandbox/sandbox.mjs`
- Malicious payment or recipient: FOUND
  - `scripts/nearmark-completion-audit.py`
  - `src/pages/Counterparty.tsx`
  - `src/pages/Methodology.tsx`
- Attack execution evidence: FOUND
  - `src/pages/Account.tsx`
  - `src/pages/Methodology.tsx`
  - `src/pages/Landing.tsx`
Test references:
- `server/phase2.test.mjs`
- `server/engine.test.mjs`
- `contracts/near-gate/tests/sandbox_smoke.rs`
- `packages/sdk/ft-gate.test.mjs`
- `packages/sdk/index.test.mjs`
- Runtime behavior: NOT CERTIFIED BY STATIC AUDIT.

### Real NEAR Sandbox execution

**Priority:** CRITICAL
**Status:** `SOURCE_AND_TEST_REFERENCES_FOUND_RUNTIME_UNVERIFIED`
**Signals:** 3/3

- Sandbox dependency: FOUND
  - `contracts/near-gate/sandbox/sandbox.mjs`
  - `scripts/nearmark-completion-audit.py`
- Sandbox execution: FOUND
  - `contracts/near-gate/sandbox/sandbox.mjs`
  - `contracts/near-gate/src/lib.rs`
  - `scripts/nearmark-completion-audit.py`
  - `src/pages/Methodology.tsx`
- State verification: FOUND
  - `server/outlayer-custody.mjs`
  - `server/index.mjs`
  - `contracts/near-gate/near-api-js-integration/testnet-smoke.mjs`
  - `scripts/nearmark-completion-audit.py`
Test references:
- `server/engine.test.mjs`
- `contracts/near-gate/tests/sandbox_smoke.rs`
- `packages/sdk/ft-gate.test.mjs`
- `packages/sdk/index.test.mjs`
- `integrations/outlayer-worker/verify-receipt.test.mjs`
- Runtime behavior: NOT CERTIFIED BY STATIC AUDIT.

### NASB-1 reproducible security benchmark

**Priority:** CRITICAL
**Status:** `SOURCE_AND_TEST_REFERENCES_FOUND_RUNTIME_UNVERIFIED`
**Signals:** 3/3

- Benchmark specification: FOUND
  - `scripts/nearmark-completion-audit.py`
- Versioned test suite: FOUND
  - `server/index.mjs`
  - `server/engine.mjs`
  - `scripts/nearmark-completion-audit.py`
  - `src/pages/Benchmarks.tsx`
- Evidence and reproducibility: FOUND
  - `server/engine.mjs`
  - `contracts/near-gate/near-api-js-integration/testnet-smoke.mjs`
  - `contracts/near-gate/src/lib.rs`
  - `scripts/verify-near-ai-tee.mjs`
Test references:
- `server/engine.test.mjs`
- `contracts/near-gate/tests/sandbox_smoke.rs`
- `integrations/outlayer-worker/verify-receipt.test.mjs`
- Runtime behavior: NOT CERTIFIED BY STATIC AUDIT.

### Public TypeScript SDK

**Priority:** HIGH
**Status:** `SOURCE_AND_TEST_REFERENCES_FOUND_RUNTIME_UNVERIFIED`
**Signals:** 3/3

- SDK implementation: FOUND
  - `packages/sdk/index.d.ts`
  - `packages/sdk/index.mjs`
  - `scripts/nearmark-completion-audit.py`
  - `src/pages/Developers.tsx`
- Wallet inspection API: FOUND
  - `scripts/nearmark-completion-audit.py`
- Counterparty API: FOUND
  - `packages/sdk/index.d.ts`
  - `packages/sdk/index.mjs`
  - `scripts/nearmark-completion-audit.py`
  - `src/pages/Developers.tsx`
Test references:
- `server/phase2.test.mjs`
- `packages/sdk/ft-gate.test.mjs`
- `packages/sdk/index.test.mjs`
- Runtime behavior: NOT CERTIFIED BY STATIC AUDIT.

### Nearmark REST API

**Priority:** HIGH
**Status:** `SOURCE_AND_TEST_REFERENCES_FOUND_RUNTIME_UNVERIFIED`
**Signals:** 3/3

- Wallet inspection endpoint: FOUND
  - `scripts/nearmark-completion-audit.py`
- Counterparty endpoint: FOUND
  - `scripts/nearmark-completion-audit.py`
- Benchmark or passport endpoint: FOUND
  - `scripts/nearmark-completion-audit.py`
Test references:
- `server/phase2.test.mjs`
- `server/near.test.mjs`
- `packages/sdk/ft-gate.test.mjs`
- `packages/sdk/index.test.mjs`
- Runtime behavior: NOT CERTIFIED BY STATIC AUDIT.

### Developer CLI

**Priority:** MEDIUM
**Status:** `SOURCE_AND_TEST_REFERENCES_FOUND_RUNTIME_UNVERIFIED`
**Signals:** 2/2

- CLI framework: FOUND
  - `server/index.mjs`
  - `server/near-ai-tee.mjs`
  - `scripts/verify-near-ai-tee.mjs`
  - `scripts/nearmark-completion-audit.py`
- CLI commands: FOUND
  - `server/near.mjs`
  - `server/outlayer-custody.mjs`
  - `server/index.mjs`
  - `server/phase2-routes.mjs`
Test references:
- `server/phase2.test.mjs`
- `packages/sdk/ft-gate.test.mjs`
- `packages/sdk/index.test.mjs`
- Runtime behavior: NOT CERTIFIED BY STATIC AUDIT.

### Restricted MCP server

**Priority:** MEDIUM
**Status:** `SOURCE_REFERENCES_FOUND_TESTS_NOT_FOUND`
**Signals:** 2/2

- MCP implementation: FOUND
  - `scripts/nearmark-completion-audit.py`
- Tool registration: FOUND
  - `scripts/nearmark-completion-audit.py`
- No targeted test-file reference found.
- Runtime behavior: NOT CERTIFIED BY STATIC AUDIT.

### OutLayer Agent Custody

**Priority:** HIGH
**Status:** `SOURCE_AND_TEST_REFERENCES_FOUND_RUNTIME_UNVERIFIED`
**Signals:** 3/3

- OutLayer integration: FOUND
  - `server/outlayer-custody.mjs`
  - `server/index.mjs`
  - `server/phase2-routes.mjs`
  - `server/engine.mjs`
- Policy and audit inspection: FOUND
  - `server/outlayer-custody.mjs`
  - `server/index.mjs`
  - `scripts/nearmark-completion-audit.py`
- Custody controls: FOUND
  - `server/engine.mjs`
  - `contracts/near-gate-ft/src/lib.rs`
  - `contracts/near-gate/sandbox/sandbox.mjs`
  - `contracts/near-gate/src/lib.rs`
Test references:
- `server/phase2.test.mjs`
- `packages/sdk/ft-gate.test.mjs`
- `packages/sdk/index.test.mjs`
- `integrations/outlayer-worker/verify-receipt.test.mjs`
- Runtime behavior: NOT CERTIFIED BY STATIC AUDIT.

### OutLayer TEE benchmark receipts

**Priority:** HIGH
**Status:** `SOURCE_AND_TEST_REFERENCES_FOUND_RUNTIME_UNVERIFIED`
**Signals:** 3/3

- OutLayer integration: FOUND
  - `server/outlayer-custody.mjs`
  - `server/index.mjs`
  - `server/phase2-routes.mjs`
  - `server/engine.mjs`
- TEE or WASI worker: FOUND
  - `server/index.mjs`
  - `server/phase2-routes.mjs`
  - `server/near-ai-tee.mjs`
  - `server/engine.mjs`
- Receipt or signing verification: FOUND
  - `server/outlayer-custody.mjs`
  - `server/index.mjs`
  - `server/phase2-routes.mjs`
  - `server/near-ai-tee.mjs`
Test references:
- `server/phase2.test.mjs`
- `server/engine.test.mjs`
- `packages/sdk/index.test.mjs`
- `integrations/outlayer-worker/verify-receipt.test.mjs`
- Runtime behavior: NOT CERTIFIED BY STATIC AUDIT.

### NEAR AI TEE verification

**Priority:** HIGH
**Status:** `SOURCE_AND_TEST_REFERENCES_FOUND_RUNTIME_UNVERIFIED`
**Signals:** 3/3

- Official NEAR AI SDK: FOUND
  - `server/near-ai-tee.mjs`
  - `scripts/verify-near-ai-tee.mjs`
  - `scripts/nearmark-completion-audit.py`
- Model verification: FOUND
  - `scripts/nearmark-completion-audit.py`
- Gateway verification: FOUND
  - `scripts/nearmark-completion-audit.py`
Test references:
- `server/phase2.test.mjs`
- `integrations/outlayer-worker/verify-receipt.test.mjs`
- Runtime behavior: NOT CERTIFIED BY STATIC AUDIT.

### NEAR AI RED adversarial testing

**Priority:** MEDIUM
**Status:** `SOURCE_AND_TEST_REFERENCES_FOUND_RUNTIME_UNVERIFIED`
**Signals:** 2/2

- RED or cybersecurity model integration: FOUND
  - `scripts/nearmark-completion-audit.py`
  - `src/pages/Lab.tsx`
- Adversarial generation: FOUND
  - `scripts/nearmark-completion-audit.py`
  - `src/pages/Lab.tsx`
  - `src/pages/Landing.tsx`
Test references:
- `server/phase2.test.mjs`
- `server/near.test.mjs`
- `packages/sdk/ft-gate.test.mjs`
- `packages/sdk/index.test.mjs`
- `integrations/outlayer-worker/verify-receipt.test.mjs`
- Runtime behavior: NOT CERTIFIED BY STATIC AUDIT.

### Evidence-backed security passports

**Priority:** HIGH
**Status:** `SOURCE_AND_TEST_REFERENCES_FOUND_RUNTIME_UNVERIFIED`
**Signals:** 3/3

- Security passport implementation: FOUND
  - `scripts/nearmark-completion-audit.py`
  - `src/App.tsx`
  - `src/pages/Inspector.tsx`
  - `src/pages/Landing.tsx`
- Evidence integrity: FOUND
  - `server/engine.mjs`
  - `contracts/near-gate/near-api-js-integration/testnet-smoke.mjs`
  - `scripts/verify-near-ai-tee.mjs`
  - `scripts/nearmark-completion-audit.py`
- Verification or signature: FOUND
  - `server/phase2-routes.mjs`
  - `server/near-ai-tee.mjs`
  - `server/engine.mjs`
  - `contracts/near-gate/sandbox/sandbox.mjs`
Test references:
- `server/near.test.mjs`
- `packages/sdk/index.test.mjs`
- `integrations/outlayer-worker/verify-receipt.test.mjs`
- Runtime behavior: NOT CERTIFIED BY STATIC AUDIT.

## Automated execution results

- **check**: `NOT_CONFIGURED`
- **test**: `PASS`
  - Log: `logs/final-audit/test.log`
- **build**: `PASS`
  - Log: `logs/final-audit/build.log`

## TEE verification

- Status: `EVIDENCE_RETRIEVAL_OBSERVED_CRYPTOGRAPHIC_INTEGRATION_REQUIRES_FINAL_VALIDATION`
- Raw evidence retrieval is not equivalent to cryptographic verification.
- Deployment measurement allowlisting still requires a real policy.
- Model response signature verification must be separately demonstrated.

## Submission readiness

- **gitRepository:** false
- **remoteConfigured:** false
- **remoteVisibility:** "MUST_BE_CONFIRMED_PUBLIC"
- **readmeExists:** true
- **readmeInstallInstructions:** true
- **readmeRunInstructions:** true
- **readmeDemoInstructions:** true
- **envFileTrackedByGit:** false
- **envIgnoredByGit:** false
- **envPatternInGitignore:** true
- **deploymentConfigurationFound:** []
- **xDemoPost:** "MANUAL_CONFIRMATION_REQUIRED"
- **mainnetPayoutAccount:** "MANUAL_CONFIRMATION_REQUIRED"
- **allRelevantTracksSelected:** "MANUAL_CONFIRMATION_REQUIRED"
- **gitHistorySecretScan:** "NOT_PERFORMED"

## Remaining work — prioritized

1. **HIGH** — Configure and run project check: check.
2. **CRITICAL** — Demonstrate a real FunctionCall key restricted to one Gate contract.
3. **CRITICAL** — Run the prompt-injection attack and record proof that the forbidden transfer did not occur.
4. **HIGH** — Reproduce NASB-1 results from a clean environment.
5. **HIGH** — Verify OutLayer custody and TEE claims against actual API/attestation evidence.
6. **HIGH** — Complete NEAR AI cryptographic verification and response-signature testing.
7. **HIGH** — Verify public GitHub repository, secret-free Git history and reproducible README instructions.
8. **HIGH** — Confirm the live demo video/screenshots, X post, selected tracks and payout account.

## Security acceptance criteria

1. A FunctionCall access key is restricted to the Gate contract.
2. FullAccess is not given to the autonomous agent.
3. Counterparty checks return ALLOW, WARN or BLOCK with evidence.
4. BLOCK prevents transaction signing.
5. WARN requires human approval.
6. Prompt injection cannot redirect protected funds.
7. The test verifies actual sandbox state and transaction receipts.
8. NASB-1 results can be independently reproduced.
9. Secrets are absent from the public repository and Git history.

Static source matches are discovery clues, not proof of feature completion.

Audit SHA-256: `0e9196ebdab64c5ce3f220a279c73134b0a1d870d756645e4b19c95bee7c7370`
