#!/usr/bin/env bash
set -Eeuo pipefail
: "${OUTLAYER_CALL_ID:?Set OUTLAYER_CALL_ID to the actual OutLayer execution call ID}"
: "${OUTLAYER_INPUT_JSON:?Set OUTLAYER_INPUT_JSON to a file containing the exact input JSON sent to OutLayer}"
: "${OUTLAYER_OUTPUT_JSON:?Set OUTLAYER_OUTPUT_JSON to a file containing the exact output JSON returned by OutLayer}"
[ -s "$OUTLAYER_INPUT_JSON" ] || { echo "Input JSON file is missing or empty." >&2; exit 2; }
[ -s "$OUTLAYER_OUTPUT_JSON" ] || { echo "Output JSON file is missing or empty." >&2; exit 2; }
if ! command -v outlayer-verify >/dev/null 2>&1; then
  cargo install --locked --git https://github.com/out-layer/outlayer-verify outlayer-verify
fi
BUNDLE="${OUTLAYER_PROOF_BUNDLE:-outlayer-proof-${OUTLAYER_CALL_ID}.json}"
# Testnet is explicit so a call ID is never queried against Mainnet by accident.
outlayer-verify call "$OUTLAYER_CALL_ID" --network testnet \
  --input "$OUTLAYER_INPUT_JSON" --output "$OUTLAYER_OUTPUT_JSON" --bundle "$BUNDLE"
echo "OutLayer proof bundle: $BUNDLE"
