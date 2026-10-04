-- WorkRoute — salons/massage. The names of the people clients can ask for
-- ("book me with Jess"). Used as a dropdown on the public booking page and
-- offered by Sarah on calls; it records a preference only, it does not give
-- each person their own calendar. Run in the Supabase SQL Editor after 0038.

alter table public.business_profiles add column if not exists staff_names text[] not null default '{}';
