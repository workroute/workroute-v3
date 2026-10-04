-- WorkRoute — salons/massage. A fixed-location business can have several
-- people working at once, so a time slot is only "full" once every chair is
-- taken. Defaults to 1 so every existing (tradie) business behaves exactly
-- as before. Run in the Supabase SQL Editor after 0037.

alter table public.business_profiles add column if not exists chairs integer not null default 1;
alter table public.business_profiles drop constraint if exists business_profiles_chairs_check;
alter table public.business_profiles add constraint business_profiles_chairs_check check (chairs between 1 and 20);
