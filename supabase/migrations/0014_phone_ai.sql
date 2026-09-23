-- WorkRoute — Phase 1: Phone Voice Intake (§25), VIP Caller SMS Alert (§34a)
-- Run this in the Supabase SQL Editor after 0001-0013.
--
-- §25's adaptive phone AI reuses the Messenger's "AI interprets, deterministic
-- system decides" architecture (§24), but over a live call via Vapi instead
-- of async text. Vapi drives the conversation loop itself (with Claude as
-- the model provider) and calls our webhook per tool-use — see
-- lib/phone-ai.ts and app/api/vapi/webhook/route.ts.

-- Which Vapi phone number belongs to which business, so the inbound
-- assistant-request webhook (no auth context — it's Vapi, not a signed-in
-- tradie) knows whose trade/pricing/questions to use. Set once per business
-- from the Vapi dashboard's number ID after provisioning a number there —
-- no self-serve provisioning UI in Phase 1, see §25 build notes.
alter table public.business_profiles add column if not exists vapi_phone_number_id text;
alter table public.business_profiles add column if not exists vapi_phone_number text;

create unique index if not exists business_profiles_vapi_phone_number_id_idx
  on public.business_profiles (vapi_phone_number_id)
  where vapi_phone_number_id is not null;

-- §34a — a short list of numbers that get an instant "so-and-so is calling"
-- SMS heads-up the moment they call, in place of the live-transfer VIP
-- bypass that turned out to be technically unworkable (unconditional
-- forwarding loops back to the same number). The AI still answers these
-- calls normally; this is a parallel notification, not a routing change.
create table if not exists public.vip_contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(user_id) on delete cascade,

  name text not null,
  phone text not null,
  -- Digits-only, last-9 form (see lib/phone-utils.ts normalizePhone) — the
  -- caller ID Vapi reports and however a tradie happens to type a number in
  -- rarely match byte-for-byte (spacing, +61 vs 0, etc.), so matching is
  -- done against this rather than the display `phone` column.
  phone_normalized text not null,

  created_at timestamptz not null default now()
);

create index if not exists vip_contacts_business_lookup_idx
  on public.vip_contacts (business_id, phone_normalized);

alter table public.vip_contacts enable row level security;

drop policy if exists "Users can view their own VIP contacts" on public.vip_contacts;
create policy "Users can view their own VIP contacts"
  on public.vip_contacts for select
  using (auth.uid() = business_id);

drop policy if exists "Users can insert their own VIP contacts" on public.vip_contacts;
create policy "Users can insert their own VIP contacts"
  on public.vip_contacts for insert
  with check (auth.uid() = business_id);

drop policy if exists "Users can delete their own VIP contacts" on public.vip_contacts;
create policy "Users can delete their own VIP contacts"
  on public.vip_contacts for delete
  using (auth.uid() = business_id);

-- §25 — the audit trail for AI-captured calls: "Captured by AI intake,
-- [timestamp]" plus the full transcript underneath, same principle as §24's
-- message log. One row per Vapi call. job_id starts null and is filled in
-- once the AI has enough to create the job (see lib/phone-ai.ts
-- update_job_draft) — a call that never gets that far still leaves this row
-- as a record of what was said.
create table if not exists public.phone_call_captures (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(user_id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,

  vapi_call_id text not null unique,
  caller_number text,

  -- Structured turn list ({role, text}[]) — richer than the flattened
  -- transcript string Vapi also sends, kept as-is for the plain-text view.
  transcript_messages jsonb not null default '[]'::jsonb,
  transcript_text text,

  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'failed')),
  ended_reason text,

  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists phone_call_captures_business_id_idx
  on public.phone_call_captures (business_id, created_at desc);
create index if not exists phone_call_captures_job_id_idx
  on public.phone_call_captures (job_id);

alter table public.phone_call_captures enable row level security;

-- Select-only: this table is never written by an authenticated tradie
-- session, only by the Vapi webhook via the service-role client (same
-- pattern as AI-authored Messenger rows in lib/messenger-ai.ts).
drop policy if exists "Users can view their own phone call captures" on public.phone_call_captures;
create policy "Users can view their own phone call captures"
  on public.phone_call_captures for select
  using (auth.uid() = business_id);
