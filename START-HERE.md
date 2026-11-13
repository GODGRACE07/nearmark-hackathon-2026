# NEARMARK — one command start

## From the WSL terminal

Save `NEARMARK-FINAL-ONECLICK.zip` in `C:\Users\USER\Downloads`, then open Ubuntu/WSL. You should see a prompt similar to `grace@DESKTOP:...$` (not `PS C:\...>`).

Paste this entire command once:

```bash
ZIP="/mnt/c/Users/USER/Downloads/NEARMARK-FINAL-ONECLICK.zip"
DEST="$HOME/NEARMARK-FINAL-ONECLICK"
if [ ! -f "$ZIP" ]; then
  echo "ZIP not found: $ZIP"
  echo "Download NEARMARK-FINAL-ONECLICK.zip from this chat into C:\Users\USER\Downloads, then rerun this command."
  exit 1
fi
if ! command -v unzip >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y unzip
fi
mkdir -p "$DEST"
unzip -oq "$ZIP" -d "$DEST"
cd "$DEST/nearmark"
chmod +x scripts/ONE-COMMAND-WSL.sh scripts/NEARMARK-ONE-CLICK.sh scripts/NEARMARK-TESTNET-DEPLOY.sh
bash scripts/ONE-COMMAND-WSL.sh
```

Do not paste PowerShell commands after entering WSL. The above is Bash and must be run at the Linux prompt.

## What it does

It prepares the WSL toolchain, installs locked dependencies, runs app/SDK/OutLayer receipt tests, checks TypeScript and frontend production build, tests/builds native and FT Gate contracts, builds the WASI worker, executes the native Gate NEAR Sandbox test, runs API/Testnet read-only smoke checks, writes a readiness report, and starts the product.

After local checks, one optional prompt offers a native Gate Testnet deployment. Only type `DEPLOY TESTNET` if you want the runner to create/reuse the documented Testnet accounts, add the restricted agent key and send the tiny Testnet demo payment. Press Enter to skip all chain writes.

## Safety

- The pipeline is Testnet-only. There is no Mainnet deployment path.
- `.env` is created locally with safe blank provider credentials; existing `.env` is preserved.
- It never displays private keys or seed phrases.
- FT Gate is built/tested, not deployed automatically because a real token address and account/storage setup are required.
- OutLayer worker is built, but remote project publishing/TEE execution still requires your OutLayer account/project/payment key and independent verification.
- NEAR AI verified inference requires your API key, a model with attestations, and an authenticated app user.
- Supabase SQL migration, Stripe Test-mode configuration, GitHub publishing, X demo posting and final submission require your own accounts/actions.

Logs: `verification-logs/`
Readiness JSON: `artifacts/nearmark-release-readiness.json`
