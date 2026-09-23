-- WorkRoute — Phase 1: tradie's first name on the business profile (§23)
-- Run this in the Supabase SQL Editor after 0001-0005.
-- §23: WorkRoute must never appear in anything a customer sees. This lets
-- the §13 "On the way" SMS say "John from Doyle Electrical" instead of
-- exposing the WorkRoute product name. Nullable — existing profiles won't
-- have one until the tradie next saves their profile; the SMS template
-- falls back to the business name alone until then.

alter table public.business_profiles add column if not exists first_name text;
