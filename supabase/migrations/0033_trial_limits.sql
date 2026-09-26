-- WorkRoute — free trial cutoff (14 days or 150 calls, whichever comes
-- first) so an unconverted signup can't run up real Vapi/DIDLogic/Claude
-- cost indefinitely. is_paying is a manual flag the owner flips himself
-- from the Owner Overview page — there's no automated payment webhook yet.

alter table public.business_profiles add column if not exists is_paying boolean not null default false;
alter table public.business_profiles add column if not exists trial_limit_notified_at timestamptz;

-- A heads-up before the hard cutoff, sent to the tradie themselves (not
-- Steve) so they have a real chance to convert before losing real calls —
-- a silent "sorry, out of credit" moment reflects badly on both the tradie
-- and WorkRoute.
alter table public.business_profiles add column if not exists trial_warning_sent_at timestamptz;
