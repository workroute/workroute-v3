-- WorkRoute — Web Push notifications (owner + customer), VAPID-based.
-- Run this in the Supabase SQL Editor after 0001-0009.
--
-- SMS remains the reliable fallback (esp. iOS, which needs the PWA
-- installed to home screen before push works at all). Push is layered on
-- top via two single-purpose tables, matching this codebase's existing
-- preference for explicit tables over polymorphic ones (clients/jobs/messages).

-- Owner (tradie) push subscriptions — one browser/device per row.
create table if not exists public.owner_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(user_id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (business_id, endpoint)
);

alter table public.owner_push_subscriptions enable row level security;

drop policy if exists "Users can view their own push subscriptions" on public.owner_push_subscriptions;
create policy "Users can view their own push subscriptions"
  on public.owner_push_subscriptions for select
  using (auth.uid() = business_id);

drop policy if exists "Users can save their own push subscriptions" on public.owner_push_subscriptions;
create policy "Users can save their own push subscriptions"
  on public.owner_push_subscriptions for insert
  with check (auth.uid() = business_id);

-- Lets a device re-subscribe (browser can rotate the endpoint) or the owner
-- toggle off from the same UI, without needing a server route.
drop policy if exists "Users can update their own push subscriptions" on public.owner_push_subscriptions;
create policy "Users can update their own push subscriptions"
  on public.owner_push_subscriptions for update
  using (auth.uid() = business_id)
  with check (auth.uid() = business_id);

drop policy if exists "Users can delete their own push subscriptions" on public.owner_push_subscriptions;
create policy "Users can delete their own push subscriptions"
  on public.owner_push_subscriptions for delete
  using (auth.uid() = business_id);

-- Customer push subscriptions — a customer has no auth.uid() at all (same
-- trust model as messages/messenger_send_customer_message), so this table
-- gets RLS enabled with ZERO policies: nothing reachable with the anon or
-- authenticated key, in either direction. The only insert path is the
-- SECURITY DEFINER RPC below; the only read path is the service-role key
-- used from lib/push-notifications.ts when actually sending.
create table if not exists public.customer_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  business_id uuid not null references public.business_profiles(user_id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (job_id, endpoint)
);

alter table public.customer_push_subscriptions enable row level security;
-- Deliberately no policies — see comment above.

create index if not exists customer_push_subscriptions_job_id_idx
  on public.customer_push_subscriptions (job_id);

-- §Messenger — token-gated, exact template as messenger_send_customer_message
-- in 0007_messenger.sql: SECURITY DEFINER, pinned search_path, resolves
-- job_id/business_id from p_token internally, raises on an invalid token,
-- explicit execute grants. Safe under 0007's own "never let an anonymous
-- caller impersonate the business" rule — this only ever writes a
-- subscription row tied to the resolved job, never a message.
create or replace function public.messenger_save_push_subscription(
  p_token uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id uuid;
  v_business_id uuid;
begin
  select id, business_id into v_job_id, v_business_id
  from public.jobs
  where customer_access_token = p_token;

  if v_job_id is null then
    raise exception 'invalid token';
  end if;

  insert into public.customer_push_subscriptions (job_id, business_id, endpoint, p256dh, auth)
  values (v_job_id, v_business_id, p_endpoint, p_p256dh, p_auth)
  on conflict (job_id, endpoint)
  do update set p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;

revoke all on function public.messenger_save_push_subscription(uuid, text, text, text) from public;
grant execute on function public.messenger_save_push_subscription(uuid, text, text, text) to anon, authenticated;

-- Weather-warning debounce (§ new "bad forecast" cron) — one row per
-- business already exists here, so this is the simplest place for it.
alter table public.business_profiles add column if not exists last_weather_warning_date date;
