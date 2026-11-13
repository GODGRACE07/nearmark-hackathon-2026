#!/usr/bin/env bash
set -Eeuo pipefail
PROJECT="/home/grace/NEARMARK-COMPLETE-BUILD/nearmark"
OWNER="tony-nearmark-owner.testnet"
PROJECT_NAME="nearmark-nasb-receipts"
PROJECT_ID="$OWNER/$PROJECT_NAME"
WASM_DIR="$PROJECT/integrations/outlayer-worker/target/wasm32-wasip2/release"
cd "$PROJECT"
export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"
export OUTLAYER_NETWORK=testnet

mkdir -p artifacts
rm -f artifacts/nearmark-outlayer-verified.txt

for file in \
  artifacts/nearmark-final-inference.json \
  artifacts/nearmark-ft-testnet-payment.json \
  artifacts/nearmark-ft-security-regression.json \
  artifacts/nearmark-public-source-commit.txt \
  contracts/near-gate-ft/target/near/nearmark_gate_ft.wasm; do
  [[ -s "$file" ]] || { echo "STOP: required evidence/input missing: $file"; exit 1; }
done

SOURCE_COMMIT=$(tr -d '\r\n ' < artifacts/nearmark-public-source-commit.txt)
[[ "$SOURCE_COMMIT" =~ ^[0-9a-fA-F]{40}$ ]] || { echo "STOP: source commit is not a full 40-char Git SHA."; exit 1; }

FT_WASM_HASH=$(sha256sum contracts/near-gate-ft/target/near/nearmark_gate_ft.wasm | awk '{print $1}')
EXPECTED_FT_HASH="3cfea6381cff86fbb19454d1fc798503ed3669342dd28583380c173764ae5c8f"
[[ "$FT_WASM_HASH" == "$EXPECTED_FT_HASH" ]] || { echo "STOP: deployed FT Gate WASM hash changed; reconcile before receipt signing."; exit 1; }

# Six NASB-0.1 scenarios are the local deterministic harness. The nine FT
# Rust unit tests are a separate suite and must not be substituted here.
cat > artifacts/nearmark-nasb0.1-config.json <<'JSON'
{
  "suite_version": "NASB-0.1",
  "mode": "local-deterministic-six-scenario-harness",
  "scenario_count": 6,
  "scenarios": [
    "recipient-substitution",
    "legitimate-payment",
    "amount-limit",
    "permit-binding",
    "replay-protection",
    "method-restriction"
  ],
  "scope": "OutLayer worker signs a canonical receipt only; it does not execute these scenarios or verify their semantic truth.",
  "semantic_claims_verified": false
}
JSON

node --input-type=module <<'NODE'
import fs from 'node:fs';
import crypto from 'node:crypto';
const names = [
  'artifacts/nearmark-final-inference.json',
  'artifacts/nearmark-ft-testnet-payment.json',
  'artifacts/nearmark-ft-security-regression.json',
  'artifacts/NEARMARK-FINAL-RELEASE-REPORT.txt'
];
const entries = {};
for (const name of names) {
  if (!fs.existsSync(name)) throw new Error(`Missing evidence file: ${name}`);
  entries[name] = crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex');
}
const manifest = {
  schema: 'nearmark.evidence-manifest.v1',
  note: 'File-hash index only; does not make the evidence semantically verified.',
  files: entries
};
fs.writeFileSync('artifacts/nearmark-outlayer-evidence-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
NODE

CONFIG_HASH=$(sha256sum artifacts/nearmark-nasb0.1-config.json | awk '{print $1}')
EVIDENCE_HASH=$(sha256sum artifacts/nearmark-outlayer-evidence-manifest.json | awk '{print $1}')

RPC_BODY='{"jsonrpc":"2.0","id":"nearmark-outlayer-height","method":"block","params":{"finality":"final"}}'
RPC_RESPONSE=$(curl -4 -fsS --max-time 20 -H 'content-type: application/json' --data "$RPC_BODY" https://rpc.testnet.near.org || \
               curl -4 -fsS --max-time 20 -H 'content-type: application/json' --data "$RPC_BODY" https://rpc.testnet.fastnear.com)
BLOCK_HEIGHT=$(printf '%s' "$RPC_RESPONSE" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(j.error)throw Error(JSON.stringify(j.error));const h=j.result?.header?.height;if(!Number.isSafeInteger(h)||h<=0)throw Error("bad block height");console.log(h)})')

node --input-type=module - "$SOURCE_COMMIT" "$CONFIG_HASH" "$FT_WASM_HASH" "$EVIDENCE_HASH" "$BLOCK_HEIGHT" <<'NODE'
import fs from 'node:fs';
const [source_commit, config_sha256, contract_wasm_sha256, evidence_manifest_sha256, h] = process.argv.slice(2);
const input = {
  suite_version: 'NASB-0.1',
  source_commit,
  config_sha256,
  contract_wasm_sha256,
  evidence_manifest_sha256,
  block_height: Number(h),
  scenario_count: 6
};
fs.writeFileSync('artifacts/nearmark-outlayer-input.json', JSON.stringify(input, null, 2) + '\n');
console.log('Prepared OutLayer input:', JSON.stringify(input, null, 2));
NODE

mapfile -t WASMS < <(find "$WASM_DIR" -maxdepth 1 -type f -name '*.wasm' -print)
[[ "${#WASMS[@]}" -eq 1 ]] || { echo "STOP: expected exactly one WASI worker module in $WASM_DIR"; exit 1; }
WASM="${WASMS[0]}"

echo
echo "========== OUTLAYER TESTNET LOGIN =========="
if ! outlayer whoami >/dev/null 2>&1; then
  if ! command -v outlayer >/dev/null 2>&1; then
    curl -fsSL https://raw.githubusercontent.com/out-layer/outlayer-cli/main/install.sh | sh
    export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"
  fi
  outlayer login testnet
fi
outlayer whoami

echo
echo "========== UPLOAD HASH-PINNED WASM =========="
outlayer upload "$WASM" 2>&1 | tee artifacts/nearmark-outlayer-upload.log
FASTFS_URL=$(grep -Eo 'https://[^[:space:]]+\.wasm' artifacts/nearmark-outlayer-upload.log | tail -n 1 || true)
[[ -n "$FASTFS_URL" ]] || { echo "STOP: Could not extract FastFS URL. Read artifacts/nearmark-outlayer-upload.log."; exit 1; }
WASM_HASH=$(sha256sum "$WASM" | awk '{print $1}')
printf '%s\n' "$WASM_HASH" > artifacts/nearmark-outlayer-wasm-sha256.txt
printf '%s\n' "$FASTFS_URL" > artifacts/nearmark-outlayer-fastfs-url.txt

echo
echo "========== DEPLOY OUTLAYER PROJECT VERSION =========="
outlayer deploy "$PROJECT_NAME" "$FASTFS_URL" 2>&1 | tee artifacts/nearmark-outlayer-deploy.log

echo
echo "========== REMOTE TEE EXECUTION =========="
echo "Project: $PROJECT_ID"
echo "Network: Testnet"
echo "This uses the owner FullAccess key stored by OutLayer CLI to pay the execution deposit."
echo "It does NOT use the agent's restricted FT key."
echo
read -r -p "Type RUN NEARMARK OUTLAYER TESTNET: " CONFIRM
[[ "$CONFIRM" == "RUN NEARMARK OUTLAYER TESTNET" ]] || { echo "Cancelled before remote execution."; exit 0; }

# Force the on-chain Testnet path. Without PAYMENT_KEY, the CLI uses
# outlayer.testnet request_execution and receives an on-chain tx hash.
env -u PAYMENT_KEY OUTLAYER_NETWORK=testnet outlayer --json run "$PROJECT_ID" \
  --input artifacts/nearmark-outlayer-input.json \
  --deposit 0.1 2>&1 | tee artifacts/nearmark-outlayer-run.log

echo
echo "========== INDEPENDENT TDX VERIFICATION =========="
if ! command -v outlayer-verify >/dev/null 2>&1; then
  cargo install --git https://github.com/out-layer/outlayer-verify outlayer-verify
fi
read -r -p "Paste the NEAR request_execution transaction hash shown above: " TX_HASH
[[ "$TX_HASH" =~ ^[A-Za-z0-9]{40,50}$ ]] || { echo "STOP: transaction hash format invalid."; exit 1; }

outlayer-verify tx "$TX_HASH" --network testnet --bundle artifacts/nearmark-outlayer-tdx-proof.json 2>&1 | tee artifacts/nearmark-outlayer-verify.log

# Independently verify the self-contained bundle offline. Exit code 0 is the
# machine-readable proof verdict; do not grep for a particular console word.
set +e
outlayer-verify bundle artifacts/nearmark-outlayer-tdx-proof.json --offline 2>&1 | tee artifacts/nearmark-outlayer-offline-verify.log
VERIFY_STATUS=${PIPESTATUS[0]}
set -e
if [[ "$VERIFY_STATUS" -eq 0 ]]; then
  printf 'PROVEN\n' > artifacts/nearmark-outlayer-verified.txt
  echo "PASS: Independent offline TDX proof verification (exit code 0)."
else
  echo "STOP: Offline OutLayer proof verifier exit code $VERIFY_STATUS."
  exit 2
fi

cat > artifacts/nearmark-outlayer-execution-evidence.json <<JSON
{
  "project": "NEARMARK",
  "component": "OutLayer NASB-0.1 receipt signer",
  "network": "NEAR Testnet",
  "project_id": "$PROJECT_ID",
  "near_transaction_hash": "$TX_HASH",
  "wasm_sha256": "$WASM_HASH",
  "source_commit": "$SOURCE_COMMIT",
  "scenario_count": 6,
  "execution_scope": "TEE_EXECUTED_CANONICAL_RECEIPT_SIGNING_ONLY",
  "semantic_claims_verified": false,
  "independent_verification_command": "outlayer-verify tx $TX_HASH --network testnet --bundle artifacts/nearmark-outlayer-tdx-proof.json",
  "verification_bundle": "artifacts/nearmark-outlayer-tdx-proof.json",
  "verification_log": "artifacts/nearmark-outlayer-verify.log"
}
JSON

echo
echo "OUTLAYER DEPLOYMENT AND INDEPENDENT VERIFICATION COMMAND COMPLETED."
echo "Independent offline verification marker: artifacts/nearmark-outlayer-verified.txt."
