-- Nuvex Attendance: database setup.
-- Paste all of this into Supabase → SQL Editor → New query → Run.
-- Tables are locked; the app can only use the functions at the bottom, which check passcodes on the server.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.school (
  id int primary key default 1 check (id = 1),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.registers (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('staff','class')),
  name text not null,
  keeper text not null,
  pin_hash text not null,
  failed int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);
create unique index one_staff_register on public.registers ((kind)) where kind = 'staff';

create table public.people (
  id uuid primary key default gen_random_uuid(),
  register_id uuid not null references public.registers(id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index people_register on public.people(register_id);

create table public.marks (
  person_id uuid not null references public.people(id) on delete cascade,
  register_id uuid not null references public.registers(id) on delete cascade,
  day date not null,
  status text not null check (status in ('p','l','a','e')),
  reason text,
  updated_at timestamptz not null default now(),
  primary key (person_id, day)
);
create index marks_register on public.marks(register_id);

create table public.sessions (
  token uuid primary key default gen_random_uuid(),
  register_id uuid not null references public.registers(id) on delete cascade,
  expires_at timestamptz not null
);
create index sessions_register on public.sessions(register_id);

alter table public.school enable row level security;
alter table public.registers enable row level security;
alter table public.people enable row level security;
alter table public.marks enable row level security;
alter table public.sessions enable row level security;
revoke all on public.school, public.registers, public.people, public.marks, public.sessions from anon, authenticated;

-- ---------- private helpers ----------

create function private.reg_for(p_token uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r uuid;
begin
  select register_id into r from public.sessions where token = p_token and expires_at > now();
  if r is null then raise exception 'signed_out'; end if;
  return r;
end $$;

create function private.clean(p text, maxlen int) returns text
language sql immutable set search_path = '' as $$
  select nullif(left(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')), maxlen), '')
$$;

create function private.check_pin(p text) returns void
language plpgsql set search_path = '' as $$
begin
  if p is null or p !~ '^[0-9]{4}$' then raise exception 'pin_must_be_4_digits'; end if;
end $$;

create function private.new_session(p_reg uuid) returns uuid
language sql security definer set search_path = '' as $$
  delete from public.sessions where expires_at < now();
  insert into public.sessions (register_id, expires_at) values (p_reg, now() + interval '30 days') returning token;
$$;

create function private.register_json(p_reg uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'kind', r.kind, 'name', r.name, 'keeper', r.keeper,
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) order by p.position, p.created_at)
                        from public.people p where p.register_id = r.id), '[]'::jsonb),
    'marks', coalesce((select jsonb_agg(jsonb_build_object('p', m.person_id, 'd', m.day, 's', m.status, 'r', m.reason))
                       from public.marks m where m.register_id = r.id), '[]'::jsonb),
    'classes', case when r.kind = 'staff' then coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'keeper', c.keeper) order by c.name)
                       from public.registers c where c.kind = 'class'), '[]'::jsonb) else null end
  ) from public.registers r where r.id = p_reg
$$;

revoke all on all functions in schema private from public, anon, authenticated;

-- ---------- what the app can call ----------

create function public.get_school() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'ready', exists (select 1 from public.school),
    'name', (select name from public.school),
    'staff', (select jsonb_build_object('id', id, 'keeper', keeper) from public.registers where kind = 'staff'),
    'classes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'keeper', keeper) order by name)
                         from public.registers where kind = 'class'), '[]'::jsonb)
  )
$$;

create function public.setup_school(p_school text, p_keeper text, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r uuid;
begin
  if exists (select 1 from public.school) then raise exception 'already_set_up'; end if;
  perform private.check_pin(p_pin);
  if private.clean(p_school, 120) is null or private.clean(p_keeper, 80) is null then raise exception 'name_required'; end if;
  insert into public.school (name) values (private.clean(p_school, 120));
  insert into public.registers (kind, name, keeper, pin_hash)
    values ('staff', 'Staff attendance', private.clean(p_keeper, 80), extensions.crypt(p_pin, extensions.gen_salt('bf')))
    returning id into r;
  return jsonb_build_object('id', r, 'token', private.new_session(r));
end $$;

create function public.create_class(p_name text, p_keeper text, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r uuid;
begin
  if not exists (select 1 from public.school) then raise exception 'school_not_set_up'; end if;
  perform private.check_pin(p_pin);
  if private.clean(p_name, 80) is null or private.clean(p_keeper, 80) is null then raise exception 'name_required'; end if;
  if (select count(*) from public.registers) >= 1000 then raise exception 'too_many_registers'; end if;
  insert into public.registers (kind, name, keeper, pin_hash)
    values ('class', private.clean(p_name, 80), private.clean(p_keeper, 80), extensions.crypt(p_pin, extensions.gen_salt('bf')))
    returning id into r;
  return jsonb_build_object('id', r, 'token', private.new_session(r));
end $$;

-- Returns an error object instead of raising, so the failed-attempt count is kept.
-- 5 wrong passcodes lock the register for 15 minutes.
create function public.unlock(p_register uuid, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare reg public.registers;
begin
  select * into reg from public.registers where id = p_register for update;
  if reg.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if reg.locked_until is not null and reg.locked_until > now() then
    return jsonb_build_object('error', 'locked', 'seconds', ceil(extract(epoch from reg.locked_until - now())));
  end if;
  if p_pin is not null and p_pin ~ '^[0-9]{4}$' and reg.pin_hash = extensions.crypt(p_pin, reg.pin_hash) then
    update public.registers set failed = 0, locked_until = null where id = reg.id;
    return jsonb_build_object('token', private.new_session(reg.id));
  end if;
  if reg.failed + 1 >= 5 then
    update public.registers set failed = 0, locked_until = now() + interval '15 minutes' where id = reg.id;
    return jsonb_build_object('error', 'locked', 'seconds', 900);
  end if;
  update public.registers set failed = reg.failed + 1 where id = reg.id;
  return jsonb_build_object('error', 'wrong_pin', 'left', 5 - (reg.failed + 1));
end $$;

create function public.get_register(p_token uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.register_json(private.reg_for(p_token))
$$;

create function public.add_people(p_token uuid, p_names text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r uuid := private.reg_for(p_token); start int;
begin
  if coalesce(array_length(p_names, 1), 0) > 200 then raise exception 'too_many_names'; end if;
  if (select count(*) from public.people where register_id = r) + coalesce(array_length(p_names, 1), 0) > 500 then raise exception 'register_full'; end if;
  select coalesce(max(position), 0) into start from public.people where register_id = r;
  insert into public.people (register_id, name, position)
    select r, private.clean(n, 80), start + ord from unnest(p_names) with ordinality as t(n, ord)
    where private.clean(n, 80) is not null;
  return private.register_json(r);
end $$;

create function public.rename_person(p_token uuid, p_person uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare r uuid := private.reg_for(p_token);
begin
  if private.clean(p_name, 80) is null then raise exception 'name_required'; end if;
  update public.people set name = private.clean(p_name, 80) where id = p_person and register_id = r;
end $$;

create function public.remove_person(p_token uuid, p_person uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r uuid := private.reg_for(p_token);
begin
  delete from public.people where id = p_person and register_id = r;
  return private.register_json(r);
end $$;

create function public.set_mark(p_token uuid, p_person uuid, p_day date, p_status text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare r uuid := private.reg_for(p_token);
begin
  if not exists (select 1 from public.people where id = p_person and register_id = r) then raise exception 'not_found'; end if;
  if p_status is null then
    delete from public.marks where person_id = p_person and day = p_day;
  else
    if p_status not in ('p','l','a','e') then raise exception 'bad_status'; end if;
    insert into public.marks (person_id, register_id, day, status, reason)
      values (p_person, r, p_day, p_status, case when p_status in ('a','e') then private.clean(p_reason, 200) end)
    on conflict (person_id, day) do update set status = excluded.status, reason = excluded.reason, updated_at = now();
  end if;
end $$;

create function public.mark_rest(p_token uuid, p_day date, p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r uuid := private.reg_for(p_token);
begin
  if p_status not in ('p','l','a','e') then raise exception 'bad_status'; end if;
  insert into public.marks (person_id, register_id, day, status)
    select p.id, r, p_day, p_status from public.people p where p.register_id = r
  on conflict (person_id, day) do nothing;
  return private.register_json(r);
end $$;

create function public.clear_day(p_token uuid, p_day date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r uuid := private.reg_for(p_token);
begin
  delete from public.marks where register_id = r and day = p_day;
  return private.register_json(r);
end $$;

create function public.rename_register(p_token uuid, p_name text, p_keeper text) returns void
language plpgsql security definer set search_path = '' as $$
declare r uuid := private.reg_for(p_token);
begin
  update public.registers set
    name = case when kind = 'class' then coalesce(private.clean(p_name, 80), name) else name end,
    keeper = coalesce(private.clean(p_keeper, 80), keeper)
  where id = r;
end $$;

create function public.change_pin(p_token uuid, p_new text) returns void
language plpgsql security definer set search_path = '' as $$
declare r uuid := private.reg_for(p_token);
begin
  perform private.check_pin(p_new);
  update public.registers set pin_hash = extensions.crypt(p_new, extensions.gen_salt('bf')) where id = r;
  delete from public.sessions where register_id = r and token <> p_token;
end $$;

-- The staff attendance keeper can give a teacher a new passcode if they forget it.
create function public.reset_class_pin(p_token uuid, p_class uuid, p_new text) returns void
language plpgsql security definer set search_path = '' as $$
declare r uuid := private.reg_for(p_token);
begin
  if (select kind from public.registers where id = r) <> 'staff' then raise exception 'not_allowed'; end if;
  perform private.check_pin(p_new);
  update public.registers set pin_hash = extensions.crypt(p_new, extensions.gen_salt('bf')), failed = 0, locked_until = null
    where id = p_class and kind = 'class';
  delete from public.sessions where register_id = p_class;
end $$;

create function public.delete_register(p_token uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r uuid := private.reg_for(p_token);
begin
  if (select kind from public.registers where id = r) <> 'class' then raise exception 'not_allowed'; end if;
  delete from public.registers where id = r;
end $$;

create function public.sign_out(p_token uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.sessions where token = p_token;
$$;

revoke all on function public.get_school, public.setup_school, public.create_class, public.unlock, public.get_register,
  public.add_people, public.rename_person, public.remove_person, public.set_mark, public.mark_rest, public.clear_day,
  public.rename_register, public.change_pin, public.reset_class_pin, public.delete_register, public.sign_out from public;
grant execute on function public.get_school, public.setup_school, public.create_class, public.unlock, public.get_register,
  public.add_people, public.rename_person, public.remove_person, public.set_mark, public.mark_rest, public.clear_day,
  public.rename_register, public.change_pin, public.reset_class_pin, public.delete_register, public.sign_out to anon, authenticated;
