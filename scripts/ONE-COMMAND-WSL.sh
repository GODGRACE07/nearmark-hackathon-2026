#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PATH="$HOME/.cargo/bin:$PATH"

printf '\n======================================================\n'
printf ' NEARMARK — ONE-COMMAND WSL TOOLCHAIN SETUP\n'
printf '======================================================\n'
echo "Project: $ROOT"

# WSL base packages. Only ask apt to run when a required tool is missing.
MISSING=0
for c in curl unzip git python3 sha256sum gcc g++ make pkg-config; do command -v "$c" >/dev/null 2>&1 || MISSING=1; done
[ -f /usr/include/libudev.h ] || MISSING=1
[ -f /usr/include/openssl/ssl.h ] || MISSING=1
if [ "$MISSING" -eq 1 ]; then
  if [ "$(id -u)" -eq 0 ]; then
    APT=(apt-get)
  elif command -v sudo >/dev/null 2>&1; then
    APT=(sudo apt-get)
  else
    echo 'Required Linux build packages are missing and neither root nor sudo is available.'
    exit 1
  fi
  "${APT[@]}" update
  "${APT[@]}" install -y ca-certificates curl unzip git python3 build-essential pkg-config libudev-dev libssl-dev
fi

# Install/select Node 24.22.1: required by the installed NEAR AI JavaScript SDK.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then . "$NVM_DIR/nvm.sh"; fi
if ! command -v nvm >/dev/null 2>&1; then
  TMP_NVM="$(mktemp)"
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh -o "$TMP_NVM"
  bash "$TMP_NVM"
  rm -f "$TMP_NVM"
  [ -s "$NVM_DIR/nvm.sh" ] || { echo 'nvm install failed.'; exit 1; }
  . "$NVM_DIR/nvm.sh"
fi
nvm install 24.22.1
nvm use 24.22.1
node -e 'const [a,b,c]=process.versions.node.split(".").map(Number); if(a<24 || (a===24 && (b<22 || (b===22 && c<1)))) process.exit(1)'
echo "Node: $(node --version) / npm: $(npm --version)"

# Rust and the two required WebAssembly targets.
if ! command -v rustup >/dev/null 2>&1; then
  TMP_RUST="$(mktemp)"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o "$TMP_RUST"
  sh "$TMP_RUST" -y --profile minimal
  rm -f "$TMP_RUST"
  [ -s "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"
fi
export PATH="$HOME/.cargo/bin:$PATH"
rustup toolchain install 1.95.0 --profile minimal --component rustfmt --target wasm32-unknown-unknown
rustup toolchain install stable --profile minimal --target wasm32-wasip2

# Install official prebuilt NEAR CLI and cargo-near binaries when unavailable.
if ! command -v near >/dev/null 2>&1; then
  TMP_NEAR="$(mktemp)"
  curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/near-cli-rs/releases/download/v0.31.1/near-cli-rs-installer.sh -o "$TMP_NEAR"
  sh "$TMP_NEAR"
  rm -f "$TMP_NEAR"
  export PATH="$HOME/.cargo/bin:$PATH"
fi
if ! cargo +1.95.0 near --version >/dev/null 2>&1; then
  TMP_CNEAR="$(mktemp)"
  curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/cargo-near/releases/download/cargo-near-v0.23.0/cargo-near-installer.sh -o "$TMP_CNEAR"
  sh "$TMP_CNEAR"
  rm -f "$TMP_CNEAR"
  export PATH="$HOME/.cargo/bin:$PATH"
fi

command -v near >/dev/null 2>&1 || { echo 'NEAR CLI install was not found in PATH.'; exit 1; }
cargo +1.95.0 near --version
near --version

# Set the user shell up for future WSL windows too.
for file in "$HOME/.bashrc"; do
  grep -q 'NVM_DIR.*\.nvm' "$file" 2>/dev/null || cat >> "$file" <<'BASHRC'
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PATH="$HOME/.cargo/bin:$PATH"
BASHRC
done

exec bash "$ROOT/scripts/NEARMARK-ONE-CLICK.sh"
