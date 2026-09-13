-- Engineer OS v0.4
-- Mastery / spaced review / weak-question tracking
-- Run once in Supabase SQL Editor after v0.2_progress_and_auth.sql.

-- Unit-level retention / review metadata.
alter table public.user_progress
  add column if not exists retention_score integer default 0 check (retention_score between 0 and 100);

alter table public.user_progress
  add column if not exists last_score integer default 0 check (last_score between 0 and 100);

alter table public.user_progress
  add column if not exists review_due_at timestamptz;

-- Per-question mastery. This powers weak-question priority and spaced repetition.
create table if not exists public.user_question_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id bigint not null references public.quiz_questions(id) on delete cascade,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  current_streak integer not null default 0,
  mastery_score integer not null default 0 check (mastery_score between 0 and 100),
  last_answered_at timestamptz,
  next_review_at timestamptz,
  primary key (user_id, question_id)
);

alter table public.user_question_stats enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_question_stats'
      and policyname='Users can view own question stats'
  ) then
    create policy "Users can view own question stats"
      on public.user_question_stats for select to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_question_stats'
      and policyname='Users can insert own question stats'
  ) then
    create policy "Users can insert own question stats"
      on public.user_question_stats for insert to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_question_stats'
      and policyname='Users can update own question stats'
  ) then
    create policy "Users can update own question stats"
      on public.user_question_stats for update to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

grant select, insert, update on public.user_question_stats to authenticated;

create index if not exists idx_question_stats_user_review
  on public.user_question_stats(user_id, next_review_at);
create index if not exists idx_question_stats_user_mastery
  on public.user_question_stats(user_id, mastery_score);
create index if not exists idx_user_progress_review_due
  on public.user_progress(user_id, review_due_at);

-- Backfill existing completed units with a conservative retention score.
-- A one-time pass is treated as familiarity, not full long-term mastery.
update public.user_progress
set retention_score = case
  when status = 'completed' and coalesce(retention_score, 0) = 0 then 25
  else coalesce(retention_score, 0)
end,
last_score = case
  when coalesce(last_score, 0) = 0 then coalesce(mastery_score, 0)
  else last_score
end,
review_due_at = case
  when status = 'completed' and review_due_at is null then now()
  else review_due_at
end;
