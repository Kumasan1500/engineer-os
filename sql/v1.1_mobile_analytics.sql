-- Engineer OS v1.1 — Mobile UX & Learning Analytics
-- Run once in Supabase SQL Editor after v1.0_productization.sql.
-- Adds accurate active-time dimensions while preserving all existing sessions.

alter table public.study_sessions drop constraint if exists study_sessions_source_check;

alter table public.study_sessions add constraint study_sessions_source_check check (source in ('lesson','review','mission','mock','lab','project'));

alter table public.study_sessions
  add column if not exists lesson_seconds integer not null default 0 check (lesson_seconds >= 0),
  add column if not exists quiz_seconds integer not null default 0 check (quiz_seconds >= 0),
  add column if not exists review_seconds integer not null default 0 check (review_seconds >= 0),
  add column if not exists interaction_count integer not null default 0 check (interaction_count >= 0),
  add column if not exists device_session_id text,
  add column if not exists device_type text not null default 'unknown';

-- Existing v0.6 rows only had active_seconds. Keep those totals intact.
-- New v1.1 sessions write the detailed phase columns above.

create unique index if not exists uq_study_sessions_user_device_session
  on public.study_sessions(user_id, device_session_id)
  where device_session_id is not null;

create index if not exists idx_study_sessions_user_started_active
  on public.study_sessions(user_id, started_at desc, active_seconds);

create index if not exists idx_study_sessions_user_unit_started
  on public.study_sessions(user_id, unit_id, started_at desc);

-- Helpful read-only aggregate for the authenticated user.
create or replace function public.my_study_time_summary()
returns table (
  total_seconds bigint,
  today_seconds bigint,
  week_seconds bigint,
  month_seconds bigint,
  lesson_seconds bigint,
  quiz_seconds bigint,
  review_seconds bigint,
  session_count bigint,
  study_days bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(sum(active_seconds),0)::bigint,
    coalesce(sum(active_seconds) filter (where started_at >= date_trunc('day', now())),0)::bigint,
    coalesce(sum(active_seconds) filter (where started_at >= date_trunc('week', now())),0)::bigint,
    coalesce(sum(active_seconds) filter (where started_at >= date_trunc('month', now())),0)::bigint,
    coalesce(sum(lesson_seconds),0)::bigint,
    coalesce(sum(quiz_seconds),0)::bigint,
    coalesce(sum(review_seconds),0)::bigint,
    count(*)::bigint,
    count(distinct started_at::date)::bigint
  from public.study_sessions
  where user_id = auth.uid() and active_seconds > 0;
$$;

grant execute on function public.my_study_time_summary() to authenticated;
