-- Engineer OS v0.5
-- Content automation + certification/readiness metadata
-- Run once in Supabase SQL Editor.

alter table public.learning_units
  add column if not exists content_version text;

alter table public.quiz_questions
  add column if not exists content_key text;

alter table public.quiz_questions
  add column if not exists tags jsonb default '[]'::jsonb;

create unique index if not exists uq_quiz_questions_content_key
  on public.quiz_questions(content_key)
  where content_key is not null;

create table if not exists public.readiness_tracks (
  slug text primary key,
  name text not null,
  description text,
  target_mastery integer not null default 80 check (target_mastery between 0 and 100),
  target_progress integer not null default 100 check (target_progress between 0 and 100),
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.readiness_track_skills (
  track_slug text not null references public.readiness_tracks(slug) on delete cascade,
  skill_id bigint not null references public.skills(id) on delete cascade,
  weight numeric not null default 1,
  primary key (track_slug, skill_id)
);

alter table public.readiness_tracks enable row level security;
alter table public.readiness_track_skills enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='readiness_tracks' and policyname='Anyone can read readiness tracks'
  ) then
    create policy "Anyone can read readiness tracks" on public.readiness_tracks for select to anon, authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='readiness_track_skills' and policyname='Anyone can read readiness track skills'
  ) then
    create policy "Anyone can read readiness track skills" on public.readiness_track_skills for select to anon, authenticated using (true);
  end if;
end $$;

grant select on public.readiness_tracks to anon, authenticated;
grant select on public.readiness_track_skills to anon, authenticated;

insert into public.readiness_tracks(slug,name,description,target_mastery,target_progress)
values(
  'foundation-gate',
  'Foundation Readiness Gate',
  'Linux・Network・AWSへ進む前に、基礎知識を説明でき、復習でも再現できる状態を確認するゲート。',
  80,
  100
)
on conflict (slug) do update set
  name=excluded.name,
  description=excluded.description,
  target_mastery=excluded.target_mastery,
  target_progress=excluded.target_progress,
  updated_at=now();

insert into public.readiness_track_skills(track_slug,skill_id,weight)
select 'foundation-gate', id, 1
from public.skills
where slug='computer-fundamentals'
on conflict (track_slug,skill_id) do nothing;
