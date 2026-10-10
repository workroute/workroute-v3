-- Push alerts to the owner: one when a business signs up, one when a business
-- that wants the free tablet has saved its pricing (so it's ready to post).
-- These record that each alert has been sent, so it only ever fires once.

alter table public.business_profiles add column if not exists signup_alerted_at timestamptz;
alter table public.business_profiles add column if not exists tablet_ready_alerted_at timestamptz;
