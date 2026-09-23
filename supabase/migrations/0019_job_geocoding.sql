-- Google Maps integration: real lat/lng per job, so scheduling can check
-- actual driving time between same-day jobs instead of only a same-slot
-- time conflict (lib/messenger-scheduling.ts's documented v1 gap). Also
-- doubles as address validation — a geocode failure means Sarah heard
-- something that isn't a real address (the STT "Trees"/"Street" problem),
-- surfaced back to the caller instead of silently saved wrong.
alter table jobs add column if not exists latitude double precision;
alter table jobs add column if not exists longitude double precision;
