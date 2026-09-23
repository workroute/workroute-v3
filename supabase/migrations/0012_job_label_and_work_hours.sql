-- §32e — short, tradie-entered job label (e.g. "Front & Back", "Hedge trim
-- & tidy up") since trade-specific Q&A answers don't reduce to a clean short
-- label across all trades. Free text, optional, no validation beyond length.
alter table public.jobs add column if not exists job_label text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'jobs_job_label_length'
  ) then
    alter table public.jobs
      add constraint jobs_job_label_length check (char_length(job_label) <= 80);
  end if;
end $$;

-- §32e/§32d — working hours, so Calendar's capacity math ("hours booked vs
-- hours available") has something to divide by. Simple daily window, not
-- per-weekday granularity — matches the low complexity the spec calls for.
alter table public.business_profiles add column if not exists work_start_time time;
alter table public.business_profiles add column if not exists work_end_time time;
