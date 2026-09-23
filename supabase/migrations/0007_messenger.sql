-- WorkRoute — Phase 1: WorkRoute Messenger (§13/§23 follow-on)
-- Run this in the Supabase SQL Editor after 0001-0006.
--
-- SMS becomes a one-way invitation only; the actual two-way conversation
-- happens in an in-house, white-labeled web chat reachable via a per-job
-- unguessable link. An AI agent replies in-character as the tradie's
-- business (never "WorkRoute" — §23) and can check for a schedule conflict
-- and reschedule the job itself when it's confident and the slot is free;
-- anything it can't resolve gets a Low/Medium/High priority for the tradie.

alter table public.jobs add column if not exists customer_access_token uuid not null default gen_random_uuid();
alter table public.jobs add column if not exists ai_paused boolean not null default false;
alter table public.jobs add column if not exists attention_priority text check (attention_priority in ('low', 'medium', 'high'));
-- attention_priority is null == nothing outstanding. Set by the AI classifier
-- (see lib/messenger-ai.ts), cleared by the trigger below — a tradie reply
-- is itself the resolution to whatever needed attention.

-- Also serves as the fast lookup index both RPC functions below need.
create unique index if not exists jobs_customer_access_token_idx on public.jobs (customer_access_token);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  business_id uuid not null references public.business_profiles(user_id) on delete cascade,
  sender text not null check (sender in ('customer', 'ai', 'tradie')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists messages_job_id_created_at_idx on public.messages (job_id, created_at);

alter table public.messages enable row level security;

-- Only select/insert — messages are an append-only conversation log, no
-- update/delete path needed anywhere in the app.
drop policy if exists "Users can view their own messages" on public.messages;
create policy "Users can view their own messages"
  on public.messages for select
  using (auth.uid() = business_id);

-- A tradie's own authenticated client-side call can only ever insert as
-- themselves — without the sender check, nothing stops it inserting a
-- sender: 'customer' or 'ai' row and impersonating the other two paths.
drop policy if exists "Users can send messages as themselves" on public.messages;
create policy "Users can send messages as themselves"
  on public.messages for insert
  with check (auth.uid() = business_id and sender = 'tradie');

-- A tradie replying is itself the resolution to whatever needed attention,
-- and it means the AI should stop auto-replying on this job going forward.
-- Enforced here so this invariant can't be missed by a future code path.
create or replace function public.messages_tradie_reply_pauses_ai()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.sender = 'tradie' then
    update public.jobs
    set ai_paused = true, attention_priority = null
    where id = new.job_id;
  end if;
  return new;
end;
$$;

drop trigger if exists messages_tradie_reply_pauses_ai_trigger on public.messages;
create trigger messages_tradie_reply_pauses_ai_trigger
  after insert on public.messages
  for each row
  execute function public.messages_tradie_reply_pauses_ai();

-- §Messenger — unauthenticated customer access, gated only by knowing the
-- job's token (an unguessable uuid, same trust model as a calendar-invite
-- link). SECURITY DEFINER so these can run without an auth.uid() at all;
-- each function is itself the entire security boundary, so search_path is
-- pinned and execute grants are explicit rather than left at the default.
--
-- Deliberately NOT exposing a third "insert an ai/tradie message" function
-- here — anything reachable via supabase.rpc() with the public anon key is
-- exactly as public as a REST endpoint, and a public "insert an
-- official-looking business reply into any thread by token" function would
-- let anyone impersonate the business. AI replies are only ever inserted
-- from the trusted server route (see lib/supabase/service-role.ts).

create or replace function public.messenger_get_thread(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'job_id', j.id,
    'business_id', j.business_id,
    'ai_paused', j.ai_paused,
    'status', j.status,
    'scheduled_date', j.scheduled_date,
    'scheduled_time', j.scheduled_time,
    'scheduled_block', j.scheduled_block,
    'customer_name', j.customer_name,
    'business_name', bp.business_name,
    'first_name', bp.first_name,
    'messages', coalesce(
      (select jsonb_agg(jsonb_build_object(
         'id', m.id,
         'sender', m.sender,
         'body', m.body,
         'created_at', m.created_at
       ) order by m.created_at)
       from public.messages m
       where m.job_id = j.id),
      '[]'::jsonb
    )
  )
  into result
  from public.jobs j
  join public.business_profiles bp on bp.user_id = j.business_id
  where j.customer_access_token = p_token;

  return result;
end;
$$;

create or replace function public.messenger_send_customer_message(p_token uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id uuid;
  v_business_id uuid;
  v_message jsonb;
begin
  select id, business_id into v_job_id, v_business_id
  from public.jobs
  where customer_access_token = p_token;

  if v_job_id is null then
    raise exception 'invalid token';
  end if;

  insert into public.messages (job_id, business_id, sender, body)
  values (v_job_id, v_business_id, 'customer', p_body)
  returning jsonb_build_object('id', id, 'sender', sender, 'body', body, 'created_at', created_at)
  into v_message;

  return v_message;
end;
$$;

revoke all on function public.messenger_get_thread(uuid) from public;
grant execute on function public.messenger_get_thread(uuid) to anon, authenticated;

revoke all on function public.messenger_send_customer_message(uuid, text) from public;
grant execute on function public.messenger_send_customer_message(uuid, text) to anon, authenticated;
