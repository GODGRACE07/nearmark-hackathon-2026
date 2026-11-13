# NEARMARK last-mile activation inputs

Never paste these credentials into chat or commit them to Git. Add only real values to the local `.env` or the relevant provider's secret manager.

## NEAR AI verified inference
- `NEAR_AI_API_KEY`
- `NEAR_AI_MODEL=deepseek-ai/DeepSeek-V4.1-Flash-1017` (the verifier may persist a supported model after a successful run)

## Supabase Auth, database and RLS
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (or legacy `SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` (backend host only; never `VITE_`)
- `SUPABASE_ACCESS_TOKEN` (CLI only)
- `SUPABASE_DB_PASSWORD` (CLI only, if prompted)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

After migration, configure Supabase Site URL and `/account` redirect URL, run real passwordless sign-in, and verify that a user can read/write only their own rows. Only then set `NEARMARK_REQUIRE_AUTH=true` on the backend host.

## Stripe Test mode
- `STRIPE_SECRET_KEY` (must start `sk_test_` for this script)
- `STRIPE_PRICE_ID` (an active recurring Test-mode Price)
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`
- `NEARMARK_PUBLIC_API_URL` (public HTTPS backend URL, used to create the webhook)

## OutLayer compute Testnet
- `OUTLAYER_ACCOUNT_ID` (exact OutLayer Testnet account; do not infer it from the native Gate owner)
- `OUTLAYER_PROJECT_NAME` (optional; default `nearmark-nasb-receipts`)
- `OUTLAYER_FASTFS_URL` (optional override if CLI output cannot be parsed)
- `OUTLAYER_RUN_DEPOSIT_NEAR` (approved Testnet execution deposit)
- After an actual worker call: `OUTLAYER_CALL_ID`, `OUTLAYER_INPUT_JSON`, `OUTLAYER_OUTPUT_JSON` for `scripts/verify-outlayer-call.sh`

The worker currently signs a canonical NASB receipt; it does not execute the benchmark attacks or prove benchmark semantics.

## Cloudflare Pages frontend
- `CLOUDFLARE_API_TOKEN` (Pages edit permissions)
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT` (optional; default `nearmark`)
- `NEARMARK_PUBLIC_API_URL` (public HTTPS URL for the separately deployed Node API)

Set the deployed API's `ALLOWED_ORIGIN` to the exact Pages origin after deployment. Keep API secrets on the backend, never in `VITE_` variables.

## FT Gate Testnet
- `NEARMARK_FT_GATE_ACCOUNT` (fresh dedicated `.testnet` contract account)
- `NEARMARK_FT_AGENT_ACCOUNT` (agent account)
- `NEARMARK_FT_TOKEN_ID` (the actual NEP-141 Testnet contract)
- `NEARMARK_FT_RECIPIENTS` (comma-separated exact recipient IDs)
- `NEARMARK_FT_MAX_PAYMENT_BASE_UNITS` and `NEARMARK_FT_DAILY_LIMIT_BASE_UNITS` (integer U128 strings)
- A separate FT Gate agent public key scoped only to `execute_ft_payment`
- Enough NEAR for deployment and NEP-145 storage registration; enough tokens for the funded Gate

Do not guess token address, decimals, recipient identities, storage bounds, or payment limits. The FT Gate is separate from the native-NEAR Gate and needs its own restricted FunctionCall key.

## GitHub and submission
- Authenticate locally with `gh auth login` before public publication.
- Review the staged source and scan the entire history for secrets before publishing.
- Record and post the actual demo video/screenshots on X.
- Fill your actual team/contact details, select all applicable tracks, and use a Mainnet NEAR payout address in the submission form.
- The final submission is one-time; review its complete payload before sending.
