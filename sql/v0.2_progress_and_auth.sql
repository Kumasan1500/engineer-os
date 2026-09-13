-- Engineer OS v0.2
-- Run once in Supabase SQL Editor.
-- Existing tables from v0.1 are reused.

-- Public learning content remains readable before login.
grant usage on schema public to anon;
grant select on public.skills to anon;
grant select on public.learning_units to anon;
grant select on public.quiz_questions to anon;

-- These policies are idempotent only when absent. If you already created them,
-- Supabase will report that the policy exists; that is harmless and you can skip those lines.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='skills' and policyname='Anon users can read skills') then
    create policy "Anon users can read skills" on public.skills for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='learning_units' and policyname='Anon users can read units') then
    create policy "Anon users can read units" on public.learning_units for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quiz_questions' and policyname='Anon users can read questions') then
    create policy "Anon users can read questions" on public.quiz_questions for select to anon using (true);
  end if;
end $$;

-- Helpful index for per-user progress lookups.
create index if not exists idx_user_progress_user_id on public.user_progress(user_id);
create index if not exists idx_quiz_attempts_user_id on public.quiz_attempts(user_id);
