-- §WorkRoute sales chat — visitors on workroute.com.au who left their
-- details with Sarah (lib/workroute-sales-ai.ts), listed for the owner on
-- the Owner Overview page with whether they've since signed up. One row per
-- chat session; later details from the same chat merge into it.
--
-- Owner-only data, read and written exclusively through the service-role
-- client (the widget API route and the ADMIN_USER_ID-gated overview page),
-- so RLS is on with no policies at all.

create table if not exists public.workroute_sales_leads (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique,
  name text,
  email text,
  phone text,
  business text,
  notes text,
  trial_link_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workroute_sales_leads_created_at_idx
  on public.workroute_sales_leads (created_at desc);

alter table public.workroute_sales_leads enable row level security;
