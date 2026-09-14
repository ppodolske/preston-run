alter table public.trips add column destination_label text;
alter table public.trips add column destination_city text;
alter table public.trips add column destination_region text;
alter table public.trips add column destination_country text;
alter table public.trips add column automation_managed boolean not null default false;

alter table public.bookings alter column trip_id drop not null;
alter table public.bookings add column origin text;
alter table public.bookings add column destination text;
alter table public.bookings add constraint bookings_id_user_id_key unique (id, user_id);
alter table public.bookings drop constraint bookings_booking_type_check;
alter table public.bookings add constraint bookings_booking_type_check check (booking_type in ('flight','accommodation','hire_car','transport','activity','other'));
alter table public.bookings add constraint bookings_segment_requires_trip_check check (segment_id is null or trip_id is not null);

alter table public.life_items add column linked_trip_id uuid;
alter table public.life_items add column ends_at timestamptz;
alter table public.life_items add column time_zone text;
alter table public.life_items add column location text;
alter table public.life_items add column provider text;
alter table public.life_items add column confirmation_reference text;
alter table public.life_items add column booking_url text;
alter table public.life_items add constraint life_items_linked_trip_owner_fkey foreign key (linked_trip_id, user_id) references public.trips(id, user_id);

alter table public.gmail_source_records add constraint gmail_source_records_id_user_id_key unique (id, user_id);

create table public.booking_source_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid not null,
  source_record_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, booking_id, source_record_id),
  foreign key (booking_id, user_id) references public.bookings(id, user_id) on delete cascade,
  foreign key (source_record_id, user_id) references public.gmail_source_records(id, user_id) on delete cascade
);

create index bookings_user_unlinked_start_idx on public.bookings (user_id, starts_at) where trip_id is null;
create index bookings_user_provider_reference_idx on public.bookings (user_id, provider, confirmation_reference);
create index life_items_user_linked_trip_start_idx on public.life_items (user_id, linked_trip_id, starts_at);
create index life_items_linked_trip_owner_idx on public.life_items (linked_trip_id, user_id);
create index trips_user_destination_start_idx on public.trips (user_id, destination_country, destination_region, destination_city, start_date);
create index booking_source_links_user_source_idx on public.booking_source_links (user_id, source_record_id);
create index booking_source_links_user_booking_idx on public.booking_source_links (user_id, booking_id);
create index booking_source_links_booking_owner_idx on public.booking_source_links (booking_id, user_id);
create index booking_source_links_source_owner_idx on public.booking_source_links (source_record_id, user_id);

alter table public.booking_source_links enable row level security;

revoke all on public.booking_source_links from anon;
revoke all on public.booking_source_links from authenticated;
grant select, insert, update, delete on public.booking_source_links to authenticated;

create policy booking_source_links_select_owner on public.booking_source_links
for select to authenticated
using ((select auth.uid()) = user_id);

create policy booking_source_links_insert_owner on public.booking_source_links
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy booking_source_links_update_owner on public.booking_source_links
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy booking_source_links_delete_owner on public.booking_source_links
for delete to authenticated
using ((select auth.uid()) = user_id);
