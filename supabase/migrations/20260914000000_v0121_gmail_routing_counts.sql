alter table public.gmail_scan_runs
  add column if not exists trip_count integer not null default 0,
  add column if not exists life_admin_count integer not null default 0;
