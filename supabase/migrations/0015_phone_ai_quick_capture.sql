-- WorkRoute — Phase 1: Phone AI simplified to quick-capture (§25 revision)
-- Run this in the Supabase SQL Editor after 0014.
--
-- Real test calls showed a live, AI-quoted conversation was a bad phone
-- experience — too many questions, too slow. Revised design: the AI just
-- captures name/contact/brief job description (no live pricing Q&A) and
-- notifies the tradie to quote it themselves, same as any other enquiry —
-- except a recognized returning client (caller ID matched against an
-- existing clients row) can be booked straight in without re-asking
-- everything. This column records which client, if any, was matched at the
-- start of the call, so later tool calls in the same call (a separate
-- stateless webhook request each time) can link the job to that client.

alter table public.phone_call_captures
  add column if not exists matched_client_id uuid references public.clients(id) on delete set null;
