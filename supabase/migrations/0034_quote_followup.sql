-- §quote-followup — a quote visit (quote_required = true) used to complete
-- exactly like a real job: an invoice number burned, a payment method
-- asked, an invoice-style message sent. None of that makes sense for a
-- visit where nothing's been sold yet. These columns record the on-site
-- price actually quoted, separately from the invoice fields, and track
-- Sarah's follow-up call that asks whether the customer wants to go ahead.

alter table public.jobs add column if not exists quote_given_at timestamptz;
alter table public.jobs add column if not exists quoted_price numeric;
alter table public.jobs add column if not exists quote_followup_attempts int not null default 0;
alter table public.jobs add column if not exists quote_followup_done boolean not null default false;
