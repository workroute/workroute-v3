-- WorkRoute — voice-recorded job completion recap (§39)
-- Run this in the Supabase SQL Editor.

-- Optional customer email, alongside the existing optional phone. Needed so
-- a completion summary can be emailed, not just posted into Messenger.
alter table public.clients add column if not exists email text;
alter table public.jobs add column if not exists customer_email text;

-- The AI-drafted (then tradie-reviewed) completion recap. Kept on the job as
-- a simple audit trail, same principle as phone_call_captures for phone
-- bookings — summary is what was actually sent, transcript is the raw
-- source material behind it.
alter table public.jobs add column if not exists completion_summary text;
alter table public.jobs add column if not exists completion_transcript text;
alter table public.jobs add column if not exists completion_sent_at timestamptz;
