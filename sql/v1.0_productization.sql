-- Engineer OS v1.0 productization settings
create table if not exists public.user_app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_goal_minutes integer not null default 45 check (daily_goal_minutes between 10 and 360),
  reminder_time text not null default '20:00',
  notifications_enabled boolean not null default false,
  reduce_motion boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_app_settings enable row level security;

drop policy if exists "Users can read own app settings" on public.user_app_settings;
create policy "Users can read own app settings"
on public.user_app_settings for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own app settings" on public.user_app_settings;
create policy "Users can insert own app settings"
on public.user_app_settings for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own app settings" on public.user_app_settings;
create policy "Users can update own app settings"
on public.user_app_settings for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update on public.user_app_settings to authenticated;
