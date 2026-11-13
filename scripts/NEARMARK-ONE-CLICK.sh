#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PATH="$HOME/.cargo/bin:$PATH"

LOG_DIR="$ROOT/verification-logs"
ARTIFACT_DIR="$ROOT/artifacts"
mkdir -p "$LOG_DIR" "$ARTIFACT_DIR"
LOG="$LOG_DIR/final-one-click-$(date -u +%Y%m%d-%H%M%S).log"
exec > >(tee "$LOG") 2>&1

fail() { echo; echo "STOPPED: $1"; echo "Log: $LOG"; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"; }

printf '\n======================================================\n'
printf ' NEARMARK — FULL LOCAL BUILD, GATE & EVIDENCE PIPELINE\n'
printf '======================================================\n'
echo "Project: $ROOT"
echo "Network lock: NEAR Testnet for read-only API smoke checks; Mainnet deployment is not supported."
echo "Log: $LOG"

need node; need npm; need curl; need sha256sum; need cargo; need rustup; need near
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<24 || (a===24 && b<22) || (a===24 && b===22 && Number(process.versions.node.split(".")[2])<1)) process.exit(1)' || fail "Node.js 24.22.1+ required; found $(node --version)."
rustup toolchain list | grep -q '^1\.95\.0' || fail 'Rust 1.95.0 toolchain is missing; rerun scripts/ONE-COMMAND-WSL.sh.'
cargo +1.95.0 near --version >/dev/null 2>&1 || fail 'cargo-near 0.23.0 is missing; rerun scripts/ONE-COMMAND-WSL.sh.'

# Create the local environment. Preserve user-provided values and never print secrets.
if [ ! -f .env ]; then cp .env.example .env; chmod 600 .env; echo 'Created private .env from .env.example.'; else chmod 600 .env; echo 'Existing .env preserved.'; fi
node scripts/prepare-env.mjs
while IFS= read -r line || [ -n "$line" ]; do
  [[ "$line" =~ ^[A-Z][A-Z0-9_]*= ]] || continue
  key="${line%%=*}"
  if ! grep -qE "^${key}=" .env; then printf '%s\n' "$line" >> .env; fi
done < .env.phase2.example
chmod 600 .env

# The build and smoke pipeline is hard-pinned to Testnet.
export NEAR_NETWORK=testnet
export NEAR_RPC_URL=https://rpc.testnet.near.org
export NEAR_RPC_FALLBACK_URL=https://rpc.testnet.fastnear.com
export FASTNEAR_TX_API=https://tx.test.fastnear.com/v0/account

printf '\n[1/11] Install locked application and integration dependencies\n'
npm ci --no-audit --no-fund || fail 'Root npm ci'
npm ci --prefix contracts/near-gate/near-api-js-integration --no-audit --no-fund || fail 'near-api-js integration npm ci'

printf '\n[2/11] Backend, SDK and FT adapter tests (41 expected)\n'
npm test || fail 'npm test'

printf '\n[3/11] OutLayer receipt verifier tests (3 expected)\n'
node --test integrations/outlayer-worker/verify-receipt.test.mjs || fail 'OutLayer receipt verifier tests'

printf '\n[4/11] TypeScript validation and Vite production build\n'
npm run typecheck || fail 'TypeScript validation'
npm run build || fail 'Vite production build'

printf '\n[5/11] Native Gate + FT Gate Rust formatting and unit tests\n'
cargo +1.95.0 fmt --check --manifest-path contracts/near-gate/Cargo.toml || fail 'Native Gate rustfmt'
cargo +1.95.0 test --lib --manifest-path contracts/near-gate/Cargo.toml || fail 'Native Gate Rust tests'
cargo +1.95.0 fmt --check --manifest-path contracts/near-gate-ft/Cargo.toml || fail 'FT Gate rustfmt'
cargo +1.95.0 test --manifest-path contracts/near-gate-ft/Cargo.toml || fail 'FT Gate Rust tests'

printf '\n[6/11] Compile native NEAR Gate WASM\n'
(cd contracts/near-gate && cargo +1.95.0 near build non-reproducible-wasm --no-abi) || fail 'Native Gate WASM build'
NATIVE_WASM="$ROOT/contracts/near-gate/target/near/nearmark_gate.wasm"
[ -s "$NATIVE_WASM" ] || fail 'Native Gate WASM artifact missing'
NATIVE_SHA="$(sha256sum "$NATIVE_WASM" | awk '{print $1}')"
echo "PASS: Native Gate WASM SHA-256 $NATIVE_SHA"

printf '\n[7/11] Compile NEP-141 FT Gate WASM\n'
(cd contracts/near-gate-ft && cargo +1.95.0 near build non-reproducible-wasm --no-abi) || fail 'FT Gate WASM build'
FT_WASM="$ROOT/contracts/near-gate-ft/target/near/nearmark_gate_ft.wasm"
[ -s "$FT_WASM" ] || fail 'FT Gate WASM artifact missing'
FT_SHA="$(sha256sum "$FT_WASM" | awk '{print $1}')"
echo "PASS: FT Gate WASM SHA-256 $FT_SHA"

printf '\n[8/11] Compile OutLayer WASI Preview 2 receipt worker\n'
rustup target add wasm32-wasip2 --toolchain stable || fail 'Install wasm32-wasip2 target'
CARGO_TARGET_DIR="$ROOT/integrations/outlayer-worker/target" cargo +stable build --manifest-path integrations/outlayer-worker/Cargo.toml --target wasm32-wasip2 --release || fail 'OutLayer WASI P2 build'
TEE_WASM="$ROOT/integrations/outlayer-worker/target/wasm32-wasip2/release/nearmark-outlayer-worker.wasm"
[ -s "$TEE_WASM" ] || fail 'OutLayer worker WASM artifact missing'
TEE_SHA="$(sha256sum "$TEE_WASM" | awk '{print $1}')"
echo "PASS: OutLayer worker WASM SHA-256 $TEE_SHA"

printf '\n[9/11] Real native Gate execution in local NEAR Sandbox\n'
export NEARMARK_GATE_WASM="$NATIVE_WASM"
export NEAR_RPC_TIMEOUT_SECS=60
cargo +1.95.0 test --manifest-path contracts/near-gate/Cargo.toml --test sandbox_smoke -- --nocapture || fail 'Native Gate NEAR Sandbox integration'

printf '\n[10/11] API, live Testnet RPC and Phase 2 status smoke checks\n'
SMOKE_PORT=18787
if curl -fsS "http://127.0.0.1:$SMOKE_PORT/api/health" >/dev/null 2>&1; then fail "Port $SMOKE_PORT is already in use."; fi
PORT="$SMOKE_PORT" node --env-file-if-exists=.env server/index.mjs > "$LOG_DIR/api-smoke.log" 2>&1 &
API_PID=$!
cleanup_api() { kill "$API_PID" >/dev/null 2>&1 || true; wait "$API_PID" 2>/dev/null || true; }
trap cleanup_api EXIT
READY=0
for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:$SMOKE_PORT/api/health" >/dev/null 2>&1; then READY=1; break; fi
  sleep 1
done
[ "$READY" -eq 1 ] || fail "Local API did not become healthy. See $LOG_DIR/api-smoke.log"
node scripts/http-smoke.mjs "http://127.0.0.1:$SMOKE_PORT" tony-nearmark-owner.testnet || fail 'Health/live inspection/benchmark smoke test'
node scripts/api-dispatch-regression.mjs "http://127.0.0.1:$SMOKE_PORT" || fail 'Sequential Phase 2/OpenAPI dispatch regression'
node scripts/api-docs-smoke.mjs "http://127.0.0.1:$SMOKE_PORT" "$ARTIFACT_DIR" || {
  echo "--- API server log ---"
  tail -n 120 "$LOG_DIR/api-smoke.log" || true
  fail 'Phase 2/OpenAPI endpoint validation'
}
cleanup_api; trap - EXIT

# Check optional provider integrations without making a paid inference call or a wallet mutation.
node --input-type=module <<'NODE' | tee "$ARTIFACT_DIR/provider-readiness.txt"
import fs from 'node:fs';
const text = fs.readFileSync('.env', 'utf8');
const val = (key) => { const m = text.match(new RegExp('^' + key + '=(.*)$', 'm')); return m ? m[1].trim() : ''; };
console.log('NEAR AI credentials:', val('NEAR_AI_API_KEY') ? 'configured; live verified inference requires authenticated app user' : 'not configured');
console.log('NEAR AI model:', val('NEAR_AI_MODEL') || 'not selected');
console.log('OutLayer API credentials:', val('OUTLAYER_API_KEY') ? 'configured; read-only/remote execution still needs project-level proof' : 'not configured');
console.log('Supabase:', val('SUPABASE_URL') && val('SUPABASE_PUBLISHABLE_KEY') ? 'configured; migration/login/RLS test still required' : 'not configured');
console.log('Stripe:', val('STRIPE_SECRET_KEY') && val('STRIPE_PRICE_ID') && val('STRIPE_WEBHOOK_SECRET') ? 'configured; use Test mode and verify webhook delivery' : 'not configured');
console.log('This run did not send a paid NEAR AI inference request, change OutLayer policy, or create a Stripe checkout.');
NODE

printf '\n[11/11] Write a non-secret release readiness report\n'
node --input-type=module - "$NATIVE_SHA" "$FT_SHA" "$TEE_SHA" <<'NODE'
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const [nativeGateSha256, ftGateSha256, outlayerWorkerSha256] = process.argv.slice(2);
const env = fs.readFileSync('.env','utf8');
const has = (key) => { const m = env.match(new RegExp('^'+key+'=(.*)$','m')); return !!(m && m[1].trim()); };
const report = {
  schema: 'nearmark.release-readiness.v1',
  generatedAt: new Date().toISOString(),
  network: 'testnet-read-only-smoke; no Mainnet path',
  localValidation: { javascriptAndSdk: 'passed (41 tests)', outlayerReceiptVerifier: 'passed (3 tests)', typescript: 'passed', viteProductionBuild: 'passed', nativeGateUnitTests: 'passed', ftGateUnitTests: 'passed', nativeGateSandbox: 'passed', apiHealthInspectionBenchmark: 'passed', nativeGateSha256, ftGateSha256, outlayerWorkerSha256 },
  externalActivation: {
    nativeGateTestnet: fs.existsSync('artifacts/nearmark-testnet-evidence.json') ? 'evidence file present; re-check transaction status before claiming deployed' : 'not deployed by this run unless separate approval flow completed',
    ftGateTestnet: 'not deployed; requires token contract, storage deposits and separate restricted key',
    outlayerRemoteTee: 'not verified by this local build; requires OutLayer project publish, real call ID and independent proof verification',
    nearAiVerifiedInference: has('NEAR_AI_API_KEY') && has('NEAR_AI_MODEL') ? 'credentials/model configured; run authenticated verified-analyze and require provider_tee' : 'credentials/model incomplete',
    supabase: has('SUPABASE_URL') && has('SUPABASE_PUBLISHABLE_KEY') && has('SUPABASE_SERVICE_ROLE_KEY') ? 'keys present; apply migration and verify auth/RLS' : 'not fully configured',
    stripe: has('STRIPE_SECRET_KEY') && has('STRIPE_PRICE_ID') && has('STRIPE_WEBHOOK_SECRET') ? 'keys present; configure webhook and test mode' : 'not fully configured',
    hosting: 'not deployed',
    publicRepositoryAndDemo: 'requires owner publication/post/submission'
  },
  limitations: ['NASB-0.1 is a six-scenario local harness, not an independent certification.', 'OutLayer worker signs receipts only; it does not execute NASB attacks or verify semantic claims.', 'Historical code-change diffs and complete downstream call graphs are not implemented.', 'Threat reports require moderation; no mature shared reputation network exists.', 'No independent security audit or production SLA is claimed.']
};
fs.mkdirSync('artifacts',{recursive:true});
fs.writeFileSync('artifacts/nearmark-release-readiness.json', JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log('Wrote artifacts/nearmark-release-readiness.json');
NODE

# Optional native Gate Testnet deployment. The operator must explicitly authorize writes.
echo
echo 'LOCAL BUILD AND SECURITY VALIDATION PASSED.'
echo 'The native Gate Testnet demo creates/reuses child accounts, installs a restricted FunctionCall key and sends one tiny Testnet payment.'
echo 'The FT Gate and OutLayer worker are built but are not automatically deployed.'
if [ "${NEARMARK_SKIP_TESTNET:-0}" = "1" ]; then
  CONFIRM=""
  echo "SKIP: Testnet write actions are disabled in this automated release run."
else
  read -r -p 'Type DEPLOY TESTNET to run the native Gate Testnet payment demo, or press Enter to skip: ' CONFIRM
fi
if [ "$CONFIRM" = 'DEPLOY TESTNET' ]; then
  NEARMARK_TESTNET_AUTHORIZED=1 bash scripts/NEARMARK-TESTNET-DEPLOY.sh || fail 'Native Gate Testnet deployment/verification'
  node --input-type=module <<'NODE'
import fs from 'node:fs';
const reportPath = 'artifacts/nearmark-release-readiness.json';
const evidencePath = 'artifacts/nearmark-testnet-evidence.json';
if (!fs.existsSync(reportPath) || !fs.existsSync(evidencePath)) throw new Error('Expected Testnet evidence/report missing.');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
report.externalActivation.nativeGateTestnet = {
  status: 'testnet-smoke-passed',
  checkedAt: evidence.checkedAt,
  gateAccount: evidence.gateId,
  agentAccount: evidence.agentId,
  vendorAccount: evidence.vendorId,
  transactionHash: evidence.approvedPayment?.transactionHash || null,
  wasmSha256: evidence.wasmSha256 || null,
  evidenceFile: evidencePath,
  note: 'Review the transaction on a Testnet explorer and preserve the JSON evidence.'
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', {mode: 0o600});
console.log('Updated readiness report with native Gate Testnet evidence.');
NODE
else
  echo 'SKIP: No Testnet writes or payments were authorized.'
fi

echo
echo '======================================================'
echo ' NEARMARK LOCAL RELEASE PIPELINE FINISHED'
echo '======================================================'
echo "Native Gate WASM: $NATIVE_SHA"
echo "FT Gate WASM: $FT_SHA"
echo "OutLayer worker WASM: $TEE_SHA"
echo "Readiness report: $ARTIFACT_DIR/nearmark-release-readiness.json"
echo "Logs: $LOG_DIR"
if [ "${NEARMARK_START_DEV:-1}" = "1" ]; then
  echo 'Starting the app at http://localhost:5173 (API: http://localhost:8787).'
  npm run dev
else
  echo 'SKIP: Development server launch disabled; full validation has returned to the caller.'
fi
