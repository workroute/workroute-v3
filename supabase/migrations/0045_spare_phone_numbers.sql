-- A stock of phone numbers that are already bought and wired up (DIDLogic and
-- Vapi), waiting for a business to sign up. Giving one to a business is then
-- just pointing business_profiles at it. When a business leaves, its number
-- comes back here and rests for 30 days (available_after) before it can be
-- given to someone else.
--
-- Only the server touches this table (service role), so row level security is
-- on with no policies.

create table if not exists public.spare_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  vapi_phone_number_id text not null unique,
  didlogic_did_id text,
  -- 'spare' = waiting in stock, 'assigned' = currently on a business.
  status text not null default 'spare' check (status in ('spare', 'assigned')),
  -- A spare can't be given out before this time (the 30-day rest after release).
  available_after timestamptz not null default now(),
  assigned_business_id uuid,
  created_at timestamptz not null default now()
);

alter table public.spare_phone_numbers enable row level security;
