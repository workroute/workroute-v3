-- WorkRoute — "Sarah fills the gap". When an appointment is cancelled, clients
-- with LATER bookings are texted a one-tap offer to move up into the freed
-- time. First to tap wins; their old time then frees up and can be offered on.
-- Run in the Supabase SQL Editor after 0040.

-- 1. A cancelled appointment keeps its row (history, client record) but is
--    no longer "live": every schedule/availability query excludes it.
alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs add constraint jobs_status_check
  check (status in ('Unscheduled', 'Scheduled', 'On the way', 'Running late', 'Completed', 'Cancelled'));
alter table public.jobs add column if not exists cancelled_at timestamptz;

-- 2. A client can turn these offers off ("don't text me about this").
alter table public.clients add column if not exists gap_offers_opt_out boolean not null default false;

-- 3. One row per text sent. token is the unguessable link in the SMS; batch_id
--    groups everyone offered the same freed slot so only one can win.
create table if not exists public.slot_offers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  source_job_id uuid references public.jobs(id) on delete set null,
  batch_id uuid not null,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  slot_date date not null,
  slot_time time not null,
  slot_duration_minutes integer not null default 60,
  slot_staff text,
  depth integer not null default 0,
  status text not null default 'offered'
    check (status in ('offered', 'claimed', 'declined', 'expired', 'superseded')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

-- Only one person can ever claim a freed slot, even if two tap in the same
-- instant: the second insert/update hits this index and is turned away.
create unique index if not exists slot_offers_one_claim_per_batch
  on public.slot_offers (batch_id) where status = 'claimed';
create index if not exists slot_offers_job_idx on public.slot_offers (job_id, status);
create index if not exists slot_offers_business_idx on public.slot_offers (business_id, created_at desc);

-- Owners can read their own offers; every write goes through the server
-- (service role), and the public claim page only ever sees one row by token.
alter table public.slot_offers enable row level security;
drop policy if exists "owner reads own slot offers" on public.slot_offers;
create policy "owner reads own slot offers" on public.slot_offers
  for select using (business_id = auth.uid());
