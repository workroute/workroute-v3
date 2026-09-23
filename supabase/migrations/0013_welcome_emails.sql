-- Welcome email — sent once per user, right after they confirm their
-- signup email and land on /app/welcome. This table is the idempotency
-- guard: the primary key means a second attempt (double-click on the
-- confirmation link, an email client pre-scanning it, a retry) just hits a
-- conflict and skips sending, rather than re-firing the email. Server-only
-- (service role) — no client ever reads or writes this directly.
create table if not exists public.welcome_emails_sent (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now()
);

alter table public.welcome_emails_sent enable row level security;
