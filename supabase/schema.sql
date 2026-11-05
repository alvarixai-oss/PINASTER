-- PINASTER - esquema inicial para Supabase/PostgreSQL
-- Ejecutar en Supabase SQL Editor una vez creado el proyecto.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_code text not null unique,
  full_name text not null,
  category text,
  role text not null default 'worker' check (role in ('worker','admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  manager_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.overtime_records (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id) on delete restrict,
  work_date date not null,
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  site_id uuid references public.work_sites(id) on delete set null,
  reason text not null,
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  source text not null default 'timer' check (source in ('timer','manual')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.overtime_sessions (
  worker_id uuid primary key references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  site_id uuid references public.work_sites(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.overtime_history (
  id bigint generated always as identity primary key,
  record_id uuid not null references public.overtime_records(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_sites_updated_at on public.work_sites;
create trigger trg_sites_updated_at
before update on public.work_sites
for each row execute function public.set_updated_at();

drop trigger if exists trg_records_updated_at on public.overtime_records;
create trigger trg_records_updated_at
before update on public.overtime_records
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and active = true
  );
$$;

alter table public.profiles enable row level security;
alter table public.work_sites enable row level security;
alter table public.overtime_records enable row level security;
alter table public.overtime_sessions enable row level security;
alter table public.overtime_history enable row level security;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_admin_write" on public.profiles;
create policy "profiles_admin_write"
on public.profiles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "sites_authenticated_read" on public.work_sites;
create policy "sites_authenticated_read"
on public.work_sites for select
to authenticated
using (active = true or public.is_admin());

drop policy if exists "sites_admin_write" on public.work_sites;
create policy "sites_admin_write"
on public.work_sites for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "records_select_own_or_admin" on public.overtime_records;
create policy "records_select_own_or_admin"
on public.overtime_records for select
to authenticated
using (worker_id = auth.uid() or public.is_admin());

drop policy if exists "records_worker_insert_own" on public.overtime_records;
create policy "records_worker_insert_own"
on public.overtime_records for insert
to authenticated
with check (
  worker_id = auth.uid()
  and status = 'pending'
  and approved_by is null
  and approved_at is null
);

drop policy if exists "records_worker_update_pending_own" on public.overtime_records;
create policy "records_worker_update_pending_own"
on public.overtime_records for update
to authenticated
using (worker_id = auth.uid() and status = 'pending')
with check (
  worker_id = auth.uid()
  and status = 'pending'
  and approved_by is null
  and approved_at is null
);

drop policy if exists "records_admin_all" on public.overtime_records;
create policy "records_admin_all"
on public.overtime_records for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "sessions_own_or_admin_select" on public.overtime_sessions;
create policy "sessions_own_or_admin_select"
on public.overtime_sessions for select
to authenticated
using (worker_id = auth.uid() or public.is_admin());

drop policy if exists "sessions_worker_manage_own" on public.overtime_sessions;
create policy "sessions_worker_manage_own"
on public.overtime_sessions for all
to authenticated
using (worker_id = auth.uid())
with check (worker_id = auth.uid());

drop policy if exists "sessions_admin_all" on public.overtime_sessions;
create policy "sessions_admin_all"
on public.overtime_sessions for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "history_select_related_or_admin" on public.overtime_history;
create policy "history_select_related_or_admin"
on public.overtime_history for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.overtime_records r
    where r.id = overtime_history.record_id
      and r.worker_id = auth.uid()
  )
);

drop policy if exists "history_insert_self_or_admin" on public.overtime_history;
create policy "history_insert_self_or_admin"
on public.overtime_history for insert
to authenticated
with check (actor_id = auth.uid() or public.is_admin());

create index if not exists idx_overtime_records_worker_date
  on public.overtime_records(worker_id, work_date desc);

create index if not exists idx_overtime_records_status_date
  on public.overtime_records(status, work_date desc);

create index if not exists idx_overtime_history_record
  on public.overtime_history(record_id, created_at desc);

insert into public.work_sites (name, manager_name)
select * from (values
  ('Mantenimiento de zonas verdes', 'Responsable PINASTER'),
  ('Obra de jardinería', 'Responsable PINASTER'),
  ('Instalación de riego', 'Responsable PINASTER'),
  ('Campos deportivos', 'Responsable PINASTER')
) as seed(name, manager_name)
where not exists (select 1 from public.work_sites);
