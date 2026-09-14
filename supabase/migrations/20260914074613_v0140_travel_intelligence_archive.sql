alter table public.trips add column archived_at timestamptz;

create index trips_user_archived_end_idx on public.trips (user_id, archived_at, end_date);

create table public.booking_legs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid not null,
  position integer not null default 1 check (position > 0),
  service_number text,
  origin text,
  destination text,
  departs_at timestamptz,
  arrives_at timestamptz,
  departure_time_zone text,
  arrival_time_zone text,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (booking_id, user_id) references public.bookings(id, user_id) on delete cascade,
  unique (booking_id, position),
  check (departs_at is null or arrives_at is null or arrives_at >= departs_at)
);

create index booking_legs_booking_owner_idx on public.booking_legs (booking_id, user_id);

alter table public.booking_legs enable row level security;

create policy booking_legs_select_owner on public.booking_legs
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy booking_legs_insert_owner on public.booking_legs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy booking_legs_update_owner on public.booking_legs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy booking_legs_delete_owner on public.booking_legs
  for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.booking_legs from anon;
grant select, insert, update, delete on public.booking_legs to authenticated;
