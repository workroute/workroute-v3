-- Free tablet offer: a business can tick "I'd like the free tablet offer" at
-- sign-up. The acceptance (and which version of the wording they saw) is
-- copied onto the business when its profile is first created, so the owner
-- can see who's accepted on the Owner Overview page.

alter table public.business_profiles add column if not exists tablet_offer_accepted_at timestamptz;
alter table public.business_profiles add column if not exists tablet_offer_version text;
