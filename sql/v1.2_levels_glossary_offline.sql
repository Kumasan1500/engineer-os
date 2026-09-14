-- Engineer OS v1.2 — level curriculum, detailed explanations, glossary, offline queue

alter table public.skills add column if not exists prerequisite_slugs jsonb not null default '[]'::jsonb;
alter table public.skills add column if not exists level_count integer not null default 5;

alter table public.learning_units add column if not exists level integer not null default 1 check (level between 1 and 5);
alter table public.learning_units add column if not exists level_label text;
alter table public.learning_units add column if not exists track text;
alter table public.learning_units add column if not exists competency_tags jsonb not null default '[]'::jsonb;
alter table public.learning_units add column if not exists source_refs jsonb not null default '[]'::jsonb;

alter table public.quiz_questions add column if not exists why_correct text;
alter table public.quiz_questions add column if not exists why_others_wrong jsonb not null default '{}'::jsonb;
alter table public.quiz_questions add column if not exists related_knowledge text;
alter table public.quiz_questions add column if not exists practical_use text;
alter table public.quiz_questions add column if not exists exam_traps text;

create table if not exists public.glossary_terms (
  id bigint generated always as identity primary key,
  term text unique not null,
  definition text not null,
  skill_id bigint references public.skills(id) on delete set null,
  aliases jsonb not null default '[]'::jsonb,
  level integer not null default 1 check (level between 1 and 5),
  related_terms jsonb not null default '[]'::jsonb,
  content_version text,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_glossary_library (
  user_id uuid not null references auth.users(id) on delete cascade,
  term_id bigint not null references public.glossary_terms(id) on delete cascade,
  lookup_count integer not null default 0,
  familiarity integer not null default 0 check (familiarity between 0 and 100),
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  next_review_at timestamptz,
  source_unit_id bigint references public.learning_units(id) on delete set null,
  primary key (user_id, term_id)
);

create table if not exists public.offline_learning_queue (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  synced_at timestamptz
);

alter table public.glossary_terms enable row level security;
alter table public.user_glossary_library enable row level security;
alter table public.offline_learning_queue enable row level security;

drop policy if exists "Anyone can read glossary" on public.glossary_terms;
create policy "Anyone can read glossary" on public.glossary_terms for select to anon, authenticated using (true);

drop policy if exists "Users manage own glossary library" on public.user_glossary_library;
create policy "Users manage own glossary library" on public.user_glossary_library for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own offline queue" on public.offline_learning_queue;
create policy "Users manage own offline queue" on public.offline_learning_queue for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.glossary_terms to anon, authenticated;
grant select, insert, update, delete on public.user_glossary_library to authenticated;
grant select, insert, update, delete on public.offline_learning_queue to authenticated;
grant select, insert, update, delete on public.glossary_terms to service_role;
grant usage, select, update on all sequences in schema public to service_role;

-- Existing completed Computer Fundamentals units become Level 1.
update public.learning_units
set level = 1,
    level_label = coalesce(level_label, 'L1 基礎'),
    track = coalesce(track, 'computer-fundamentals')
where slug like 'cf-%';
