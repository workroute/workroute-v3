-- WorkRoute — Phase 1: client records (§19)
-- Run this in the Supabase SQL Editor after 0001-0003.

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(user_id) on delete cascade,

  name text not null,
  phone text,
  address_street text,
  address_suburb text,
  address_postcode text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_business_id_idx on public.clients (business_id);
-- Backs the name/phone autocomplete search on job capture and the clients list.
create index if not exists clients_business_name_idx on public.clients (business_id, lower(name));

alter table public.clients enable row level security;

drop policy if exists "Users can view their own clients" on public.clients;
create policy "Users can view their own clients"
  on public.clients for select
  using (auth.uid() = business_id);

drop policy if exists "Users can insert their own clients" on public.clients;
create policy "Users can insert their own clients"
  on public.clients for insert
  with check (auth.uid() = business_id);

drop policy if exists "Users can update their own clients" on public.clients;
create policy "Users can update their own clients"
  on public.clients for update
  using (auth.uid() = business_id);

drop policy if exists "Users can delete their own clients" on public.clients;
create policy "Users can delete their own clients"
  on public.clients for delete
  using (auth.uid() = business_id);

-- Link jobs to a client (§19). Nullable — jobs captured before this
-- migration have no client, and set null on delete so removing a client
-- doesn't wipe out the jobs that referenced them.
alter table public.jobs add column if not exists client_id uuid references public.clients(id) on delete set null;

create index if not exists jobs_client_id_idx on public.jobs (client_id);
