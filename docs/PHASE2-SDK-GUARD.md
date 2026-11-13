# Phase 2 — Agent-side Gate guard

## What was added

- `NearmarkClient.executeThroughGate()` runs the ALLOW/WARN/BLOCK check and binds the decision to the requested recipient and amount.
- BLOCK stops before signer invocation. WARN stops unless the caller's human approval callback returns true.
- The wrapper inspects the specified agent public key and requires one FunctionCall access key scoped to exactly the configured Gate and `execute_payment`.
- It reads the Gate's live state and fails closed on identity mismatch, malformed pause state, paused Gate, recipient mismatch, per-payment cap, daily remaining budget or malformed nonce.
- NEAR decimals are converted to yoctoNEAR using `BigInt`; no floating-point rounding is used.
- `createNearApiJsGateAdapter()` adapts a caller-created near-api-js `Account` plus provider. The adapter's only write call is `execute_payment`, with zero attached deposit and fixed Gate receiver/method.
- SDK tests now run as part of `npm test`.

## Verified in the patch workspace

- Node test suite: 25 passed, 0 failed (16 SDK guard tests plus 9 existing API/engine tests).
- JavaScript syntax checks: passed.
- SDK declaration file checked in isolation with TypeScript strict mode: passed.

The copied patch workspace does not contain the full installed Vite/React dependencies, so a full Vite build was not rerun in that copy. The user's actual WSL environment had previously passed TypeScript and Vite build before this SDK-only change; rerun them after applying the patch.

## Trust boundary

The SDK does not read or store a secret key. The integration caller constructs the near-api-js `Account` with the FunctionCall secret and keeps that secret outside the browser and Nearmark API. The on-chain Gate is the final control. A caller can bypass the SDK, so the Gate's owner-controlled allowlist/caps/nonce checks remain essential. This adapter convenience is not an independent proof of which private key its `Account` contains; NEAR protocol authorization is decisive when the transaction is submitted.

No Testnet/Mainnet deployment, TEE attestation or independent audit is claimed.
