import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowUpRight, CheckCircle2, CreditCard, KeyRound, LogOut, Mail, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { PageIntro, Panel, StateTag } from '../components/Chrome';
import { authConfigured, readSession, sendMagicLink, signOut, supabase } from '../lib/auth';
import { api, post } from '../lib/api';

type Subscription = { status: string; price_id?: string | null; current_period_end?: string | null; cancel_at_period_end?: boolean } | null;

export default function Account() {
  const [email, setEmail] = useState('');
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Subscription>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(new URLSearchParams(window.location.search).get('billing') === 'success' ? 'Checkout completed. Subscription status will update after Stripe confirms the webhook.' : '');
  const [error, setError] = useState('');

  const refreshSubscription = useCallback(async () => {
    if (!sessionEmail) { setSubscription(null); return; }
    setBillingLoading(true);
    try {
      const result = await api<{ subscription: Subscription }>('/api/billing/subscription');
      setSubscription(result.subscription);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load billing status.');
    } finally { setBillingLoading(false); }
  }, [sessionEmail]);

  const refresh = useCallback(async () => {
    try {
      const session = await readSession();
      setSessionEmail(session?.user.email || null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read session.'); }
  }, []);

  useEffect(() => {
    void refresh();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email || null);
      setError('');
      if (session) queueMicrotask(() => { void refreshSubscription(); });
      else setSubscription(null);
    });
    return () => data.subscription.unsubscribe();
  }, [refresh, refreshSubscription]);

  useEffect(() => { if (sessionEmail) void refreshSubscription(); }, [sessionEmail, refreshSubscription]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await sendMagicLink(email.trim());
      setNotice('A sign-in link has been sent. Open the email on this device to finish signing in.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send sign-in link.'); }
    finally { setBusy(false); }
  }

  async function onSignOut() {
    setBusy(true); setError(''); setNotice('');
    try { await signOut(); setSessionEmail(null); setSubscription(null); setNotice('You are signed out.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Sign-out failed.'); }
    finally { setBusy(false); }
  }

  async function startCheckout() {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await post<{ checkoutUrl: string }>('/api/billing/checkout', {});
      if (!result.checkoutUrl || !result.checkoutUrl.startsWith('https://checkout.stripe.com/')) throw new Error('Stripe did not return a valid hosted Checkout URL.');
      window.location.assign(result.checkoutUrl);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start checkout.'); setBusy(false); }
  }

  return <>
    <PageIntro eyebrow="Account security" title="Your NEARMARK identity" description="Sign in to keep benchmark runs and evidence reports in your own Supabase account. Authentication is verified by the NEARMARK server." />
    <div className="account-layout">
      <Panel title="Authentication" subtitle="Passwordless email sign-in with Supabase Auth">
        {!authConfigured ? <div className="account-warning"><KeyRound size={18}/><div><strong>Supabase browser keys are not configured</strong><p>Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your local .env, then restart the app.</p></div></div> : sessionEmail ? <div className="account-session">
          <div className="account-session-icon"><ShieldCheck size={22}/></div>
          <div><span className="eyebrow">SIGNED IN AS</span><strong>{sessionEmail}</strong><StateTag state="Authenticated"/></div>
          <button className="button button-ghost" onClick={onSignOut} disabled={busy}><LogOut size={14}/> Sign out</button>
        </div> : <form className="account-form" onSubmit={onSubmit}>
          <label className="field"><span>Email address</span><input type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}/></label>
          <button className="button button-lime" type="submit" disabled={busy || !email.trim()}><Mail size={15}/>{busy ? 'Sending…' : 'Send sign-in link'}<ArrowUpRight size={14}/></button>
          <p className="form-meta">No password is stored by NEARMARK. Supabase issues and validates the session.</p>
        </form>}
        {notice && <div className="account-notice"><CheckCircle2 size={15}/>{notice}</div>}
        {error && <div className="account-error">{error}</div>}
      </Panel>
      <Panel title="Subscription" subtitle="Stripe-hosted recurring billing (configure test mode first)">
        {!sessionEmail ? <div className="account-warning"><CreditCard size={18}/><div><strong>Sign in to manage billing</strong><p>Subscription status is private to your authenticated account.</p></div></div> : <div className="billing-card">
          <div className="billing-row"><span>Current status</span>{billingLoading ? <StateTag state="Checking"/> : <StateTag state={subscription?.status || 'No subscription'}/>}</div>
          {subscription?.current_period_end && <div className="billing-row"><span>Current period ends</span><strong>{new Date(subscription.current_period_end).toLocaleDateString()}</strong></div>}
          {subscription?.cancel_at_period_end && <div className="account-warning"><span>Cancellation is scheduled for the end of the current period.</span></div>}
          <div className="billing-actions"><button className="button button-lime" onClick={startCheckout} disabled={busy}><CreditCard size={15}/>{busy ? 'Opening checkout…' : subscription ? 'Start another subscription' : 'Choose a plan'}<ArrowUpRight size={14}/></button><button className="button button-ghost" onClick={() => void refreshSubscription()} disabled={billingLoading}><RefreshCw size={14}/> Refresh</button></div>
          <p className="account-footnote">Checkout is available only after server-side Stripe test credentials and a recurring Price ID are configured. Stripe webhooks update subscription status; returning from Checkout alone does not activate a plan.</p>
        </div>}
      </Panel>
      <Panel title="Data boundary" subtitle="What the application stores when you are signed in">
        <div className="account-boundary"><div><UserRound size={16}/><span>Benchmark runs</span><StateTag state="Private to your user ID"/></div><div><ShieldCheck size={16}/><span>Threat evidence reports</span><StateTag state="Pending review by default"/></div><div><KeyRound size={16}/><span>Payment and signing keys</span><StateTag state="Never stored in browser database"/></div></div>
        <p className="account-footnote">The server verifies each Supabase access token. PostgreSQL row-level security limits user rows. Stripe customer and subscription writes use a server-only service-role key.</p>
      </Panel>
    </div>
  </>;
}
