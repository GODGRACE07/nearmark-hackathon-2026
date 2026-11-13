# OutLayer integration plan

Nearmark's app includes a real, read-only OutLayer adapter at `GET /api/outlayer/inspect`.
It calls these documented endpoints using a server-side bearer key:

- `GET /wallet/v1/address?chain=near`
- `GET /wallet/v1/balance?chain=near`
- `GET /wallet/v1/policy`

Configure `OUTLAYER_API_KEY` and `OUTLAYER_API_URL=https://api.outlayer.ai` in the backend environment. The adapter does not call transfer, swap, sign, withdraw, freeze, or policy-mutation endpoints.

## TEE-backed benchmark receipt (next deployment step)

The OutLayer TEE attestation docs describe an execution attestation binding the exact WASM hash, input hash, output hash, worker measurement and Intel TDX quote. The `PROTECTED_` signing-key feature can keep an Ed25519 receipt key inside the TEE, so only the attested module can sign a benchmark receipt.

To deploy this properly:

1. Create a dedicated OutLayer project and worker; do not reuse a production custody wallet.
2. Implement a Rust WASI Preview 2 worker using `outlayer = "0.2"` and the current OutLayer SDK.
3. Declare a receipt-only signing key in the project's manifest. Bind its identity to the deployed WASM/project, not caller-controlled configuration.
4. Have the worker accept a canonical, bounded benchmark input; run or verify the deterministic suite; return a canonical receipt and its signature.
5. Fetch the execution attestation and verify the exact WASM/input/output/task binding with OutLayer's verifier.
6. Publish the receipt, attestation URL, verifier version and source/build hash.

Nearmark does **not** claim this TEE worker is deployed in this ZIP. It also does not equate a worker signature with proof that the benchmark logic itself is correct. The WASM source must be audited and reproducibly built.

Official references:
- https://app.outlayer.ai/docs/agent-custody
- https://app.outlayer.ai/docs/tee-attestation
- https://app.outlayer.ai/docs/signing-keys
- https://app.outlayer.ai/docs/sdk
