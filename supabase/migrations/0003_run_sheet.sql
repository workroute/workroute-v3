-- WorkRoute — Phase 1: run sheet scheduling fields (§10a-i, §12)
-- Run this in the Supabase SQL Editor after 0001_init.sql and 0002_jobs.sql.
-- Safe to re-run.

alter table public.jobs add column if not exists scheduled_date date;

-- Either a specific time OR a Morning/Afternoon/Evening block — never both.
alter table public.jobs add column if not exists scheduled_time time;
alter table public.jobs add column if not exists scheduled_block text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'jobs_scheduled_block_check'
  ) then
    alter table public.jobs
      add constraint jobs_scheduled_block_check
      check (scheduled_block in ('Morning', 'Afternoon', 'Evening'));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'jobs_one_slot_type_only'
  ) then
    alter table public.jobs
      add constraint jobs_one_slot_type_only
      check (not (scheduled_time is not null and scheduled_block is not null));
  end if;
end $$;

-- The tradie's manual drag order within a day (§12: "suggested ordering
-- only... tradie can freely drag & reorder"). Null until the app assigns a
-- suggested position the first time a job is viewed on the run sheet.
alter table public.jobs add column if not exists run_order integer;

create index if not exists jobs_scheduled_date_idx on public.jobs (scheduled_date);
