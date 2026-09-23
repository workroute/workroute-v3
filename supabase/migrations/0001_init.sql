-- WorkRoute — Phase 1: business_profiles table
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query).

create table if not exists public.business_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null,
  trade text not null,
  abn text,
  phone text,
  service_area text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row Level Security: without this, any logged-in user could read or edit
-- every other tradie's business profile through the API. This locks each
-- row to the user who owns it.
alter table public.business_profiles enable row level security;

create policy "Users can view their own profile"
  on public.business_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert their own profile"
  on public.business_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own profile"
  on public.business_profiles for update
  using (auth.uid() = user_id);
