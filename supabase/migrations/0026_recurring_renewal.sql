-- Recurring series renewal reminders — see lib/recurring-jobs.ts. A
-- "Regular" series only ever pre-books OCCURRENCES_TO_CREATE (5) visits up
-- front, so this tracks whether/when the customer on the LAST of those
-- visits has been asked to renew for another batch — prompted_at stops the
-- reminder firing twice, declined_at stops a "no" being nagged again.
alter table public.jobs add column if not exists recurring_renewal_prompted_at timestamptz;
alter table public.jobs add column if not exists recurring_renewal_declined_at timestamptz;

-- messenger_get_thread (0007_messenger.sql) needs to surface these two
-- columns so the Messenger AI (lib/messenger-ai.ts) knows a reply on this
-- thread might be answering the renewal reminder.
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
    'recurring_renewal_prompted_at', j.recurring_renewal_prompted_at,
    'recurring_renewal_declined_at', j.recurring_renewal_declined_at,
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
