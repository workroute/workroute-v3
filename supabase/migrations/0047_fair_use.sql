-- Fair usage: a paying business gets a friendly heads-up when it nears its
-- monthly call allowance, and again if it passes it. These record which month
-- each message was last sent for (for example '2026-10'), so each goes out
-- once a month, however many calls come in afterwards.

alter table public.business_profiles add column if not exists fair_use_warned_month text;
alter table public.business_profiles add column if not exists fair_use_limit_month text;
