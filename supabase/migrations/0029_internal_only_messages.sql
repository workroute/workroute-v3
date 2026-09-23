-- Internal-only tradie notes (e.g. "give Mark a call beforehand") were being
-- inserted into the same messages row the customer's own Messenger link
-- reads verbatim via messenger_get_thread — a customer could open their
-- link and see a note about themselves written in the third person. Default
-- true keeps every existing row (and every future customer/AI-reply/tradie
-- message) visible exactly as before; only the 4 internal-note call sites in
-- lib/phone-ai.ts and lib/widget-ai.ts are updated to pass false.
alter table public.messages add column if not exists visible_to_customer boolean not null default true;

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
       where m.job_id = j.id and m.visible_to_customer),
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
