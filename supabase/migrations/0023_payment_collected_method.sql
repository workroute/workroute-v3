-- WorkRoute — "How did you get paid?" tracking on job completion (§43,
-- Phase 1 of the pay-on-completion idea). Pure record-keeping — no payment
-- processor involved, nothing changes hands through WorkRoute here.
-- Run this in the Supabase SQL Editor.

alter table public.jobs add column if not exists payment_collected_method text
  check (payment_collected_method in ('cash', 'card', 'payid', 'bank_transfer', 'invoice_later'));
