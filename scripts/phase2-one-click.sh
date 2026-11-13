unset CARGO_TARGET_DIR
#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
LOG_DIR="$ROOT/verification-logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/phase2-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee "$LOG") 2>&1
fail() { echo; echo "PHASE2 STOPPED: $1"; echo "Log: $LOG"; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"; }

printf '\n====================================================\n'
printf ' NEARMARK PHASE 2 — OFFICIAL INTEGRATIONS & GATE FT\n'
printf '====================================================\n'
echo "Project: $ROOT"
echo "Network guard: Testnet only for this build pipeline"
echo "Log: $LOG"

need curl
need unzip
need sha256sum
need rustup
need cargo
rustup component add rustfmt --toolchain 1.95.0 >/dev/null || fail "Installing rustfmt for the NEAR contract toolchain"

# NEAR AI's current Node SDK needs Node 24.22.1+; install it in this WSL user profile.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then . "$NVM_DIR/nvm.sh"; fi
if ! command -v nvm >/dev/null 2>&1; then
  echo "Installing nvm into the current WSL user profile..."
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash || fail "nvm installation"
  [ -s "$NVM_DIR/nvm.sh" ] || fail "nvm script not found after installation"
  . "$NVM_DIR/nvm.sh"
fi
nvm install 24.22.1 || fail "Node.js 24.22.1 installation"
nvm use 24.22.1 || fail "Selecting Node.js 24.22.1"
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<24 || (a===24 && b<22)) process.exit(1)' || fail "NEAR AI SDK requires Node.js 24.22.1 or newer"
echo "Node: $(node --version); npm: $(npm --version)"
if grep -q '^NEAR_AI_MODEL=deepseek-ai/DeepSeek-V4.1-Flash-1017-abliterated$' .env; then
  echo "WARNING: the inherited sample NEAR_AI_MODEL may not provide model TEE attestations. Set NEAR_AI_MODEL to a model accepted by the current NEAR AI verifier before using the verified AI route."
fi

if [ ! -f .env ]; then
  [ -f .env.example ] || fail ".env.example missing"
  cp .env.example .env
  chmod 600 .env
fi
# Append only missing Phase 2 keys. Existing secrets and values are never replaced.
while IFS= read -r line || [ -n "$line" ]; do
  [[ "$line" =~ ^[A-Z][A-Z0-9_]*= ]] || continue
  key="${line%%=*}"
  if ! grep -qE "^${key}=" .env; then printf '%s\n' "$line" >> .env; fi
done < .env.phase2.example
chmod 600 .env

# Pin the production integrations in the project's root manifest and lockfile.
npm install --save @nearai/inference-sdk @supabase/supabase-js stripe --no-audit --no-fund || fail "Installing official NEAR AI, Supabase and Stripe packages"

printf '\n[1/7] JavaScript syntax checks...\n'
for file in server/index.mjs server/phase2-auth.mjs server/phase2-db.mjs server/near-ai-tee.mjs server/outlayer-custody.mjs server/phase2-routes.mjs; do
  node --check "$file" || fail "JavaScript syntax: $file"
done
echo "PASS: Phase 2 server modules parse."

printf '\n[2/7] Backend, SDK and Phase 2 safety tests...\n'
npm test || fail "npm test"
node --test integrations/outlayer-worker/verify-receipt.test.mjs || fail "OutLayer receipt signature tests"

printf '\n[3/7] TypeScript and production frontend build...\n'
npm run typecheck || fail "TypeScript validation"
npm run build || fail "Vite production build"

printf '\n[4/7] Existing native Gate regression tests...\n'
(cd contracts/near-gate && cargo +1.95.0 fmt --check) || fail "Existing Gate rustfmt"
cargo +1.95.0 test --lib --manifest-path contracts/near-gate/Cargo.toml || fail "Existing native Gate unit tests"

printf '\n[5/7] NEP-141 fungible-token Gate v0.2 tests and WASM...\n'
(cd contracts/near-gate-ft && cargo +1.95.0 fmt --check) || fail "FT Gate rustfmt"
cargo +1.95.0 test --manifest-path contracts/near-gate-ft/Cargo.toml || fail "FT Gate unit tests"
if ! cargo +1.95.0 near --version >/dev/null 2>&1; then
  cargo install cargo-near --version 0.23.0 --locked || fail "cargo-near installation"
fi
rustup target add wasm32-unknown-unknown --toolchain 1.95.0 || fail "Installing NEAR contract wasm target"
(cd contracts/near-gate-ft && cargo +1.95.0 near build non-reproducible-wasm --no-abi) || fail "Building NEP-141 Gate WASM"
FT_WASM="contracts/near-gate-ft/target/near/nearmark_gate_ft.wasm"
[ -s "$FT_WASM" ] || fail "FT Gate WASM missing at $FT_WASM"
echo "PASS: FT Gate WASM SHA-256 $(sha256sum "$FT_WASM" | awk '{print $1}')"

# Use the exact artifact directory expected by Phase 6.
export CARGO_TARGET_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/integrations/outlayer-worker/target"

printf '\n[6/7] OutLayer WASI Preview 2 receipt worker build...\n'
rustup target add wasm32-wasip2 --toolchain stable || fail "Installing wasm32-wasip2 target"
cargo +stable build --manifest-path integrations/outlayer-worker/Cargo.toml --target wasm32-wasip2 --release || fail "Building OutLayer TEE worker"
TEE_WASM="integrations/outlayer-worker/target/wasm32-wasip2/release/nearmark-outlayer-worker.wasm"
[ -s "$TEE_WASM" ] || fail "OutLayer worker WASM missing at $TEE_WASM"
echo "PASS: OutLayer worker WASM SHA-256 $(sha256sum "$TEE_WASM" | awk '{print $1}')"

printf '\n[7/7] API + integration configuration report...\n'
SMOKE_PORT=18788
if curl -fsS "http://127.0.0.1:$SMOKE_PORT/api/health" >/dev/null 2>&1; then fail "Port $SMOKE_PORT is already in use."; fi
PORT="$SMOKE_PORT" node --env-file-if-exists=.env server/index.mjs > "$LOG_DIR/phase2-api-smoke.log" 2>&1 &
API_PID=$!
cleanup_api() { kill "$API_PID" >/dev/null 2>&1 || true; wait "$API_PID" 2>/dev/null || true; }
trap cleanup_api EXIT
READY=0
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$SMOKE_PORT/api/health" >/dev/null 2>&1; then READY=1; break; fi
  sleep 1
done
[ "$READY" -eq 1 ] || fail "API failed to start; see $LOG_DIR/phase2-api-smoke.log"
node scripts/http-smoke.mjs "http://127.0.0.1:$SMOKE_PORT" || fail "Existing live NEAR API HTTP smoke test"
curl -fsS "http://127.0.0.1:$SMOKE_PORT/api/phase2/status" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(JSON.stringify(j,null,2));})'
cleanup_api
trap - EXIT

cat <<'SUMMARY'

====================================================
 NEARMARK PHASE 2 LOCAL BUILD CHECKS COMPLETED
====================================================
The following source/build checks completed in this WSL environment:
- Official NEAR AI SDK installed; verified inference endpoint added.
- Supabase Auth and user-scoped PostgreSQL persistence routes added.
- Stripe Checkout and signature-verified webhook routes added.
- OutLayer custody endpoints added with server-side allowlist, maximum and Testnet guard.
- Separate OutLayer WASI P2 receipt-signing worker compiled.
- Worker Ed25519 receipt/hash verifier tests passed (TEE quote verification remains a separate real-call step).
- Separate NEP-141 Gate contract tested and compiled.
- Existing native Gate regression tests preserved.

EXTERNAL ACTIVATION STILL REQUIRED:
1. Apply supabase/migrations/202611100001_nearmark_phase2.sql in your Supabase project.
2. Set Supabase and Stripe test-mode values in .env; set NEARMARK_REQUIRE_AUTH=true only after testing login.
3. Create an OutLayer Testnet project, publish the worker WASM, execute it, and verify a real call with scripts/verify-outlayer-call.sh.
4. Deploy the separate FT Gate to a fresh Testnet contract account; register the Gate and each recipient at the NEP-141 token contract first.
5. A TEE quote and worker signature are not a proof that benchmark claims are semantically true; the receipt explicitly states this.

NO Testnet transaction, OutLayer transfer, subscription charge or Mainnet action was initiated by this script.
SUMMARY

echo "Log: $LOG"
