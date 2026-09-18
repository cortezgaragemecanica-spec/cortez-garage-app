create table if not exists public.app_user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  active_seconds integer not null default 0 check (active_seconds >= 0),
  created_at timestamptz not null default now()
);

create index if not exists app_user_sessions_email_started_idx
  on public.app_user_sessions (lower(user_email), started_at desc);

create index if not exists app_user_sessions_user_started_idx
  on public.app_user_sessions (user_id, started_at desc);

alter table public.app_user_sessions enable row level security;

drop policy if exists app_user_sessions_own_read on public.app_user_sessions;
create policy app_user_sessions_own_read on public.app_user_sessions
for select to authenticated
using (user_id = auth.uid());

drop policy if exists app_user_sessions_own_insert on public.app_user_sessions;
create policy app_user_sessions_own_insert on public.app_user_sessions
for insert to authenticated
with check (
  user_id = auth.uid()
  and lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists app_user_sessions_own_update on public.app_user_sessions;
create policy app_user_sessions_own_update on public.app_user_sessions
for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists app_user_sessions_owner_read on public.app_user_sessions;
create policy app_user_sessions_owner_read on public.app_user_sessions
for select to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'cortezgaragemecanica@gmail.com');

revoke all on table public.app_user_sessions from public, anon;
grant select, insert, update on table public.app_user_sessions to authenticated;
