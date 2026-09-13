create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  status text not null default 'planning' check (status in ('planning','upcoming','in_progress','completed','cancelled')),
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (start_date is null or end_date is null or end_date >= start_date)
);

create table public.trip_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null,
  position integer not null default 1 check (position > 0),
  segment_type text not null default 'travel' check (segment_type in ('travel','stay','activity','other')),
  title text not null check (char_length(btrim(title)) between 1 and 240),
  origin text,
  destination text,
  starts_at timestamptz,
  ends_at timestamptz,
  time_zone text not null default 'Australia/Sydney',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, trip_id, user_id),
  foreign key (trip_id, user_id) references public.trips(id, user_id) on delete cascade,
  check (starts_at is null or ends_at is null or ends_at >= starts_at)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null,
  segment_id uuid,
  position integer not null default 1 check (position > 0),
  booking_type text not null check (booking_type in ('flight','accommodation','hire_car','activity','other')),
  title text not null check (char_length(btrim(title)) between 1 and 240),
  provider text,
  confirmation_reference text,
  status text not null default 'confirmed' check (status in ('confirmed','tentative','changed','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  time_zone text not null default 'Australia/Sydney',
  location text,
  booking_url text,
  notes text,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (trip_id, user_id) references public.trips(id, user_id) on delete cascade,
  foreign key (segment_id, trip_id, user_id) references public.trip_segments(id, trip_id, user_id),
  check (starts_at is null or ends_at is null or ends_at >= starts_at)
);

alter table public.tasks add column linked_trip_id uuid;
alter table public.tasks add constraint tasks_linked_trip_owner_fkey foreign key (linked_trip_id, user_id) references public.trips(id, user_id);

create index trips_user_status_start_idx on public.trips (user_id, status, start_date);
create index trip_segments_user_trip_position_idx on public.trip_segments (user_id, trip_id, position);
create index bookings_user_trip_position_idx on public.bookings (user_id, trip_id, position);
create index bookings_user_status_start_idx on public.bookings (user_id, status, starts_at);

alter table public.trips enable row level security;
alter table public.trip_segments enable row level security;
alter table public.bookings enable row level security;

create policy trips_select_owner on public.trips for select to authenticated using ((select auth.uid()) = user_id);
create policy trips_insert_owner on public.trips for insert to authenticated with check ((select auth.uid()) = user_id);
create policy trips_update_owner on public.trips for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy trips_delete_owner on public.trips for delete to authenticated using ((select auth.uid()) = user_id);

create policy trip_segments_select_owner on public.trip_segments for select to authenticated using ((select auth.uid()) = user_id);
create policy trip_segments_insert_owner on public.trip_segments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy trip_segments_update_owner on public.trip_segments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy trip_segments_delete_owner on public.trip_segments for delete to authenticated using ((select auth.uid()) = user_id);

create policy bookings_select_owner on public.bookings for select to authenticated using ((select auth.uid()) = user_id);
create policy bookings_insert_owner on public.bookings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy bookings_update_owner on public.bookings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy bookings_delete_owner on public.bookings for delete to authenticated using ((select auth.uid()) = user_id);
