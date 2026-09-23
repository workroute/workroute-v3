-- WorkRoute — business-kilometre trip log (§42), piggybacking on the "On the
-- way" ETA feature. NOT a formal ATO 12-week logbook (no odometer readings,
-- no private-trip tracking) — a supporting record for the simpler
-- cents-per-km method, or general reference at tax time. Run this in the
-- Supabase SQL Editor.

create table if not exists public.trip_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(user_id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,

  trip_date date not null,
  origin_label text,
  destination_label text,
  distance_km numeric,
  reason text,

  created_at timestamptz not null default now()
);

create index if not exists trip_logs_business_id_idx on public.trip_logs (business_id, trip_date);

alter table public.trip_logs enable row level security;

drop policy if exists "Users can view their own trip logs" on public.trip_logs;
create policy "Users can view their own trip logs"
  on public.trip_logs for select
  using (auth.uid() = business_id);

drop policy if exists "Users can insert their own trip logs" on public.trip_logs;
create policy "Users can insert their own trip logs"
  on public.trip_logs for insert
  with check (auth.uid() = business_id);
