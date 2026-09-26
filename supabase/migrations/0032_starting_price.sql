-- WorkRoute — staged onboarding. A flat fallback price Sarah can mention
-- before a tradie sets up their full per-question pricing matrix, plus a
-- guard column so the follow-up "finish your setup" reminder email only
-- ever sends once per business. Run in the Supabase SQL Editor after 0031.

alter table public.business_profiles add column if not exists starting_price numeric;
alter table public.business_profiles add column if not exists onboarding_reminder_sent_at timestamptz;
