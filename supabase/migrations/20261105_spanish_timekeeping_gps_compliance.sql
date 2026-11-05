-- PINASTER · Registro de jornada + GPS puntual
-- Aplicado al proyecto Supabase de producción el 2026-11-05.
-- Objetivo: soporte de jornada laboral, pausas, geolocalización puntual,
-- correcciones trazables y conservación del evento original.

alter table public.employees
  add column if not exists contract_type text,
  add column if not exists weekly_hours numeric(5,2),
  add column if not exists collective_agreement text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'employees_contract_type_check') then
    alter table public.employees
      add constraint employees_contract_type_check
      check (contract_type is null or contract_type in ('full_time','part_time','temporary','other'));
  end if;
end $$;

alter table public.centers
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6),
  add column if not exists geofence_radius_m integer not null default 150,
  add column if not exists require_location boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'centers_geofence_radius_check') then
    alter table public.centers
      add constraint centers_geofence_radius_check
      check (geofence_radius_m between 25 and 5000);
  end if;
end $$;

create table if not exists public.time_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  center_id uuid references public.centers(id) on delete set null,
  event_type text not null check (event_type in ('clock_in','break_start','break_end','clock_out')),
  occurred_at timestamptz not null default now(),
  latitude numeric(9,6),
  longitude numeric(9,6),
  accuracy_m numeric(8,2),
  location_captured_at timestamptz,
  location_status text not null default 'unavailable'
    check (location_status in ('verified','outside_geofence','low_accuracy','unavailable','not_required')),
  location_distance_m integer,
  sequence_status text not null default 'valid'
    check (sequence_status in ('valid','needs_review')),
  sequence_note text,
  source text not null default 'web'
    check (source in ('web','mobile','manual','admin_correction')),
  device_info jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude is not null and longitude is not null))
);

create table if not exists public.time_corrections (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.time_events(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  reason text not null check (length(trim(reason)) >= 3),
  proposed_occurred_at timestamptz,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by uuid references auth.users(id) on delete set null default auth.uid(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.labor_compliance_settings (
  id smallint primary key default 1 check (id = 1),
  jurisdiction text not null default 'ES' check (jurisdiction = 'ES'),
  timezone text not null default 'Europe/Madrid',
  work_record_retention_years integer not null default 4 check (work_record_retention_years >= 4),
  location_mode text not null default 'event_only' check (location_mode = 'event_only'),
  continuous_tracking_enabled boolean not null default false check (continuous_tracking_enabled = false),
  location_retention_days integer check (location_retention_days is null or location_retention_days > 0),
  legal_notice_version text not null default 'ES-2026-11',
  updated_at timestamptz not null default now()
);

insert into public.labor_compliance_settings (id) values (1)
on conflict (id) do nothing;

create or replace function private.time_event_location_guard()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  c_lat numeric;
  c_lon numeric;
  c_radius integer;
  c_require boolean;
  earth_radius_m constant double precision := 6371000;
  phi1 double precision;
  phi2 double precision;
  dphi double precision;
  dlambda double precision;
  a double precision;
  distance_m double precision;
begin
  if new.center_id is null then
    new.location_status := case
      when new.latitude is null then 'unavailable'
      when coalesce(new.accuracy_m,9999) > 150 then 'low_accuracy'
      else 'verified'
    end;
    return new;
  end if;

  select latitude, longitude, geofence_radius_m, require_location
    into c_lat, c_lon, c_radius, c_require
  from public.centers where id = new.center_id;

  if coalesce(c_require,true)=false then
    new.location_status := 'not_required';
    return new;
  end if;

  if new.latitude is null or new.longitude is null then
    new.location_status := 'unavailable';
    return new;
  end if;

  if c_lat is null or c_lon is null then
    new.location_status := case when coalesce(new.accuracy_m,9999) > 150 then 'low_accuracy' else 'verified' end;
    return new;
  end if;

  phi1 := radians(c_lat::double precision);
  phi2 := radians(new.latitude::double precision);
  dphi := radians((new.latitude-c_lat)::double precision);
  dlambda := radians((new.longitude-c_lon)::double precision);
  a := sin(dphi/2)^2 + cos(phi1)*cos(phi2)*sin(dlambda/2)^2;
  distance_m := earth_radius_m*2*atan2(sqrt(a),sqrt(1-a));

  new.location_distance_m := round(distance_m)::integer;
  new.location_status := case
    when coalesce(new.accuracy_m,9999) > 150 then 'low_accuracy'
    when distance_m <= (c_radius+coalesce(new.accuracy_m,0)) then 'verified'
    else 'outside_geofence'
  end;
  return new;
end;
$$;

create or replace function private.time_event_sequence_guard()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  prev_type text;
  prev_at timestamptz;
  local_day date;
  prev_local_day date;
begin
  select event_type, occurred_at into prev_type, prev_at
  from public.time_events
  where employee_id=new.employee_id and occurred_at<=new.occurred_at
  order by occurred_at desc, created_at desc limit 1;

  local_day := (new.occurred_at at time zone 'Europe/Madrid')::date;
  prev_local_day := case when prev_at is null then null else (prev_at at time zone 'Europe/Madrid')::date end;
  new.sequence_status := 'valid';
  new.sequence_note := null;

  if new.event_type='clock_in' and prev_at is not null and prev_local_day=local_day and prev_type<>'clock_out' then
    new.sequence_status := 'needs_review';
    new.sequence_note := 'Nueva entrada con una jornada previa del mismo dia sin cerrar.';
  elsif new.event_type='break_start' and (prev_type not in ('clock_in','break_end') or prev_local_day is distinct from local_day) then
    new.sequence_status := 'needs_review';
    new.sequence_note := 'Inicio de descanso sin un tramo de trabajo abierto.';
  elsif new.event_type='break_end' and (prev_type<>'break_start' or prev_local_day is distinct from local_day) then
    new.sequence_status := 'needs_review';
    new.sequence_note := 'Fin de descanso sin un descanso abierto.';
  elsif new.event_type='clock_out' and (prev_type not in ('clock_in','break_end') or prev_local_day is distinct from local_day) then
    new.sequence_status := 'needs_review';
    new.sequence_note := 'Salida sin un tramo de trabajo abierto.';
  end if;
  return new;
end;
$$;

create or replace function private.audit_timekeeping_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.audit_log(table_name,record_id,action,actor_user_id,old_data,new_data)
  values (
    tg_table_name,
    case when tg_op='DELETE' then old.id else new.id end,
    tg_op,
    auth.uid(),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return case when tg_op='DELETE' then old else new end;
end;
$$;

revoke all on function private.audit_timekeeping_change() from public, anon, authenticated;

drop trigger if exists trg_time_events_location_guard on public.time_events;
create trigger trg_time_events_location_guard before insert on public.time_events
for each row execute function private.time_event_location_guard();

drop trigger if exists trg_time_events_sequence_guard on public.time_events;
create trigger trg_time_events_sequence_guard before insert on public.time_events
for each row execute function private.time_event_sequence_guard();

drop trigger if exists trg_time_events_audit on public.time_events;
create trigger trg_time_events_audit after insert on public.time_events
for each row execute function private.audit_timekeeping_change();

drop trigger if exists trg_time_corrections_audit on public.time_corrections;
create trigger trg_time_corrections_audit after insert or update on public.time_corrections
for each row execute function private.audit_timekeeping_change();

alter table public.time_events enable row level security;
alter table public.time_corrections enable row level security;
alter table public.labor_compliance_settings enable row level security;

drop policy if exists "time_events_select_own_or_admin" on public.time_events;
create policy "time_events_select_own_or_admin" on public.time_events
for select to authenticated
using (employee_id=private.current_employee_id() or private.is_admin());

drop policy if exists "time_events_insert_own_or_admin" on public.time_events;
create policy "time_events_insert_own_or_admin" on public.time_events
for insert to authenticated
with check ((employee_id=private.current_employee_id() and created_by=(select auth.uid())) or private.is_admin());

drop policy if exists "time_corrections_select_own_or_admin" on public.time_corrections;
create policy "time_corrections_select_own_or_admin" on public.time_corrections
for select to authenticated
using (employee_id=private.current_employee_id() or private.is_admin());

drop policy if exists "time_corrections_insert_own_or_admin" on public.time_corrections;
create policy "time_corrections_insert_own_or_admin" on public.time_corrections
for insert to authenticated
with check ((employee_id=private.current_employee_id() and requested_by=(select auth.uid())) or private.is_admin());

drop policy if exists "time_corrections_admin_update" on public.time_corrections;
create policy "time_corrections_admin_update" on public.time_corrections
for update to authenticated
using (private.is_admin()) with check (private.is_admin());

drop policy if exists "labor_compliance_read_authenticated" on public.labor_compliance_settings;
create policy "labor_compliance_read_authenticated" on public.labor_compliance_settings
for select to authenticated using (true);

drop policy if exists "labor_compliance_admin_write" on public.labor_compliance_settings;
create policy "labor_compliance_admin_write" on public.labor_compliance_settings
for all to authenticated
using (private.is_admin()) with check (private.is_admin());

revoke update, delete on public.time_events from anon, authenticated;
revoke delete on public.time_corrections from anon, authenticated;

grant usage on schema public to authenticated;
grant select, insert on public.time_events to authenticated;
grant select, insert, update on public.time_corrections to authenticated;
grant select, update on public.labor_compliance_settings to authenticated;
grant select on public.centers to authenticated;

create index if not exists idx_time_events_employee_occurred on public.time_events(employee_id,occurred_at desc);
create index if not exists idx_time_events_center_occurred on public.time_events(center_id,occurred_at desc);
create index if not exists idx_time_events_sequence_review on public.time_events(sequence_status,occurred_at desc)
where sequence_status='needs_review';
create index if not exists idx_time_corrections_employee_created on public.time_corrections(employee_id,created_at desc);
