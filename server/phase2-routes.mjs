import { runNearAiVerified } from './near-ai-tee.mjs';
import { inspectOutLayerCustody, submitOutLayerTransfer } from './outlayer-custody.mjs';
import { adminInsertIgnoreDuplicate, adminUpsert } from './phase2-db.mjs';
import { createSupabaseAdminClient } from './phase2-auth.mjs';

async function readRawBody(req, maxBytes = 1_048_576) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error('Webhook body too large.'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function stripeCheckout(auth) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const price = process.env.STRIPE_PRICE_ID;
  if (!secret || !price) throw Object.assign(new Error('Stripe billing requires STRIPE_SECRET_KEY and STRIPE_PRICE_ID.'), { status: 503 });
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(secret);
  const user = auth?.user;
  if (!user?.id) throw Object.assign(new Error('Login is required to create a subscription.'), { status: 401 });
  const customerRows = await createSupabaseAdminClient().from('billing_customers').select('stripe_customer_id').eq('user_id', user.id).limit(1);
  if (customerRows.error) throw Object.assign(new Error(`Billing customer lookup failed: ${customerRows.error.message}`), { status: 503 });
  let customer = customerRows.data?.[0]?.stripe_customer_id;
  if (!customer) {
    const created = await stripe.customers.create({ email: user.email || undefined, metadata: { nearmark_user_id: user.id } });
    customer = created.id;
    await adminUpsert('billing_customers', { user_id: user.id, stripe_customer_id: customer }, 'user_id');
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price, quantity: 1 }],
    success_url: process.env.STRIPE_SUCCESS_URL || 'http://localhost:5173/account?billing=success&session_id={CHECKOUT_SESSION_ID}',
    cancel_url: process.env.STRIPE_CANCEL_URL || 'http://localhost:5173/account?billing=cancel',
    client_reference_id: user.id,
    metadata: { nearmark_user_id: user.id },
    subscription_data: { metadata: { nearmark_user_id: user.id } },
  });
  return { checkoutUrl: session.url, sessionId: session.id };
}

async function processStripeWebhook(req) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) throw Object.assign(new Error('Stripe webhook requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.'), { status: 503 });
  const signature = req.headers['stripe-signature'];
  if (!signature) throw Object.assign(new Error('Missing Stripe-Signature header.'), { status: 400 });
  const raw = await readRawBody(req);
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(secret);
  let event;
  try { event = stripe.webhooks.constructEvent(raw, signature, webhookSecret); }
  catch { throw Object.assign(new Error('Stripe webhook signature verification failed.'), { status: 400, code: 'STRIPE_SIGNATURE_INVALID' }); }

  // Apply idempotent upserts first, then record the event. If persistence fails,
  // the webhook returns 5xx and Stripe can retry; duplicate upserts are safe.
  const object = event.data?.object || {};
  if (event.type === 'checkout.session.completed' && object.mode === 'subscription') {
    const userId = object.metadata?.nearmark_user_id || object.client_reference_id;
    if (userId && object.customer) {
      await adminUpsert('billing_customers', { user_id: userId, stripe_customer_id: String(object.customer) }, 'user_id');
      if (object.subscription) {
        const sub = await stripe.subscriptions.retrieve(String(object.subscription));
        await adminUpsert('subscriptions', {
          stripe_subscription_id: sub.id,
          user_id: userId,
          status: sub.status,
          price_id: sub.items?.data?.[0]?.price?.id || null,
          current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          cancel_at_period_end: !!sub.cancel_at_period_end,
        }, 'stripe_subscription_id');
      }
    }
  }
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const userId = object.metadata?.nearmark_user_id;
    if (userId) {
      await adminUpsert('subscriptions', {
        stripe_subscription_id: object.id,
        user_id: userId,
        status: object.status,
        price_id: object.items?.data?.[0]?.price?.id || null,
        current_period_end: object.current_period_end ? new Date(object.current_period_end * 1000).toISOString() : null,
        cancel_at_period_end: !!object.cancel_at_period_end,
      }, 'stripe_subscription_id');
    }
  }
  await adminInsertIgnoreDuplicate('stripe_events', { stripe_event_id: event.id, event_type: event.type });
  return { received: true, duplicateSafe: true };
}

export async function handlePhase2Route(req, res, url, { bodyJson, send }) {
  if (req.method === 'GET' && url.pathname === '/api/auth/me') {
    if (!req.nearmarkAuth) return send(res, 401, { error: 'Sign in is required.' });
    const { id, email, app_metadata, user_metadata } = req.nearmarkAuth.user;
    return send(res, 200, { user: { id, email, app_metadata, user_metadata } });
  }
  if (req.method === 'POST' && url.pathname === '/api/near-ai/verified-analyze') {
    if (!req.nearmarkAuth) return send(res, 401, { error: 'Sign in is required to use the verified NEAR AI endpoint.' });
    const body = await bodyJson(req);
    const result = await runNearAiVerified({ prompt: body.prompt, model: body.model || process.env.NEAR_AI_MODEL, apiKey: process.env.NEAR_AI_API_KEY });
    return send(res, 200, result);
  }
  if (req.method === 'GET' && url.pathname === '/api/outlayer/custody/status') {
    if (!req.nearmarkAuth) return send(res, 401, { error: 'Sign in is required to inspect the custody wallet.' });
    return send(res, 200, await inspectOutLayerCustody());
  }
  if (req.method === 'POST' && url.pathname === '/api/outlayer/custody/transfer') {
    if (!req.nearmarkAuth) return send(res, 401, { error: 'Sign in is required before a custody transfer.' });
    const operators = (process.env.OUTLAYER_OPERATOR_USER_IDS || '').split(',').map(value => value.trim()).filter(Boolean);
    if (!operators.includes(req.nearmarkAuth.user.id)) return send(res, 403, { error: 'This account is not an approved OutLayer custody operator.', code: 'OUTLAYER_OPERATOR_REQUIRED' });
    const body = await bodyJson(req);
    return send(res, 202, { accepted: true, network: 'testnet', result: await submitOutLayerTransfer(body), note: 'Do not retry automatically if the response is ambiguous. Check OutLayer audit/status first.' });
  }
  if (req.method === 'POST' && url.pathname === '/api/billing/checkout') {
    if (!req.nearmarkAuth) return send(res, 401, { error: 'Sign in is required.' });
    return send(res, 200, await stripeCheckout(req.nearmarkAuth));
  }
  if (req.method === 'POST' && url.pathname === '/api/billing/stripe-webhook') {
    return send(res, 200, await processStripeWebhook(req));
  }
  if (req.method === 'GET' && url.pathname === '/api/billing/subscription') {
    if (!req.nearmarkAuth) return send(res, 401, { error: 'Sign in is required.' });
    const { data, error } = await createSupabaseAdminClient().from('subscriptions').select('status,price_id,current_period_end,cancel_at_period_end').eq('user_id', req.nearmarkAuth.user.id).order('created_at', { ascending: false }).limit(1);
    if (error) throw Object.assign(new Error(`Subscription lookup failed: ${error.message}`), { status: 503 });
    return send(res, 200, { subscription: data?.[0] || null });
  }
  if (req.method === 'GET' && url.pathname === '/api/phase2/status') {
    return send(res, 200, {
      nearAi: { officialSdk: 'installed-by-phase2', apiKey: !!process.env.NEAR_AI_API_KEY, model: process.env.NEAR_AI_MODEL || null, verificationRoute: '/api/near-ai/verified-analyze', modelTeeBadgePolicy: 'provider_tee-only' },
      outLayer: { apiKey: !!process.env.OUTLAYER_API_KEY, walletIdentity: 'derived-from-OutLayer-API-key', mutationsEnabled: process.env.OUTLAYER_ENABLE_MUTATIONS === 'true', network: process.env.OUTLAYER_NETWORK || 'testnet', workerSource: 'integrations/outlayer-worker' },
      gateFt: { source: 'contracts/near-gate-ft', deployed: true, network: 'testnet', standard: 'NEP-141', status: 'testnet-initialized-live-payment-settled', evidence: 'artifacts/nearmark-ft-testnet-payment.json' },
      production: { supabaseConfigured: !!(process.env.SUPABASE_URL && (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY)), authRequired: process.env.NEARMARK_REQUIRE_AUTH === 'true', stripeConfigured: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID && process.env.STRIPE_WEBHOOK_SECRET) },
    });
  }
  return false;
}
