# Nearmark demo script (4–5 minutes)

## 0:00–0:30 — The problem

“An AI agent can have a restricted NEAR key and still cause dangerous downstream effects through the contract it is allowed to call. Nearmark tests what the permissions can actually do rather than treating a scoped key as proof of safety.”

## 0:30–1:30 — Authority X-Ray

1. Open `/inspect`.
2. Inspect a known public NEAR account.
3. If you have an agent public key, enter it so the assessment is attributed to that key.
4. Explain Full Access versus FunctionCall scope, receiver, method list and gas allowance.
5. Show evidence limitations. Do not infer the human who holds a private key.

## 1:30–2:30 — Counterparty check

1. Open `/counterparty`.
2. Set an owner-approved recipient and maximum amount.
3. Check the allowed recipient and show ALLOW/WARN/BLOCK reasons.
4. Change the recipient to an unapproved test account and show the mandate mismatch.
5. Explain the difference between the API's owner-mandate decision and the Gate's on-chain enforcement. The API decision alone is not a signer control.

## 2:30–3:45 — Attack Lab and benchmarks

1. Open `/lab` and run the browser's deterministic local suite. State clearly that it is a local harness.
2. In the WSL terminal, run `bash scripts/test-gate-sandbox.sh` (or show the Sandbox section of the one-click runner) to execute the separate modern NEAR Sandbox contract test.
3. Show the observed approved vendor payment and rejected attacks in the terminal log. This is local Sandbox execution, not Testnet/Mainnet.
4. If `artifacts/nearmark-testnet-evidence.json` exists from a successful release run, show the Testnet explorer transaction and the evidence file. Explain that it proves only the listed demo checks at that time.
5. Open `/benchmarks` and compare the same deterministic suite across reference profiles. Do not call the built-in reference profiles third-party wallet tests.

## 3:45–4:30 — Developer product

1. Open `/developers`.
2. Show the SDK, API and CLI source.
3. Show the optional OutLayer and NEAR AI integration controls, clearly identifying which need credentials.
4. Show the SDK's `executeThroughGate` and near-api-js adapter. Explain that the caller supplies a restricted FunctionCall signer; BLOCK never calls it and WARN requires a human approval callback.
5. Explain remaining scope honestly: browser Attack Lab and Rust Sandbox are separate; historical account/receiver evidence is incomplete; live NEAR AI `provider_tee` verification and remote OutLayer execution/proof still require provider activation. The current OutLayer worker signs a canonical receipt only; it does not execute the NASB attacks.

## Close

“Nearmark is the independent security inspection and benchmark layer for NEAR agent wallets. Inspect authority, test behavior, and publish evidence. Don't trust the permissions. Test the authority.”
