-- WorkRoute — real call cost tracking. Vapi sends each call's duration and cost
-- in its end-of-call report; saving them lets the Owner Overview show what
-- every business actually costs to run, instead of guessing. vapi_cost_usd is
-- what Vapi bills (platform + speech-to-text + AI model); ElevenLabs voice and
-- the phone line are billed separately, so tts_characters is kept to estimate
-- the voice cost. Run in the Supabase SQL Editor after 0039.

alter table public.phone_call_captures add column if not exists duration_seconds integer;
alter table public.phone_call_captures add column if not exists vapi_cost_usd numeric(10, 4);
alter table public.phone_call_captures add column if not exists tts_characters integer;
