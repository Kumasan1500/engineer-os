-- Engineer OS v0.6
-- Learning OS core: resumable study, study-time history, streaks, and session tracking.
-- Run once in Supabase SQL Editor after the earlier v0.2/v0.4/v0.5 migrations.

create table if not exists public.user_learning_drafts (
  user_id uuid not null references auth.users(id) on delete cascade,
  unit_id bigint not null references public.learning_units(id) on delete cascade,
  scroll_y integer not null default 0,
  answers jsonb not null default '{}'::jsonb,
  question_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, unit_id)
);

create table if not exists public.study_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  unit_id bigint references public.learning_units(id) on delete set null,
  source text not null default 'lesson' check (source in ('lesson','review','mission','mock','lab')),
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  ended_at timestamptz,
  active_seconds integer not null default 0 check (active_seconds >= 0)
);

alter table public.user_learning_drafts enable row level security;
alter table public.study_sessions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_learning_drafts' and policyname='Users can view own learning drafts') then
    create policy "Users can view own learning drafts" on public.user_learning_drafts for select to authenticated using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_learning_drafts' and policyname='Users can insert own learning drafts') then
    create policy "Users can insert own learning drafts" on public.user_learning_drafts for insert to authenticated with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_learning_drafts' and policyname='Users can update own learning drafts') then
    create policy "Users can update own learning drafts" on public.user_learning_drafts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_learning_drafts' and policyname='Users can delete own learning drafts') then
    create policy "Users can delete own learning drafts" on public.user_learning_drafts for delete to authenticated using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_sessions' and policyname='Users can view own study sessions') then
    create policy "Users can view own study sessions" on public.study_sessions for select to authenticated using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_sessions' and policyname='Users can insert own study sessions') then
    create policy "Users can insert own study sessions" on public.study_sessions for insert to authenticated with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_sessions' and policyname='Users can update own study sessions') then
    create policy "Users can update own study sessions" on public.study_sessions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

grant select, insert, update, delete on public.user_learning_drafts to authenticated;
grant select, insert, update on public.study_sessions to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create index if not exists idx_learning_drafts_updated on public.user_learning_drafts(user_id, updated_at desc);
create index if not exists idx_study_sessions_user_started on public.study_sessions(user_id, started_at desc);
create index if not exists idx_study_sessions_user_unit on public.study_sessions(user_id, unit_id);
