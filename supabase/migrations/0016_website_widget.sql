-- WorkRoute — Phase 1: Website Chat Widget (upsell feature)
-- Run this in the Supabase SQL Editor after 0001-0015.
--
-- An embeddable chat widget a tradie pastes onto their own external
-- business website, where "Sarah" (same persona as Messenger/phone AI)
-- captures leads from anonymous visitors. See lib/widget-ai.ts and
-- app/api/widget/[widgetKey]/route.ts.

-- Public, non-secret per-business identifier (like a Stripe/Intercom
-- publishable key) — unlike Messenger's per-JOB customer_access_token,
-- there's no job yet when the widget loads on a stranger's site, so
-- identity has to live at the business level and be visible in page
-- source by design.
alter table public.business_profiles
  add column if not exists widget_key uuid not null default gen_random_uuid();

create unique index if not exists business_profiles_widget_key_idx
  on public.business_profiles (widget_key);

-- jobs.source is a plain check constraint (not an enum), originally added
-- inline on the create table in 0002_jobs.sql (Postgres auto-named it
-- jobs_source_check) — must drop and recreate to add a value.
alter table public.jobs drop constraint if exists jobs_source_check;
alter table public.jobs add constraint jobs_source_check
  check (source in ('call', 'missed_call', 'sms', 'form', 'widget'));

-- Mirrors phone_call_captures's shape (0014/0015): the pre-job record of
-- the raw conversation, independent of whether a job ever gets created.
-- session_id is generated client-side (crypto.randomUUID()) and persisted
-- in the visitor's browser (localStorage) for one widget session — lets a
-- later message in the same conversation resume the same row instead of
-- creating a new capture per message, and doubles as the rate-limit key.
create table if not exists public.widget_chat_captures (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(user_id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,

  session_id uuid not null,
  transcript_messages jsonb not null default '[]'::jsonb,

  status text not null default 'in_progress'
    check (status in ('in_progress', 'captured', 'abandoned')),

  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create unique index if not exists widget_chat_captures_session_id_idx
  on public.widget_chat_captures (session_id);
create index if not exists widget_chat_captures_business_id_idx
  on public.widget_chat_captures (business_id, created_at desc);
create index if not exists widget_chat_captures_job_id_idx
  on public.widget_chat_captures (job_id);

alter table public.widget_chat_captures enable row level security;

-- Select-only: this table is never written by an authenticated tradie
-- session, only by the widget API route via the service-role client (same
-- pattern as phone_call_captures).
drop policy if exists "Users can view their own widget chat captures" on public.widget_chat_captures;
create policy "Users can view their own widget chat captures"
  on public.widget_chat_captures for select
  using (auth.uid() = business_id);

-- Rate-limiting event log — one tiny row per accepted inbound visitor
-- message, deliberately separate from widget_chat_captures so both the
-- per-session and per-business rolling-window caps in the API route are a
-- single indexed count(*) query each.
create table if not exists public.widget_rate_limit_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.business_profiles(user_id) on delete cascade,
  session_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists widget_rate_limit_events_business_idx
  on public.widget_rate_limit_events (business_id, created_at desc);
create index if not exists widget_rate_limit_events_session_idx
  on public.widget_rate_limit_events (session_id, created_at desc);

-- RLS enabled with zero policies, deliberately — without RLS, Supabase's
-- default anon/authenticated grants would let anyone with the public anon
-- key read/tamper with rate-limit rows directly via the API, defeating the
-- whole point of this table. Zero policies means a hard deny for anon and
-- authenticated; the service-role client our own code uses always bypasses
-- RLS regardless, so this doesn't affect legitimate access at all.
alter table public.widget_rate_limit_events enable row level security;
