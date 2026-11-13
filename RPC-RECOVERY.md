# NEARMARK RPC recovery patch

The previous one-click run passed frontend build, backend/SDK tests, Rust tests, Gate WASM build and local Sandbox execution, then stopped at the live account-inspection HTTP smoke test with HTTP 500.

This patch does not assume the root cause. It makes the read-only NEAR RPC layer resilient to a provider-specific failure and ensures the next smoke-test failure prints the API's JSON error body.

## Changes

- `server/near.mjs` tries the configured primary RPC, an optional `NEAR_RPC_FALLBACK_URL`, and network-matched public RPC defaults.
- `NEAR_RPC_FALLBACK_URL` defaults to the Testnet FastNear RPC in `.env.example` and the one-click Testnet runner.
- `scripts/http-smoke.mjs` now prints the response body when `/api/inspect` fails, rather than hiding the server's actual error message.
- Two regression tests cover primary-provider failure and readable all-provider failure. The backend/SDK test suite now has 27 tests.

The fallback logic is read-only and network-aware. It does not sign or submit transactions. The release runner continues to force Testnet.

## Apply

Extract this release ZIP over the existing `Nearmark` project directory. Do not delete the existing `.env`, credentials, `artifacts`, or verification logs.

Then run `bash scripts/NEARMARK-ONE-CLICK.sh` from the project directory. The script will rerun checks and will stop before Testnet deployment unless you explicitly type `DEPLOY TESTNET`.
