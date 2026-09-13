create table if not exists public.fitness_context_cache (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  source_generated_at timestamptz,
  garmin_sync_at timestamptz,
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.morning_digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  digest_date date not null,
  schema_version integer not null default 1,
  source_generated_at timestamptz,
  garmin_sync_at timestamptz,
  status text not null,
  headline text not null,
  cards jsonb not null default '[]'::jsonb,
  bullets jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  unique(user_id,digest_date)
);

create index if not exists morning_digests_owner_date_idx on public.morning_digests(user_id,digest_date desc);

alter table public.fitness_context_cache enable row level security;
alter table public.morning_digests enable row level security;

create policy fitness_context_cache_select on public.fitness_context_cache for select to authenticated using ((select auth.uid()) = user_id);
create policy fitness_context_cache_insert on public.fitness_context_cache for insert to authenticated with check ((select auth.uid()) = user_id);
create policy fitness_context_cache_update on public.fitness_context_cache for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy fitness_context_cache_delete on public.fitness_context_cache for delete to authenticated using ((select auth.uid()) = user_id);

create policy morning_digests_select on public.morning_digests for select to authenticated using ((select auth.uid()) = user_id);
create policy morning_digests_insert on public.morning_digests for insert to authenticated with check ((select auth.uid()) = user_id);
create policy morning_digests_update on public.morning_digests for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy morning_digests_delete on public.morning_digests for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.fitness_context_cache, public.morning_digests from anon;
revoke all on table public.fitness_context_cache, public.morning_digests from authenticated;
grant select, insert, update, delete on table public.fitness_context_cache, public.morning_digests to authenticated;
