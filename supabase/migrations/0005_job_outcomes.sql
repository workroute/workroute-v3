-- WorkRoute — Phase 1: job outcome tracking (§20)
-- Run this in the Supabase SQL Editor after 0001-0004.
-- A lightweight addition to the existing §10 status flow, not a new one:
-- whether a job ultimately became Won, Lost, or Declined. Null means "no
-- outcome yet" — most jobs sit here until they're completed or fall through.

alter table public.jobs add column if not exists outcome text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'jobs_outcome_check'
  ) then
    alter table public.jobs
      add constraint jobs_outcome_check
      check (outcome in ('Won', 'Lost', 'Declined'));
  end if;
end $$;
