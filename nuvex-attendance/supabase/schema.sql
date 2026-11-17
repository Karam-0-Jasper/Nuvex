-- Nuvex Attendance: database setup (school logins).
-- Paste all of this into Supabase → SQL Editor → New query → Run (on an empty project).
--
-- How access works:
--   * Every table is locked. The app can only call the functions at the bottom.
--   * Each function checks the login token on the server first.
--   * A teacher only reaches the registers they own. The school admin reaches every register in their school.
--   * Passwords are stored as bcrypt hashes; login tokens are stored as SHA-256 hashes.
--   * 5 wrong passwords lock that account for 15 minutes.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9-]{3,30}$'),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9._-]{2,30}$'),
  name text not null,
  role text not null check (role in ('admin', 'teacher')),
  pw_hash text not null,
  failed int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  unique (school_id, username)
);

create table public.sessions (
  token_hash text primary key,
  account_id uuid not null references public.accounts(id) on delete cascade,
  expires_at timestamptz not null
);
create index sessions_account on public.sessions(account_id);

-- Ids are made on the phone (so a register works offline before it reaches the server).
create table public.registers (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{6,40}$'),
  school_id uuid not null references public.schools(id) on delete cascade,
  owner_id uuid not null references public.accounts(id),
  name text not null default '',
  cols date[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index registers_school on public.registers(school_id);
create index registers_owner on public.registers(owner_id);

create table public.people (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{6,40}$'),
  register_id text not null references public.registers(id) on delete cascade,
  name text not null default '',
  position int not null default 0
);
create index people_register on public.people(register_id);

create table public.marks (
  person_id text not null references public.people(id) on delete cascade,
  register_id text not null references public.registers(id) on delete cascade,
  day date not null,
  status text not null check (status in ('p', 'a')),
  primary key (person_id, day)
);
create index marks_register on public.marks(register_id);

alter table public.schools enable row level security;
alter table public.accounts enable row level security;
alter table public.sessions enable row level security;
alter table public.registers enable row level security;
alter table public.people enable row level security;
alter table public.marks enable row level security;
revoke all on public.schools, public.accounts, public.sessions, public.registers, public.people, public.marks
  from public, anon, authenticated;

-- ---------- private helpers ----------

create function private.clean(p text, maxlen int) returns text
language sql immutable set search_path = '' as $$
  select nullif(left(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')), maxlen), '')
$$;

create function private.hash_token(p text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(coalesce(p, ''), 'sha256'), 'hex')
$$;

create function private.check_password(p text) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p is null or length(p) < 6 then raise exception 'password_too_short'; end if;
  if octet_length(p) > 72 then raise exception 'password_too_long'; end if;
end $$;

create function private.check_username(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare u text := lower(btrim(coalesce(p, '')));
begin
  if u !~ '^[a-z0-9._-]{2,30}$' then raise exception 'bad_username'; end if;
  return u;
end $$;

create function private.new_session(p_account uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare t text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  delete from public.sessions where expires_at < now();
  insert into public.sessions (token_hash, account_id, expires_at)
    values (private.hash_token(t), p_account, now() + interval '90 days');
  return t;
end $$;

-- The signed-in account for a token. Raises 'signed_out' if the token is unknown or expired.
create function private.me(p_token text) returns public.accounts
language plpgsql security definer set search_path = '' as $$
declare a public.accounts;
begin
  select acc.* into a from public.sessions s join public.accounts acc on acc.id = s.account_id
    where s.token_hash = private.hash_token(p_token) and s.expires_at > now();
  if a.id is null then raise exception 'signed_out'; end if;
  return a;
end $$;

create function private.can_edit(a public.accounts, p_register text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.registers r where r.id = p_register and r.school_id = a.school_id
                 and (a.role = 'admin' or r.owner_id = a.id))
$$;

create function private.team(a public.accounts) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'username', t.username, 'role', t.role)
                            order by t.role, t.name), '[]'::jsonb)
  from public.accounts t where t.school_id = a.school_id
$$;

create function private.data(a public.accounts) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'me', jsonb_build_object('id', a.id, 'name', a.name, 'username', a.username, 'role', a.role),
    'school', (select jsonb_build_object('name', s.name, 'code', s.code) from public.schools s where s.id = a.school_id),
    'registers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.name, 'owner', r.owner_id, 'ownerName', o.name,
        'created', (extract(epoch from r.created_at) * 1000)::bigint,
        'cols', to_jsonb(r.cols),
        'people', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) order by p.position, p.id)
                            from public.people p where p.register_id = r.id), '[]'::jsonb),
        'marks', coalesce((select jsonb_object_agg(m.person_id || '|' || m.day::text, m.status)
                           from public.marks m where m.register_id = r.id), '{}'::jsonb)
      ) order by r.created_at)
      from public.registers r join public.accounts o on o.id = r.owner_id
      where r.school_id = a.school_id and (a.role = 'admin' or r.owner_id = a.id)), '[]'::jsonb),
    'team', case when a.role = 'admin' then private.team(a) end
  )
$$;

create function private.admin_only(a public.accounts) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if a.role <> 'admin' then raise exception 'not_allowed'; end if;
end $$;

revoke all on all functions in schema private from public, anon, authenticated;

-- ---------- what the app can call ----------

-- Anyone can start a school; they become its admin.
create function public.create_school(p_code text, p_school text, p_name text, p_username text, p_password text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare sc uuid; acc uuid; v_code text := lower(btrim(coalesce(p_code, ''))); u text := private.check_username(p_username);
begin
  if v_code !~ '^[a-z0-9-]{3,30}$' then raise exception 'bad_school_code'; end if;
  if private.clean(p_school, 120) is null or private.clean(p_name, 80) is null then raise exception 'name_required'; end if;
  perform private.check_password(p_password);
  if exists (select 1 from public.schools s where s.code = v_code) then raise exception 'school_code_taken'; end if;
  if (select count(*) from public.schools) >= 5000 then raise exception 'too_many_schools'; end if;
  insert into public.schools (code, name) values (v_code, private.clean(p_school, 120)) returning id into sc;
  insert into public.accounts (school_id, username, name, role, pw_hash)
    values (sc, u, private.clean(p_name, 80), 'admin', extensions.crypt(p_password, extensions.gen_salt('bf', 10)))
    returning id into acc;
  return jsonb_build_object('token', private.new_session(acc));
end $$;

-- Returns an error object instead of raising, so the failed-attempt count is kept.
create function public.login(p_code text, p_username text, p_password text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.accounts;
begin
  select acc.* into a from public.accounts acc join public.schools s on s.id = acc.school_id
    where s.code = lower(btrim(coalesce(p_code, ''))) and acc.username = lower(btrim(coalesce(p_username, '')))
    for update of acc;
  if a.id is null then
    -- Same work as a real check, so the reply time doesn't reveal which usernames exist.
    perform extensions.crypt(coalesce(p_password, ''), '$2a$10$abcdefghijklmnopqrstuu');
    return jsonb_build_object('error', 'wrong');
  end if;
  if a.locked_until is not null and a.locked_until > now() then
    return jsonb_build_object('error', 'locked', 'seconds', ceil(extract(epoch from a.locked_until - now())));
  end if;
  if p_password is not null and a.pw_hash = extensions.crypt(p_password, a.pw_hash) then
    update public.accounts set failed = 0, locked_until = null where id = a.id;
    return jsonb_build_object('token', private.new_session(a.id));
  end if;
  if a.failed + 1 >= 5 then
    update public.accounts set failed = 0, locked_until = now() + interval '15 minutes' where id = a.id;
    return jsonb_build_object('error', 'locked', 'seconds', 900);
  end if;
  update public.accounts set failed = a.failed + 1 where id = a.id;
  return jsonb_build_object('error', 'wrong');
end $$;

create function public.logout(p_token text) returns void
language sql security definer set search_path = '' as $$
  delete from public.sessions where token_hash = private.hash_token(p_token);
$$;

-- Everything this account may see. Also keeps an active login alive (90 days from last use).
create function public.get_data(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.accounts := private.me(p_token);
begin
  update public.sessions set expires_at = now() + interval '90 days'
    where token_hash = private.hash_token(p_token) and expires_at < now() + interval '80 days';
  return private.data(a);
end $$;

-- Changes made on the phone, in order. Ops the account isn't allowed to make are skipped (their index is returned).
create function public.apply_ops(p_token text, p_ops jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.accounts := private.me(p_token);
  op jsonb; i int := -1; skipped int[] := '{}'; t text; rid text; pid text; d date; new_owner uuid;
begin
  if jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) > 1000 then raise exception 'bad_ops'; end if;
  for op in select value from jsonb_array_elements(p_ops) loop
    i := i + 1;
    begin
      t := op->>'t';
      rid := op->>'reg';
      if t = 'reg' then
        rid := op->>'id';
        if exists (select 1 from public.registers where id = rid) then
          if not private.can_edit(a, rid) then raise exception 'not_allowed'; end if;
          update public.registers set name = coalesce(private.clean(op->>'name', 80), ''), updated_at = now() where id = rid;
        else
          if (select count(*) from public.registers where school_id = a.school_id) >= 2000 then raise exception 'too_many_registers'; end if;
          insert into public.registers (id, school_id, owner_id, name) values (rid, a.school_id, a.id, coalesce(private.clean(op->>'name', 80), ''));
        end if;
      elsif t = 'delreg' then
        if not private.can_edit(a, op->>'id') then raise exception 'not_allowed'; end if;
        delete from public.registers where id = op->>'id';
      elsif t = 'cols' then
        if not private.can_edit(a, rid) then raise exception 'not_allowed'; end if;
        if jsonb_array_length(op->'cols') > 3000 then raise exception 'too_many_dates'; end if;
        update public.registers set updated_at = now(),
          cols = coalesce((select array_agg(distinct x::date order by x::date) from jsonb_array_elements_text(op->'cols') x), '{}')
          where id = rid;
      elsif t = 'person' then
        pid := op->>'id';
        if not private.can_edit(a, rid) then raise exception 'not_allowed'; end if;
        if exists (select 1 from public.people where id = pid and register_id <> rid) then raise exception 'not_allowed'; end if;
        if not exists (select 1 from public.people where id = pid)
           and (select count(*) from public.people where register_id = rid) >= 500 then raise exception 'register_full'; end if;
        insert into public.people (id, register_id, name, position)
          values (pid, rid, coalesce(private.clean(op->>'name', 80), ''), coalesce((op->>'pos')::int, 0))
          on conflict (id) do update set name = excluded.name, position = excluded.position;
      elsif t = 'delperson' then
        select register_id into rid from public.people where id = op->>'id';
        if rid is not null then
          if not private.can_edit(a, rid) then raise exception 'not_allowed'; end if;
          delete from public.people where id = op->>'id';
        end if;
      elsif t = 'mark' then
        pid := op->>'p';
        d := (op->>'d')::date;
        if not private.can_edit(a, rid) or not exists (select 1 from public.people where id = pid and register_id = rid) then
          raise exception 'not_allowed';
        end if;
        if op->>'s' is null then
          delete from public.marks where person_id = pid and day = d;
        else
          insert into public.marks (person_id, register_id, day, status) values (pid, rid, d, op->>'s')
            on conflict (person_id, day) do update set status = excluded.status;
        end if;
      elsif t = 'owner' then
        perform private.admin_only(a);
        new_owner := (op->>'owner')::uuid;
        if not private.can_edit(a, op->>'id')
           or not exists (select 1 from public.accounts where id = new_owner and school_id = a.school_id) then raise exception 'not_allowed'; end if;
        update public.registers set owner_id = new_owner, updated_at = now() where id = op->>'id';
      else
        raise exception 'bad_op';
      end if;
    exception when others then
      skipped := skipped || i;
    end;
  end loop;
  return jsonb_build_object('done', i + 1, 'skipped', to_jsonb(skipped));
end $$;

-- ---------- school admin ----------

create function public.add_teacher(p_token text, p_name text, p_username text, p_password text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.accounts := private.me(p_token); u text := private.check_username(p_username);
begin
  perform private.admin_only(a);
  if private.clean(p_name, 80) is null then raise exception 'name_required'; end if;
  perform private.check_password(p_password);
  if exists (select 1 from public.accounts where school_id = a.school_id and username = u) then raise exception 'username_taken'; end if;
  if (select count(*) from public.accounts where school_id = a.school_id) >= 300 then raise exception 'too_many_accounts'; end if;
  insert into public.accounts (school_id, username, name, role, pw_hash)
    values (a.school_id, u, private.clean(p_name, 80), 'teacher', extensions.crypt(p_password, extensions.gen_salt('bf', 10)));
  return private.team(a);
end $$;

-- Gives a teacher a new password (if they forget theirs) and signs them out everywhere.
create function public.reset_password(p_token text, p_account uuid, p_new text) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.accounts := private.me(p_token);
begin
  perform private.admin_only(a);
  perform private.check_password(p_new);
  if p_account = a.id then raise exception 'use_change_password'; end if;
  update public.accounts set pw_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)), failed = 0, locked_until = null
    where id = p_account and school_id = a.school_id;
  if not found then raise exception 'not_found'; end if;
  delete from public.sessions where account_id = p_account;
end $$;

-- Removes a teacher's login. Their registers are kept and move to the admin.
create function public.remove_teacher(p_token text, p_account uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.accounts := private.me(p_token);
begin
  perform private.admin_only(a);
  if p_account = a.id then raise exception 'not_allowed'; end if;
  if not exists (select 1 from public.accounts where id = p_account and school_id = a.school_id and role = 'teacher') then raise exception 'not_found'; end if;
  update public.registers set owner_id = a.id where owner_id = p_account;
  delete from public.accounts where id = p_account;
  return private.team(a);
end $$;

create function public.change_password(p_token text, p_old text, p_new text) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.accounts := private.me(p_token);
begin
  if p_old is null or a.pw_hash <> extensions.crypt(p_old, a.pw_hash) then raise exception 'wrong_password'; end if;
  perform private.check_password(p_new);
  update public.accounts set pw_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)) where id = a.id;
  delete from public.sessions where account_id = a.id and token_hash <> private.hash_token(p_token);
end $$;

revoke all on function public.create_school, public.login, public.logout, public.get_data, public.apply_ops,
  public.add_teacher, public.reset_password, public.remove_teacher, public.change_password from public;
grant execute on function public.create_school, public.login, public.logout, public.get_data, public.apply_ops,
  public.add_teacher, public.reset_password, public.remove_teacher, public.change_password to anon, authenticated;
