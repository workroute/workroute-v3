-- A salon or massage business can set up its own list of services instead of
-- the built-in one (for example adding Balayage or a Beard trim, or removing
-- Kids cut). null means "use the built-in list". The list holds the service
-- names; each name is also the key its price is saved under on the Pricing page.

alter table public.business_profiles add column if not exists custom_services jsonb;
