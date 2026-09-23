-- Recurring bookings — see lib/recurring-jobs.ts. A "Regular" service (as
-- opposed to a One-off) can now actually create a batch of future visits,
-- not just price this one job differently. recurring_series_id links every
-- job in the same series (including the first one); recurring_frequency is
-- duplicated onto each row rather than looked up via a join, since every job
-- card/list view already reads straight off the jobs table.
alter table public.jobs add column if not exists recurring_series_id uuid;
alter table public.jobs add column if not exists recurring_frequency text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'jobs_recurring_frequency_check'
  ) then
    alter table public.jobs
      add constraint jobs_recurring_frequency_check
      check (recurring_frequency in ('Weekly', 'Fortnightly', 'Monthly'));
  end if;
end $$;

create index if not exists jobs_recurring_series_id_idx on public.jobs (recurring_series_id);
