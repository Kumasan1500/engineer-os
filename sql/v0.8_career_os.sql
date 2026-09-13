-- Engineer OS v0.8
-- Career OS: role readiness, portfolio projects, evidence-based career roadmap.
-- Run once in Supabase SQL Editor after v0.7.

create table if not exists public.role_tracks (
  id bigint generated always as identity primary key,
  slug text unique not null,
  name text not null,
  description text,
  target_level text not null default 'mid',
  skill_weight integer not null default 55 check (skill_weight between 0 and 100),
  project_weight integer not null default 30 check (project_weight between 0 and 100),
  lab_weight integer not null default 15 check (lab_weight between 0 and 100),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.role_skill_requirements (
  role_track_id bigint not null references public.role_tracks(id) on delete cascade,
  skill_slug text not null,
  weight integer not null default 1 check (weight > 0),
  target_mastery integer not null default 80 check (target_mastery between 0 and 100),
  primary key (role_track_id, skill_slug)
);

create table if not exists public.practical_projects (
  id bigint generated always as identity primary key,
  slug text unique not null,
  title text not null,
  description text,
  role_slugs jsonb not null default '[]'::jsonb,
  required_skill_slugs jsonb not null default '[]'::jsonb,
  tasks jsonb not null default '[]'::jsonb,
  success_criteria jsonb not null default '[]'::jsonb,
  evidence_requirements jsonb not null default '[]'::jsonb,
  estimated_hours integer not null default 4 check (estimated_hours > 0),
  difficulty integer not null default 1 check (difficulty between 1 and 5),
  portfolio_worthy boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.user_projects (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id bigint not null references public.practical_projects(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed')),
  repo_url text,
  demo_url text,
  evidence_notes text,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

create table if not exists public.career_milestones (
  id bigint generated always as identity primary key,
  phase integer not null,
  title text not null,
  horizon text not null,
  objective text not null,
  exit_criteria jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  unique (phase, title)
);

alter table public.role_tracks enable row level security;
alter table public.role_skill_requirements enable row level security;
alter table public.practical_projects enable row level security;
alter table public.user_projects enable row level security;
alter table public.career_milestones enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='role_tracks' and policyname='Anyone can read role tracks') then
    create policy "Anyone can read role tracks" on public.role_tracks for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='role_skill_requirements' and policyname='Anyone can read role skill requirements') then
    create policy "Anyone can read role skill requirements" on public.role_skill_requirements for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='practical_projects' and policyname='Anyone can read practical projects') then
    create policy "Anyone can read practical projects" on public.practical_projects for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='career_milestones' and policyname='Anyone can read career milestones') then
    create policy "Anyone can read career milestones" on public.career_milestones for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_projects' and policyname='Users manage own projects') then
    create policy "Users manage own projects" on public.user_projects for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

grant select on public.role_tracks, public.role_skill_requirements, public.practical_projects, public.career_milestones to anon, authenticated;
grant select, insert, update, delete on public.user_projects to authenticated;
grant usage, select on all sequences in schema public to authenticated;

insert into public.role_tracks (slug,name,description,target_level,skill_weight,project_weight,lab_weight,sort_order)
values
('cloud-engineer','Cloud Engineer','Linux・Network・AWS・IaCを軸に、設計・構築・運用を自走できるクラウドエンジニア。','mid',55,30,15,10),
('sre','SRE / Platform Engineer','信頼性・自動化・可観測性・コンテナ基盤を扱い、サービスを止めずに改善できるエンジニア。','mid',55,30,15,20),
('security-engineer','Cloud Security Engineer','IAM・ネットワーク・ログ・脅威対応をクラウド環境で実装できるセキュリティエンジニア。','mid',55,30,15,30)
on conflict (slug) do update set
  name=excluded.name,
  description=excluded.description,
  target_level=excluded.target_level,
  skill_weight=excluded.skill_weight,
  project_weight=excluded.project_weight,
  lab_weight=excluded.lab_weight,
  sort_order=excluded.sort_order;

-- Skill weights are intentionally forward-looking. Missing curriculum domains count as 0 until those packs are added.
insert into public.role_skill_requirements (role_track_id, skill_slug, weight, target_mastery)
select id,'computer-fundamentals',1,85 from public.role_tracks where slug='cloud-engineer'
on conflict do nothing;
insert into public.role_skill_requirements select id,'linux',3,85 from public.role_tracks where slug='cloud-engineer' on conflict do nothing;
insert into public.role_skill_requirements select id,'network',3,85 from public.role_tracks where slug='cloud-engineer' on conflict do nothing;
insert into public.role_skill_requirements select id,'aws',4,85 from public.role_tracks where slug='cloud-engineer' on conflict do nothing;
insert into public.role_skill_requirements select id,'terraform',3,80 from public.role_tracks where slug='cloud-engineer' on conflict do nothing;
insert into public.role_skill_requirements select id,'docker',2,80 from public.role_tracks where slug='cloud-engineer' on conflict do nothing;
insert into public.role_skill_requirements select id,'git-github',2,80 from public.role_tracks where slug='cloud-engineer' on conflict do nothing;

insert into public.role_skill_requirements select id,'linux',3,85 from public.role_tracks where slug='sre' on conflict do nothing;
insert into public.role_skill_requirements select id,'network',2,80 from public.role_tracks where slug='sre' on conflict do nothing;
insert into public.role_skill_requirements select id,'docker',3,85 from public.role_tracks where slug='sre' on conflict do nothing;
insert into public.role_skill_requirements select id,'kubernetes',4,85 from public.role_tracks where slug='sre' on conflict do nothing;
insert into public.role_skill_requirements select id,'ci-cd',3,80 from public.role_tracks where slug='sre' on conflict do nothing;
insert into public.role_skill_requirements select id,'sre',4,85 from public.role_tracks where slug='sre' on conflict do nothing;
insert into public.role_skill_requirements select id,'python',2,75 from public.role_tracks where slug='sre' on conflict do nothing;

insert into public.role_skill_requirements select id,'linux',2,80 from public.role_tracks where slug='security-engineer' on conflict do nothing;
insert into public.role_skill_requirements select id,'network',3,85 from public.role_tracks where slug='security-engineer' on conflict do nothing;
insert into public.role_skill_requirements select id,'aws',3,85 from public.role_tracks where slug='security-engineer' on conflict do nothing;
insert into public.role_skill_requirements select id,'cloud-security',4,85 from public.role_tracks where slug='security-engineer' on conflict do nothing;
insert into public.role_skill_requirements select id,'python',2,75 from public.role_tracks where slug='security-engineer' on conflict do nothing;
insert into public.role_skill_requirements select id,'git-github',1,75 from public.role_tracks where slug='security-engineer' on conflict do nothing;

insert into public.practical_projects
(slug,title,description,role_slugs,required_skill_slugs,tasks,success_criteria,evidence_requirements,estimated_hours,difficulty,portfolio_worthy,sort_order)
values
('ops-observability-baseline','Project 1: PC / Linux Observability Baseline','CPU・メモリ・ディスク・プロセスを観測し、症状からボトルネック仮説を立てる最初の運用成果物。',
 '["cloud-engineer","sre","security-engineer"]'::jsonb,
 '["computer-fundamentals","linux"]'::jsonb,
 '["観測対象と計測項目をREADMEに定義する","CPU・メモリ・ディスク・プロセスの観測結果を記録する","高負荷時の仮説と切り分け手順を書く","再現手順と学びをREADMEに残す"]'::jsonb,
 '["他人がREADMEだけで観測を再現できる","数値と症状を結び付けて説明している","少なくとも1つの誤った仮説を検証して棄却している"]'::jsonb,
 '["GitHub repository URL","README","観測結果またはスクリーンショット","振り返りメモ"]'::jsonb,
 4,1,true,10),
('http-troubleshooting-lab','Project 2: HTTP Troubleshooting Lab','クライアント・DNS・TCP・HTTPのどこで障害が起きているかを段階的に切り分ける実務型ラボ。',
 '["cloud-engineer","sre","security-engineer"]'::jsonb,
 '["network","linux","computer-fundamentals"]'::jsonb,
 '["正常なHTTP通信を観測する","意図的に1つの失敗条件を作る","症状からOSI/TCP-IPのどの層か仮説を立てる","curlやブラウザ開発者ツール等で原因を切り分ける","Runbookとして復旧手順を文書化する"]'::jsonb,
 '["障害点を根拠付きで説明できる","確認コマンドと期待結果が書かれている","復旧後の確認手順がある"]'::jsonb,
 '["GitHub repository URL","Troubleshooting Runbook","検証ログ","事後レビュー"]'::jsonb,
 6,2,true,20),
('aws-three-tier-iac','Project 3: AWS Three-Tier IaC','Terraformでネットワーク・アプリ・データ層をコード化し、設計判断と運用観点まで説明するクラウド成果物。',
 '["cloud-engineer","sre"]'::jsonb,
 '["aws","terraform","network","git-github"]'::jsonb,
 '["構成図を作成する","TerraformでVPC/Subnet/Security Group等をコード化する","変数と出力を整理する","READMEに可用性・セキュリティ・コストの設計判断を書く","破棄手順まで検証する"]'::jsonb,
 '["terraform planの差分を説明できる","秘密情報をGitに含めない","再構築手順がREADMEで再現可能","設計トレードオフを説明している"]'::jsonb,
 '["GitHub repository URL","Architecture diagram","README","terraform planの証跡"]'::jsonb,
 14,3,true,30),
('k8s-reliability-service','Project 4: Kubernetes Reliability Service','コンテナ化したサービスをKubernetesへ配置し、Probe・Resource・障害復旧・可観測性まで実装する。',
 '["sre"]'::jsonb,
 '["docker","kubernetes","sre","ci-cd"]'::jsonb,
 '["アプリをコンテナ化する","Deployment/Serviceを定義する","readiness/liveness probeを入れる","requests/limitsを設定する","障害を起こして復旧挙動を記録する","CIでmanifest検証を自動化する"]'::jsonb,
 '["障害時の期待挙動を説明できる","Resource設定の根拠がある","再現可能な障害試験がある","Runbookがある"]'::jsonb,
 '["GitHub repository URL","Kubernetes manifests","Incident test record","Runbook"]'::jsonb,
 18,4,true,40),
('cloud-security-incident','Project 5: Cloud Security Incident Drill','IAM・ログ・ネットワークの証跡から不審な操作を調査し、封じ込め・恒久対策までまとめるインシデント演習。',
 '["security-engineer"]'::jsonb,
 '["cloud-security","aws","network","python"]'::jsonb,
 '["想定インシデントを定義する","ログからタイムラインを作る","影響範囲を整理する","封じ込め手順を作る","恒久対策と検知改善を提案する","簡単なログ集計を自動化する"]'::jsonb,
 '["時系列と根拠が明確","封じ込めと復旧を区別している","最小権限または検知改善へ落とし込んでいる"]'::jsonb,
 '["GitHub repository URL","Incident report","Timeline","Detection/automation script"]'::jsonb,
 16,4,true,50)
on conflict (slug) do update set
  title=excluded.title,
  description=excluded.description,
  role_slugs=excluded.role_slugs,
  required_skill_slugs=excluded.required_skill_slugs,
  tasks=excluded.tasks,
  success_criteria=excluded.success_criteria,
  evidence_requirements=excluded.evidence_requirements,
  estimated_hours=excluded.estimated_hours,
  difficulty=excluded.difficulty,
  portfolio_worthy=excluded.portfolio_worthy,
  sort_order=excluded.sort_order;

insert into public.career_milestones (phase,title,horizon,objective,exit_criteria,sort_order)
values
(0,'Foundation','Now → 入社前','学習習慣・コンピュータ基礎・Linux/Networkの土台を作る。','["Foundation Gate READY","Git/GitHub基礎","最初の実務型成果物を1件公開"]'::jsonb,10),
(1,'Production Basics','1年目','運用保守を通じて本番環境・障害対応・変更管理の基礎を身につける。','["Linux/Network/AWSの基礎を実務で説明できる","障害切り分けRunbookを作れる","AWS Associate級の知識を安定再現"]'::jsonb,20),
(2,'Automation & Cloud Design','2年目','IaC・自動化・クラウド設計へ責任範囲を広げる。','["Terraformで再現可能な環境を構築","設計レビューでトレードオフを説明","GitHubに複数の実務型成果物"]'::jsonb,30),
(3,'High-Impact Engineer','3年目','複数領域を跨いで改善を主導し、市場で評価される専門性と成果を作る。','["Cloud/SRE/SecurityのいずれかでRole Readiness 80%+","障害・コスト・セキュリティ改善を定量化","設計から運用まで一気通貫の成果物"]'::jsonb,40),
(4,'1000万円レンジへの挑戦','3〜4年目','高単価企業・外資・成長企業・専門職などを含め、役割と成果で市場評価を取りにいく。','["Role Readiness 90%+","面接で深掘りに耐える成果物3件以上","システム設計・障害対応・自動化を具体例で説明","応募先の報酬レンジと期待役割を満たす"]'::jsonb,50)
on conflict (phase,title) do update set
  horizon=excluded.horizon,
  objective=excluded.objective,
  exit_criteria=excluded.exit_criteria,
  sort_order=excluded.sort_order;

create index if not exists idx_user_projects_user_status on public.user_projects(user_id,status);
create index if not exists idx_practical_projects_sort on public.practical_projects(sort_order);
