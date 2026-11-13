#!/usr/bin/env bash
set -Eeuo pipefail

CONTRACT="$(cd "$(dirname "$0")/../contracts/near-gate" && pwd)"
cd "$CONTRACT"

export PATH="$HOME/.cargo/bin:$PATH"

echo "Building official NEARMARK Gate WASM..."

cargo +1.95.0 near build non-reproducible-wasm --no-abi

WASM="$CONTRACT/target/near/nearmark_gate.wasm"

if [ ! -s "$WASM" ]; then
    echo "ERROR: Official cargo-near WASM not found."
    exit 1
fi

echo ""
echo "Verified WASM:"
ls -lh "$WASM"
sha256sum "$WASM"

export NEARMARK_GATE_WASM="$WASM"
export NEAR_RPC_TIMEOUT_SECS=60

echo ""
echo "Running modern NEAR Sandbox integration..."

cargo +1.95.0 test --test sandbox_smoke -- --nocapture

echo ""
echo "PASS: NEAR Sandbox security integration."
