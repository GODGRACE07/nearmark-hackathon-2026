# NEAR AI Cloud verification integration

The backend can list models and run a model completion when `NEAR_AI_API_KEY` and (optionally) `NEAR_AI_MODEL` are configured. The model output is displayed as assistant analysis only.

The current `/api/near-ai/analyze` endpoint intentionally does **not** mark responses as TEE-verified. For a verified result, integrate the official verifier:

https://github.com/nearai/nearai-cloud-verifier

The official verifier supports fresh nonce-based model/gateway attestation checks, Intel TDX quote verification, model/GPU evidence where present, and response-signature/request-hash/response-hash checks. Follow the repository's current installation and supported-model instructions; do not hand-roll an attestation badge.

Suggested production workflow:

1. Select a TEE-hosted model from the live `/v1/models` response.
2. Generate a fresh cryptographically random nonce.
3. Request the attestation report with the supported nonce flow.
4. Run the official model/gateway attestation verifier.
5. For a chat result, fetch the response signature and verify the request/response binding as documented by the official verifier.
6. Store only the verification result, public evidence links and necessary hashes; do not retain the confidential test input.
7. Show separate states for Gateway verified, model verified, response signature verified, and source-data freshness.

A TEE proves properties about the execution environment and cryptographic bindings. It does not prove the model's conclusion is correct or that an agent wallet is safe.
