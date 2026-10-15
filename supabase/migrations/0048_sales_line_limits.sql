-- WorkRoute's own sales phone line (the demo number on the website) costs real
-- money on every call and brings in none directly. This table records each call
-- to it, so we can:
--   - limit how many times one caller can ring in a day,
--   - see what the demo line costs each month on Owner Overview,
--   - warn the owner when the month gets busy.
-- Only the server touches it (service role), so row level security is on with
-- no policies.

create table if not exists public.sales_line_calls (
  id uuid primary key default gen_random_uuid(),
  vapi_call_id text not null unique,
  caller_number text,
  duration_seconds integer,
  vapi_cost_usd numeric,
  tts_characters integer,
  created_at timestamptz not null default now()
);

create index if not exists sales_line_calls_caller_idx
  on public.sales_line_calls (caller_number, created_at);

alter table public.sales_line_calls enable row level security;

-- Which month the owner was last warned that the demo line is busy (set on the
-- owner's own business row), so the warning goes out once a month.
alter table public.business_profiles add column if not exists demo_line_alerted_month text;
