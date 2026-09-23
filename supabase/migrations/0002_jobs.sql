-- WorkRoute — Phase 1: jobs table (§10 Job Card) + arrival photo storage (§10a, §14)
-- Run this in the Supabase SQL Editor after 0001_init.sql.

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(user_id) on delete cascade,

  -- How the job came in
  source text not null check (source in ('call', 'missed_call', 'sms', 'form')),

  -- Customer + location
  customer_name text not null,
  customer_phone text,
  address_street text,
  address_suburb text,
  address_postcode text,

  -- Trade-specific answers (§8a) — shape varies by trade, so it's stored as
  -- flexible JSON keyed by question id rather than one column per question.
  trade_answers jsonb not null default '{}'::jsonb,

  -- Estimate
  estimated_duration_minutes integer,
  estimated_price numeric(10, 2),
  quote_required boolean not null default false,

  -- Confidence + status
  confidence text not null check (confidence in ('High', 'Medium', 'Low')),
  status text not null default 'Unscheduled'
    check (status in ('Unscheduled', 'Scheduled', 'On the way', 'Running late', 'Completed')),

  -- Arrival photo (§10a) — path inside the job-photos storage bucket, not the
  -- file itself. Prefixed with business_id so storage policies can check
  -- ownership just from the path (see policies below).
  arrival_photo_path text,
  arrival_photo_taken_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_business_id_idx on public.jobs (business_id);

alter table public.jobs enable row level security;

drop policy if exists "Users can view their own jobs" on public.jobs;
create policy "Users can view their own jobs"
  on public.jobs for select
  using (auth.uid() = business_id);

drop policy if exists "Users can insert their own jobs" on public.jobs;
create policy "Users can insert their own jobs"
  on public.jobs for insert
  with check (auth.uid() = business_id);

drop policy if exists "Users can update their own jobs" on public.jobs;
create policy "Users can update their own jobs"
  on public.jobs for update
  using (auth.uid() = business_id);

drop policy if exists "Users can delete their own jobs" on public.jobs;
create policy "Users can delete their own jobs"
  on public.jobs for delete
  using (auth.uid() = business_id);

-- Arrival photo storage (§10a / §14) -----------------------------------

-- Private bucket: photos aren't publicly reachable by URL, only by a
-- signed URL your own account can request.
insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', false)
on conflict (id) do nothing;

-- Every uploaded file's path must start with "<business_id>/...". These
-- policies check that prefix against the logged-in user's id, so a tradie
-- can only read/write photos filed under their own business_id — this is
-- the storage-level version of the tagging required by §14.
drop policy if exists "Users can upload their own job photos" on storage.objects;
create policy "Users can upload their own job photos"
  on storage.objects for insert
  with check (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can view their own job photos" on storage.objects;
create policy "Users can view their own job photos"
  on storage.objects for select
  using (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own job photos" on storage.objects;
create policy "Users can delete their own job photos"
  on storage.objects for delete
  using (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
