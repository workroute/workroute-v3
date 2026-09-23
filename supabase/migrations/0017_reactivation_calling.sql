-- §38 — Sarah outbound reactivation calling. Manual-trigger only (no cron):
-- a tradie reviews a list of lapsed clients and clicks to call, rather than
-- this running on a schedule — WorkRoute has no scheduler wired up at all
-- yet (even the existing weather-check cron isn't connected to anything in
-- production), and a human reviewing who gets called is the safer default
-- for a feature that places real phone calls to real people.

alter table public.clients add column if not exists do_not_call boolean not null default false;
alter table public.clients add column if not exists last_reactivation_call_at timestamptz;

alter table public.business_profiles
  add column if not exists reactivation_lapsed_months integer not null default 6;

-- No last_job_date column exists on clients — derive it here once rather
-- than duplicating the aggregate in application code. security_invoker
-- matters: without it, the view would run as its owner (bypassing RLS)
-- instead of as the querying tradie, silently leaking every business's
-- job dates to every other business.
create or replace view public.client_last_completed_job
  with (security_invoker = true) as
  select client_id, max(coalesce(scheduled_date, created_at::date)) as last_job_date
  from public.jobs
  where status = 'Completed' and client_id is not null
  group by client_id;

alter table public.phone_call_captures
  add column if not exists call_purpose text not null default 'inbound'
    check (call_purpose in ('inbound', 'reactivation'));
