-- WorkRoute — job completion ("after") photo (§54), pairing with the
-- existing arrival_photo (§10a) as the "before" shot. Both purposes: proof
-- of work done, and protection for the tradie if a customer who wasn't home
-- later claims something was damaged. Reuses the existing "job-photos"
-- storage bucket — no new bucket/policy needed.
-- Run this in the Supabase SQL Editor.

alter table public.jobs add column if not exists completion_photo_path text;
alter table public.jobs add column if not exists completion_photo_taken_at timestamptz;
