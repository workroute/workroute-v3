-- §pronunciation-fixes — a small per-business list of {word, phonetic}
-- pairs so Sarah can be corrected when the text-to-speech engine
-- mispronounces a business name, suburb, or trade term. Never applied to
-- anything written down (SMS, invoices, emails) — spoken calls only.

alter table public.business_profiles add column if not exists pronunciation_overrides jsonb not null default '[]'::jsonb;
