-- WorkRoute — real invoice numbers, bank details for transfer, and a
-- Zapier webhook for accounting sync (§55). All three fire automatically
-- from the same existing "send completion" action — no new per-job steps.
-- Run this in the Supabase SQL Editor.

alter table public.business_profiles add column if not exists next_invoice_number integer not null default 1;
alter table public.business_profiles add column if not exists bank_details text;
alter table public.business_profiles add column if not exists zapier_webhook_url text;

alter table public.jobs add column if not exists invoice_number integer;
