-- Invoice chasing — see lib/invoice-chase.ts. A bank-transfer/invoice-later
-- job has no payment processor telling WorkRoute it was actually paid, so
-- invoice_paid_at is a manual tradie toggle (job detail page). The other two
-- columns debounce the week-1 SMS reminder and week-2 phone-call escalation
-- so a retried/duplicate cron run can't double-send either.
alter table public.jobs add column if not exists invoice_paid_at timestamptz;
alter table public.jobs add column if not exists invoice_reminder_sent_at timestamptz;
alter table public.jobs add column if not exists invoice_reminder_call_at timestamptz;

-- phone_call_captures.call_purpose (0017_reactivation_calling.sql) only
-- allowed 'inbound'/'reactivation' — add the week-2 escalation call as a
-- third purpose.
alter table public.phone_call_captures drop constraint if exists phone_call_captures_call_purpose_check;
alter table public.phone_call_captures add constraint phone_call_captures_call_purpose_check
  check (call_purpose in ('inbound', 'reactivation', 'invoice_chase'));
