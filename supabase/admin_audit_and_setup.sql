-- Run this in Supabase SQL Editor.
-- It audits required objects for this app and applies safe setup/fixes for Admin/HR flows.

-- 1) Quick audit: tables and columns used by the app
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('profiles', 'user_roles', 'questions', 'candidates', 'ai_jobs')
order by table_name;

select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'user_roles', 'questions', 'candidates', 'ai_jobs')
order by table_name, ordinal_position;

-- 2) Ensure core tables exist
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  avatar_url text,
  role text default 'candidate',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.user_roles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'candidate',
  updated_at timestamptz default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  cv_text text,
  answers jsonb,
  ai_result jsonb,
  final_score numeric,
  skills_score numeric,
  experience_score numeric,
  assessment_score numeric,
  status text default 'Processing',
  internal_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidates(id) on delete cascade,
  status text not null default 'pending',
  attempts int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

-- 3) Ensure columns expected by code exist (idempotent)
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists role text default 'candidate';
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

alter table public.user_roles add column if not exists role text default 'candidate';
alter table public.user_roles add column if not exists updated_at timestamptz default now();

-- 4) Indexes
create index if not exists idx_user_roles_role on public.user_roles(role);
create index if not exists idx_questions_is_active on public.questions(is_active);
create index if not exists idx_candidates_created_at on public.candidates(created_at desc);
create index if not exists idx_ai_jobs_status_created_at on public.ai_jobs(status, created_at);

-- 5) Sync role source: middleware reads user_roles, invite route currently writes profiles.role
-- Ensure auth.users creates baseline rows with candidate defaults
create or replace function public.handle_new_auth_user_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, created_at, updated_at)
  values (new.id, 'candidate', now(), now())
  on conflict (id) do nothing;

  insert into public.user_roles (id, role, updated_at)
  values (new.id, 'candidate', now())
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_handle_new_auth_user_defaults on auth.users;
create trigger trg_handle_new_auth_user_defaults
after insert on auth.users
for each row
execute function public.handle_new_auth_user_defaults();

-- 5b) Sync role source: middleware reads user_roles, invite route writes profiles.role
-- Backfill missing user_roles from existing profiles
insert into public.user_roles (id, role, updated_at)
select p.id, coalesce(p.role, 'candidate'), now()
from public.profiles p
left join public.user_roles ur on ur.id = p.id
where ur.id is null;

-- Keep user_roles.role in sync when profiles.role changes
create or replace function public.sync_user_roles_from_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (id, role, updated_at)
  values (new.id, coalesce(new.role, 'candidate'), now())
  on conflict (id)
  do update set role = excluded.role, updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_user_roles_from_profiles on public.profiles;
create trigger trg_sync_user_roles_from_profiles
after insert or update of role on public.profiles
for each row
execute function public.sync_user_roles_from_profiles();

-- 6) RLS baseline
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.questions enable row level security;
alter table public.candidates enable row level security;
alter table public.ai_jobs enable row level security;

-- Remove old conflicting policies if present
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "user_roles_select_own" on public.user_roles;
drop policy if exists "questions_select_active_public" on public.questions;
drop policy if exists "questions_manage_admin_hr" on public.questions;
drop policy if exists "candidates_read_admin_hr" on public.candidates;
drop policy if exists "candidates_update_admin_hr" on public.candidates;
drop policy if exists "ai_jobs_read_admin_hr" on public.ai_jobs;

-- Profiles: user can read/insert/update own row
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- user_roles: user can read own role
create policy "user_roles_select_own"
on public.user_roles
for select
to authenticated
using (auth.uid() = id);

-- Questions:
-- - Public can read active questions on application page
create policy "questions_select_active_public"
on public.questions
for select
to anon, authenticated
using (is_active = true);

-- - Admin/HR can fully manage questions
create policy "questions_manage_admin_hr"
on public.questions
for all
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.id = auth.uid()
      and ur.role in ('admin', 'hr')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.id = auth.uid()
      and ur.role in ('admin', 'hr')
  )
);

-- Candidates: Admin/HR read + update
create policy "candidates_read_admin_hr"
on public.candidates
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.id = auth.uid()
      and ur.role in ('admin', 'hr')
  )
);

create policy "candidates_update_admin_hr"
on public.candidates
for update
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.id = auth.uid()
      and ur.role in ('admin', 'hr')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.id = auth.uid()
      and ur.role in ('admin', 'hr')
  )
);

-- ai_jobs is handled by service role in server code; allow read for admin/hr dashboard tooling if needed
create policy "ai_jobs_read_admin_hr"
on public.ai_jobs
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.id = auth.uid()
      and ur.role in ('admin', 'hr')
  )
);

-- 7) Optional: make first user admin manually
-- Replace with real user UUID from Authentication > Users
-- insert into public.user_roles (id, role, updated_at)
-- values ('00000000-0000-0000-0000-000000000000', 'admin', now())
-- on conflict (id) do update set role = excluded.role, updated_at = now();
