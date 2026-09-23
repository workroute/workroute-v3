-- WorkRoute — per-business trade pricing configuration (§31)
-- Run this in the Supabase SQL Editor after 0010_push_subscriptions.sql.
--
-- Questions/options are shared across every tradie (lib/trade-questions.ts,
-- §8a); prices are not, so this is a separate per-business table rather than
-- pricing baked into that shared file. One row per business per trade.

create table if not exists public.trade_pricing_configs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(user_id) on delete cascade,
  trade text not null,

  base_price numeric(10, 2) not null default 0,
  base_duration_minutes integer not null default 0,

  -- Per-question pricing rules (lib/trade-pricing.ts QuestionPricing), keyed
  -- by question id to match lib/trade-questions.ts. Shape varies by question
  -- type, so it's flexible JSON rather than one column per question — same
  -- rationale as jobs.trade_answers (§8a).
  question_pricing jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (business_id, trade)
);

create index if not exists trade_pricing_configs_business_id_idx
  on public.trade_pricing_configs (business_id);

alter table public.trade_pricing_configs enable row level security;

drop policy if exists "Users can view their own pricing configs" on public.trade_pricing_configs;
create policy "Users can view their own pricing configs"
  on public.trade_pricing_configs for select
  using (auth.uid() = business_id);

drop policy if exists "Users can insert their own pricing configs" on public.trade_pricing_configs;
create policy "Users can insert their own pricing configs"
  on public.trade_pricing_configs for insert
  with check (auth.uid() = business_id);

drop policy if exists "Users can update their own pricing configs" on public.trade_pricing_configs;
create policy "Users can update their own pricing configs"
  on public.trade_pricing_configs for update
  using (auth.uid() = business_id)
  with check (auth.uid() = business_id);

drop policy if exists "Users can delete their own pricing configs" on public.trade_pricing_configs;
create policy "Users can delete their own pricing configs"
  on public.trade_pricing_configs for delete
  using (auth.uid() = business_id);
