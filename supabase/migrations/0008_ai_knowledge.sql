-- WorkRoute — Phase 1: AI Knowledge (§Messenger follow-on)
-- Run this in the Supabase SQL Editor after 0001-0007.
--
-- Practical, not machine-learning "training": when a tradie resolves a
-- Needs Attention item, the business owner can mark that resolution as a
-- reusable example — "Good response" saves it as-is, "Improve response"
-- lets them clean it up first. Approved examples get pulled into the AI's
-- system prompt (see lib/ai-knowledge.ts, lib/messenger-ai.ts) as
-- calibration examples of how this specific business actually handles
-- things, not literal facts to repeat regardless of fit.

create table if not exists public.ai_knowledge (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(user_id) on delete cascade,
  -- Nullable + set null on delete: the job itself may eventually be
  -- archived/removed, but the learned pattern should outlive it.
  job_id uuid references public.jobs(id) on delete set null,

  customer_message text not null,
  ai_reply text,
  resolution text not null,
  rating text not null check (rating in ('good', 'improved')),

  created_at timestamptz not null default now()
);

create index if not exists ai_knowledge_business_id_idx on public.ai_knowledge (business_id, created_at desc);

alter table public.ai_knowledge enable row level security;

drop policy if exists "Users can view their own AI knowledge" on public.ai_knowledge;
create policy "Users can view their own AI knowledge"
  on public.ai_knowledge for select
  using (auth.uid() = business_id);

drop policy if exists "Users can add their own AI knowledge" on public.ai_knowledge;
create policy "Users can add their own AI knowledge"
  on public.ai_knowledge for insert
  with check (auth.uid() = business_id);

drop policy if exists "Users can delete their own AI knowledge" on public.ai_knowledge;
create policy "Users can delete their own AI knowledge"
  on public.ai_knowledge for delete
  using (auth.uid() = business_id);
