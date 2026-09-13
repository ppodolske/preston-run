create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'Australia/Sydney',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  relationship text,
  birthday_month smallint check (birthday_month between 1 and 12),
  birthday_day smallint check (birthday_day between 1 and 31),
  birth_year smallint check (birth_year is null or birth_year between 1900 and 2200),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((birthday_month is null and birthday_day is null) or (birthday_month is not null and birthday_day is not null)),
  check (birthday_month is null or birthday_day <= extract(day from (make_date(2000, birthday_month, 1) + interval '1 month - 1 day')))
);

create index people_user_active_birthday_idx on public.people (user_id, active, birthday_month, birthday_day);

alter table public.profiles enable row level security;
alter table public.people enable row level security;

create policy profiles_select_owner on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy profiles_insert_owner on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy profiles_update_owner on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy profiles_delete_owner on public.profiles for delete to authenticated using ((select auth.uid()) = user_id);

create policy people_select_owner on public.people for select to authenticated using ((select auth.uid()) = user_id);
create policy people_insert_owner on public.people for insert to authenticated with check ((select auth.uid()) = user_id);
create policy people_update_owner on public.people for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy people_delete_owner on public.people for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.profiles, public.people from anon;
grant select, insert, update, delete on public.profiles, public.people to authenticated;
