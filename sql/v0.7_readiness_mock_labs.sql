-- Engineer OS v0.7
-- Readiness / mock exam / hands-on labs framework.
-- Run once in Supabase SQL Editor after v0.6.

create table if not exists public.certification_tracks (
  id bigint generated always as identity primary key,
  slug text unique not null,
  name text not null,
  provider text,
  description text,
  mastery_target integer not null default 80 check (mastery_target between 0 and 100),
  mock_pass_score integer not null default 85 check (mock_pass_score between 0 and 100),
  required_mock_passes integer not null default 3 check (required_mock_passes >= 0),
  required_labs integer not null default 0 check (required_labs >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.hands_on_labs (
  id bigint generated always as identity primary key,
  track_id bigint references public.certification_tracks(id) on delete set null,
  slug text unique not null,
  title text not null,
  description text,
  instructions jsonb not null default '[]'::jsonb,
  success_criteria jsonb not null default '[]'::jsonb,
  estimated_minutes integer not null default 20,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_lab_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  lab_id bigint not null references public.hands_on_labs(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed')),
  notes text,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lab_id)
);

create table if not exists public.mock_exams (
  id bigint generated always as identity primary key,
  track_id bigint references public.certification_tracks(id) on delete cascade,
  slug text unique not null,
  name text not null,
  question_count integer not null default 20 check (question_count > 0),
  time_limit_minutes integer not null default 30 check (time_limit_minutes > 0),
  pass_score integer not null default 85 check (pass_score between 0 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.mock_exam_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  mock_exam_id bigint not null references public.mock_exams(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  correct_count integer not null default 0,
  total_questions integer not null default 0,
  answers jsonb not null default '{}'::jsonb,
  question_ids jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

alter table public.certification_tracks enable row level security;
alter table public.hands_on_labs enable row level security;
alter table public.user_lab_attempts enable row level security;
alter table public.mock_exams enable row level security;
alter table public.mock_exam_attempts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='certification_tracks' and policyname='Anyone can read certification tracks') then
    create policy "Anyone can read certification tracks" on public.certification_tracks for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='hands_on_labs' and policyname='Anyone can read labs') then
    create policy "Anyone can read labs" on public.hands_on_labs for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='mock_exams' and policyname='Anyone can read mock exams') then
    create policy "Anyone can read mock exams" on public.mock_exams for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_lab_attempts' and policyname='Users manage own lab attempts') then
    create policy "Users manage own lab attempts" on public.user_lab_attempts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='mock_exam_attempts' and policyname='Users view own mock attempts') then
    create policy "Users view own mock attempts" on public.mock_exam_attempts for select to authenticated using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='mock_exam_attempts' and policyname='Users insert own mock attempts') then
    create policy "Users insert own mock attempts" on public.mock_exam_attempts for insert to authenticated with check (auth.uid() = user_id);
  end if;
end $$;

grant select on public.certification_tracks, public.hands_on_labs, public.mock_exams to anon, authenticated;
grant select, insert, update, delete on public.user_lab_attempts to authenticated;
grant select, insert on public.mock_exam_attempts to authenticated;
grant usage, select on all sequences in schema public to authenticated;

insert into public.certification_tracks
(slug, name, provider, description, mastery_target, mock_pass_score, required_mock_passes, required_labs, sort_order)
values
('foundation-gate', 'Foundation Gate', 'Engineer OS', 'Linux・Network・Cloudへ進む前に、コンピュータ基礎を実務で再現できるか判定するゲート。', 80, 85, 3, 3, 10),
('aws-saa', 'AWS Certified Solutions Architect - Associate', 'AWS', 'AWS設計力の資格Readiness。AWS教材・Labs・模試パック追加後に本判定を開始します。', 85, 85, 3, 8, 20)
on conflict (slug) do update set
  name = excluded.name,
  provider = excluded.provider,
  description = excluded.description,
  mastery_target = excluded.mastery_target,
  mock_pass_score = excluded.mock_pass_score,
  required_mock_passes = excluded.required_mock_passes,
  required_labs = excluded.required_labs,
  sort_order = excluded.sort_order;

insert into public.hands_on_labs
(track_id, slug, title, description, instructions, success_criteria, estimated_minutes, sort_order)
select id, 'foundation-resource-monitor', 'Lab 1: CPU・メモリ・ディスクを観察する',
'Windowsのタスクマネージャーを使い、CPU・RAM・ストレージが実際にどう変化するか観察します。',
'["タスクマネージャーを開く","パフォーマンスタブでCPU・メモリ・ディスクの現在値を確認する","ブラウザで複数タブを開き、メモリ使用量の変化を観察する","大きめのアプリを起動し、CPU使用率の変化を観察する","観察結果をEngineer OSのメモ欄に3行以上記録する"]'::jsonb,
'["CPU・メモリ・ディスクの役割を実測値と結び付けて説明できる","アプリ起動前後の変化を説明できる"]'::jsonb,
20, 10 from public.certification_tracks where slug='foundation-gate'
on conflict (slug) do nothing;

insert into public.hands_on_labs
(track_id, slug, title, description, instructions, success_criteria, estimated_minutes, sort_order)
select id, 'foundation-file-process', 'Lab 2: ファイルとプロセスを追跡する',
'ファイル保存と実行中プロセスの違いを、自分のPC上で確認します。',
'["任意の作業フォルダを1つ作る","メモ帳でテキストファイルを作成して保存する","タスクマネージャーでメモ帳のプロセスを探す","メモ帳を終了して、プロセスは消えるがファイルは残ることを確認する","永続データと実行中プロセスの違いをメモ欄に説明する"]'::jsonb,
'["ファイルとプロセスを区別して説明できる","RAM上の実行状態とストレージ上の保存状態を説明できる"]'::jsonb,
20, 20 from public.certification_tracks where slug='foundation-gate'
on conflict (slug) do nothing;

insert into public.hands_on_labs
(track_id, slug, title, description, instructions, success_criteria, estimated_minutes, sort_order)
select id, 'foundation-http-client-server', 'Lab 3: HTTPリクエストを観察する',
'ブラウザの開発者ツールで、クライアントとサーバの通信を実際に確認します。',
'["EdgeまたはChromeで任意のWebページを開く","F12で開発者ツールを開く","Networkタブを開いてページを再読み込みする","1つのリクエストを選び、Request MethodとStatus Codeを確認する","クライアント→リクエスト→サーバ→レスポンスの流れをメモ欄に説明する"]'::jsonb,
'["HTTPのリクエストとレスポンスを実画面で確認できる","Status CodeとRequest Methodを1つ以上説明できる"]'::jsonb,
25, 30 from public.certification_tracks where slug='foundation-gate'
on conflict (slug) do nothing;

insert into public.mock_exams
(track_id, slug, name, question_count, time_limit_minutes, pass_score)
select id, 'foundation-mock', 'Foundation Gate 模擬試験', 20, 30, 85
from public.certification_tracks where slug='foundation-gate'
on conflict (slug) do update set
  name=excluded.name,
  question_count=excluded.question_count,
  time_limit_minutes=excluded.time_limit_minutes,
  pass_score=excluded.pass_score;

create index if not exists idx_user_lab_attempts_user on public.user_lab_attempts(user_id, status);
create index if not exists idx_mock_attempts_user_exam on public.mock_exam_attempts(user_id, mock_exam_id, completed_at desc);
