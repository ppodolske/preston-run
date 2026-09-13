create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google','apple')),
  account_external_id text,
  account_label text,
  credential_ciphertext text not null,
  status text not null default 'connected' check (status in ('connected','attention')),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider),
  unique(id, user_id)
);

create table public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null,
  provider_calendar_id text not null,
  display_name text not null,
  color text,
  selected boolean not null default false,
  read_only boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, connection_id, provider_calendar_id),
  unique(id, user_id),
  unique(id, connection_id, user_id),
  foreign key (connection_id, user_id) references public.calendar_connections(id, user_id) on delete cascade
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null,
  calendar_source_id uuid not null,
  provider_event_id text not null,
  occurrence_key text not null,
  series_id text,
  title text not null,
  all_day boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  start_date date,
  end_date date,
  time_zone text,
  location text,
  status text not null default 'confirmed' check (status in ('confirmed','tentative','cancelled')),
  owner_response text not null default 'unknown' check (owner_response in ('accepted','tentative','declined','needs_action','unknown')),
  external_url text,
  provider_updated_at timestamptz,
  sync_seen_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, calendar_source_id, occurrence_key),
  foreign key (connection_id, user_id) references public.calendar_connections(id, user_id) on delete cascade,
  foreign key (calendar_source_id, user_id) references public.calendar_sources(id, user_id) on delete cascade,
  foreign key (calendar_source_id, connection_id, user_id) references public.calendar_sources(id, connection_id, user_id) on delete cascade,
  check (
    (all_day and start_date is not null and end_date is not null and starts_at is null and ends_at is null and end_date > start_date)
    or
    (not all_day and starts_at is not null and ends_at is not null and start_date is null and end_date is null and ends_at >= starts_at)
  )
);

create index calendar_connections_owner_provider_idx on public.calendar_connections(user_id, provider);
create index calendar_sources_owner_connection_selected_idx on public.calendar_sources(user_id, connection_id, selected);
create index calendar_events_timed_window_idx on public.calendar_events(user_id, calendar_source_id, starts_at, ends_at) where not all_day;
create index calendar_events_all_day_window_idx on public.calendar_events(user_id, calendar_source_id, start_date, end_date) where all_day;
create index calendar_events_sync_seen_idx on public.calendar_events(user_id, calendar_source_id, sync_seen_at);

alter table public.calendar_connections enable row level security;
alter table public.calendar_sources enable row level security;
alter table public.calendar_events enable row level security;

create policy calendar_connections_select on public.calendar_connections for select to authenticated using ((select auth.uid()) = user_id);
create policy calendar_connections_insert on public.calendar_connections for insert to authenticated with check ((select auth.uid()) = user_id);
create policy calendar_connections_update on public.calendar_connections for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy calendar_connections_delete on public.calendar_connections for delete to authenticated using ((select auth.uid()) = user_id);

create policy calendar_sources_select on public.calendar_sources for select to authenticated using ((select auth.uid()) = user_id);
create policy calendar_sources_insert on public.calendar_sources for insert to authenticated with check ((select auth.uid()) = user_id);
create policy calendar_sources_update on public.calendar_sources for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy calendar_sources_delete on public.calendar_sources for delete to authenticated using ((select auth.uid()) = user_id);

create policy calendar_events_select on public.calendar_events for select to authenticated using ((select auth.uid()) = user_id);
create policy calendar_events_insert on public.calendar_events for insert to authenticated with check ((select auth.uid()) = user_id);
create policy calendar_events_update on public.calendar_events for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy calendar_events_delete on public.calendar_events for delete to authenticated using ((select auth.uid()) = user_id);
