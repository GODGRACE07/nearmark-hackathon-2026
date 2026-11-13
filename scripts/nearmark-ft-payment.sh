#!/usr/bin/env bash
set -Eeuo pipefail

cd /home/grace/NEARMARK-COMPLETE-BUILD/nearmark
export PATH="$HOME/.cargo/bin:$PATH"

GATE="ft-gate.tony-nearmark-owner.testnet"
AGENT="agent.tony-nearmark-owner.testnet"
OWNER="tony-nearmark-owner.testnet"
TOKEN="ft.predeployed.examples.testnet"

PUBLIC_KEY="ed25519:7ycSgHwogzitEMeNBEnqvK7bAXLCDTfVPwfAaaFzcGeX"

KEYFILE="$HOME/.near-credentials/testnet/$AGENT/ed25519_7ycSgHwogzitEMeNBEnqvK7bAXLCDTfVPwfAaaFzcGeX.json"

SOURCE="contracts/near-gate-ft/src/lib.rs"
AMOUNT="1000000000000000000000"

STATUS_FILE=$(mktemp)
trap 'rm -f "$STATUS_FILE"' EXIT

echo
echo "=========================================="
echo " NEARMARK RESTRICTED FT PAYMENT"
echo "=========================================="

# Check local prerequisites.
command -v near >/dev/null || {
  echo "ERROR: NEAR CLI not found."
  exit 1
}

[[ -s "$KEYFILE" ]] || {
  echo "ERROR: Restricted FT key file not found."
  exit 1
}

[[ -f "$SOURCE" ]] || {
  echo "ERROR: FT Gate Rust source not found."
  exit 1
}

chmod 600 "$KEYFILE"

# Obtain the latest nonce and validate the live Gate configuration.
# This uses NEAR CLI rather than Node's unreliable fetch request.
echo
echo "STEP 1: Reading current FT Gate status..."

near contract call-function as-read-only "$GATE" get_status \
  json-args '{}' \
  network-config testnet \
  now > "$STATUS_FILE"

NONCE=$(node --input-type=module - \
  "$STATUS_FILE" "$AGENT" "$OWNER" "$PUBLIC_KEY" "$TOKEN" "$AMOUNT" <<'NODE'
import fs from "node:fs";

const [file, agent, owner, publicKey, token, amountText] =
  process.argv.slice(2);

const raw = fs.readFileSync(file, "utf8").trim();

// NEAR CLI writes the function return value to stdout.
// The human-readable heading is written separately to stderr.
const start = raw.indexOf("{");
const end = raw.lastIndexOf("}");

if (start < 0 || end < start) {
  console.error("Captured CLI stdout:", JSON.stringify(raw));
  throw Error("No JSON contract result was captured.");
}

const status = JSON.parse(raw.slice(start, end + 1));

if (status.owner_id !== owner) throw Error("Unexpected Gate owner.");
if (status.agent_id !== agent) throw Error("Unexpected agent account.");
if (status.agent_public_key !== publicKey) {
  throw Error("FT restricted public key does not match.");
}
if (status.paused !== false) throw Error("FT Gate is paused.");

const policy = status.token_policies.find(p => p.token_id === token);

if (!policy) throw Error("Approved token policy not found.");
if (!policy.allowed_receivers.includes(owner)) {
  throw Error("Owner is not an approved recipient.");
}

const amount = BigInt(amountText);
const maximum = BigInt(policy.max_payment);
const daily = BigInt(policy.daily_limit);
const spent = BigInt(policy.spent_today);

if (amount <= 0n || amount > maximum) {
  throw Error("Payment exceeds the per-payment policy.");
}

if (spent + amount > daily) {
  throw Error("Payment exceeds the reported daily spending limit.");
}

if (!/^\d+$/.test(status.next_nonce)) {
  throw Error("Invalid Gate nonce.");
}

console.log(status.next_nonce);
NODE
)

echo "PASS: Gate configuration verified."
echo "PASS: Restricted agent key matches."
echo "PASS: Approved token and recipient verified."
echo "Current nonce: $NONCE"

# Read the maximum authorization lifetime from the actual Rust source.
# No external network request is made here.
DELTA_NS=$(node --input-type=module - "$SOURCE" <<'NODE'
import fs from "node:fs";

const source = fs.readFileSync(process.argv[2], "utf8");

const match = source.match(
  /const\s+MAX_PERMIT_TTL_NS\s*:\s*u64\s*=\s*([^;]+);/
);

if (!match) throw Error("Maximum permit TTL not found.");

const expression = match[1]
  .trim()
  .replaceAll("_", "")
  .replace(/[()]/g, "");

if (!/^\d+(?:\s*\*\s*\d+)*$/.test(expression)) {
  throw Error("Unsupported TTL expression. Refusing unsafe expiry.");
}

const ttl = expression
  .split("*")
  .reduce((total, factor) => total * BigInt(factor.trim()), 1n);

const delta = ttl / 2n < 60_000_000_000n
  ? ttl / 2n
  : 60_000_000_000n;

if (delta < 10_000_000_000n) {
  throw Error("Permit lifetime is too short.");
}

console.log(delta.toString());
NODE
)

echo
echo "STEP 2: Payment authorization prepared."
echo "Payment: 0.001 gtNEAR"
echo "Recipient: $OWNER"
echo "Nonce: $NONCE"
echo "Expiry: calculated from synchronized WSL UTC clock."

echo
read -r -p "Type SUBMIT NEARMARK FT PAYMENT: " CONFIRM
[[ "$CONFIRM" == "SUBMIT NEARMARK FT PAYMENT" ]] || {
  echo "Cancelled. No payment submitted."
  exit 0
}

# Calculate expiry immediately before transaction construction.
NOW_NS=$(date -u +%s%N)

if [[ ! "$NOW_NS" =~ ^[0-9]{19}$ ]]; then
  echo "ERROR: Could not read a valid UTC nanosecond timestamp."
  exit 1
fi

EXPIRES_NS=$(node -e '
  console.log((BigInt(process.argv[1]) + BigInt(process.argv[2])).toString())
' "$NOW_NS" "$DELTA_NS")

ARGS=$(node -e '
  console.log(JSON.stringify({
    token_id: process.argv[1],
    receiver_id: process.argv[2],
    amount: process.argv[3],
    nonce: process.argv[4],
    expires_at_ns: process.argv[5],
    memo: "NEARMARK restricted-key payment test"
  }))
' "$TOKEN" "$OWNER" "$AMOUNT" "$NONCE" "$EXPIRES_NS")

echo
echo "STEP 3: Submitting restricted-key transaction..."
echo "The CLI will request your access-key file."

near contract call-function as-transaction "$GATE" execute_ft_payment \
  json-args "$ARGS" \
  prepaid-gas '80 TGas' \
  attached-deposit '0 NEAR' \
  sign-as "$AGENT" \
  network-config testnet \
  sign-with-access-key-file "$KEYFILE" \
  send

echo
echo "STEP 4: Reading final Gate status..."

near contract call-function as-read-only "$GATE" get_status \
  json-args '{}' \
  network-config testnet \
  now

echo
echo "STEP 5: Reading token balances..."

near contract call-function as-read-only "$TOKEN" ft_balance_of \
  json-args "{\"account_id\":\"$GATE\"}" \
  network-config testnet \
  now

near contract call-function as-read-only "$TOKEN" ft_balance_of \
  json-args "{\"account_id\":\"$OWNER\"}" \
  network-config testnet \
  now

echo
echo "PAYMENT SCRIPT FINISHED."
