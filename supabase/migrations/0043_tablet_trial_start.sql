-- Tablet offer follow-through. A business that gets a tablet shouldn't lose
-- days of its free trial while the tablet is in the post, so the owner can
-- move the trial start to the delivery date. trial_started_at null means the
-- trial runs from signup (created_at) as before. tablet_sent_at records when
-- the owner posted the tablet.

alter table public.business_profiles add column if not exists trial_started_at timestamptz;
alter table public.business_profiles add column if not exists tablet_sent_at timestamptz;
