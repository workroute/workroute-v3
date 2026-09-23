-- WorkRoute — Google review request, piggybacking on the completion recap (§40)
-- Run this in the Supabase SQL Editor.

alter table public.business_profiles add column if not exists google_review_link text;
