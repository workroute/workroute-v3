-- WorkRoute — Phase 1: business city for the dashboard weather widget (§27)
-- Run this in the Supabase SQL Editor after 0001-0008.
-- Separate from the existing service_area field, which keeps its own
-- purpose — describing the broader area serviced, not a single
-- weather-lookup point. Plain text, passed directly to OpenWeatherMap
-- (same approach as the user's other project, SameNot) — no geocoding.

alter table public.business_profiles add column if not exists city text;
