-- NEARMARK Phase 2: private user data + Stripe billing state.
-- Apply in the Supabase SQL editor or through Supabase CLI migrations.

create extension if not exists pgcrypto;

create table if not exists public.benchmark_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  suite_version text not null,
  profile text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists benchmark_runs_user_created_idx on public.benchmark_runs(user_id, created_at desc);
alter table public.benchmark_runs enable row level security;
revoke all on public.benchmark_runs from anon;
grant select, insert on public.benchmark_runs to authenticated;
drop policy if exists benchmark_runs_select_own on public.benchmark_runs;
create policy benchmark_runs_select_own on public.benchmark_runs for select to authenticated using (user_id = auth.uid());
drop policy if exists benchmark_runs_insert_own on public.benchmark_runs;
create policy benchmark_runs_insert_own on public.benchmark_runs for insert to authenticated with check (user_id = auth.uid());

create table if not exists public.threat_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  receiver text not null,
  category text not null default 'suspicious-activity',
  evidence_ref text not null,
  description text not null default '',
  reporter_account text,
  status text not null default 'pending' check (status in ('pending','under_review','verified','rejected','disputed')),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists threat_reports_user_created_idx on public.threat_reports(user_id, created_at desc);
create index if not exists threat_reports_receiver_status_idx on public.threat_reports(receiver, status);
alter table public.threat_reports enable row level security;
revoke all on public.threat_reports from anon;
grant select, insert on public.threat_reports to authenticated;
drop policy if exists threat_reports_select_own on public.threat_reports;
create policy threat_reports_select_own on public.threat_reports for select to authenticated using (user_id = auth.uid());
drop policy if exists threat_reports_insert_own on public.threat_reports;
create policy threat_reports_insert_own on public.threat_reports for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
-- No authenticated UPDATE/DELETE policy: user-submitted reports cannot self-verify or disappear.

create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.billing_customers enable row level security;
revoke all on public.billing_customers from anon;
grant select on public.billing_customers to authenticated;
drop policy if exists billing_customers_select_own on public.billing_customers;
create policy billing_customers_select_own on public.billing_customers for select to authenticated using (user_id = auth.uid());

create table if not exists public.subscriptions (
  stripe_subscription_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null,
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_created_idx on public.subscriptions(user_id, created_at desc);
alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon;
grant select on public.subscriptions to authenticated;
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions for select to authenticated using (user_id = auth.uid());

create table if not exists public.stripe_events (
  stripe_event_id text primary key,
  event_type text not null,
  created_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;
-- The server's service-role key is the only writer/reader for webhook idempotency.

grant all on public.billing_customers to service_role;
grant all on public.subscriptions to service_role;
grant all on public.stripe_events to service_role;

comment on table public.threat_reports is 'User-submitted evidence; pending reports never automatically cause a BLOCK decision.';
comment on table public.subscriptions is 'Stripe-derived subscription state. Authenticated users may only read their own row(s).';
