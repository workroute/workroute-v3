-- WorkRoute — a real test job ("Mark Johnson") got geocoded to Parramatta
-- NSW instead of Hervey Bay QLD: the caller's suburb was misheard, Google
-- still matched a real street of the same name in the wrong city entirely,
-- and nothing caught it because a real route match was treated as fully
-- trustworthy. This gives the app a fixed reference point (the business's
-- own city, geocoded once) to sanity-check new addresses against.

alter table public.business_profiles add column if not exists service_center_lat double precision;
alter table public.business_profiles add column if not exists service_center_lng double precision;
