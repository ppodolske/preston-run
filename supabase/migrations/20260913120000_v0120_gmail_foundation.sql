create table if not exists public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_account_email text not null,
  google_subject text,
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  scope text not null default '',
  status text not null default 'connected' check (status in ('connected','degraded','disconnected')),
  last_successful_scan_at timestamptz,
  last_attempted_scan_at timestamptz,
  last_error text,
  first_scan_completed_at timestamptz,
  checkpoint_received_at timestamptz,
  checkpoint_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, gmail_account_email)
);

create table if not exists public.gmail_scan_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.gmail_connections(id) on delete cascade,
  scan_type text not null check (scan_type in ('initial','manual_incremental','retry')),
  status text not null check (status in ('running','succeeded','failed','partial')),
  scanner_version text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  lookback_start_at timestamptz,
  checkpoint_before_at timestamptz,
  checkpoint_after_at timestamptz,
  discovered_count integer not null default 0,
  processed_count integer not null default 0,
  ignored_count integer not null default 0,
  relevant_count integer not null default 0,
  facts_created_count integer not null default 0,
  records_created_count integer not null default 0,
  records_updated_count integer not null default 0,
  review_items_created_count integer not null default 0,
  pdf_unreadable_count integer not null default 0,
  error_summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.gmail_source_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.gmail_connections(id) on delete cascade,
  scan_run_id uuid references public.gmail_scan_runs(id) on delete set null,
  source_system text not null default 'gmail',
  gmail_account_email text not null,
  gmail_message_id text not null,
  gmail_thread_id text,
  sender text,
  subject text,
  received_at timestamptz not null,
  label_ids jsonb not null default '[]'::jsonb,
  source_link text,
  classification_hint text,
  processing_status text not null default 'pending' check (processing_status in ('pending','processed','ignored','skipped','retry')),
  processing_reason text,
  scanner_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, gmail_account_email, gmail_message_id)
);

create table if not exists public.gmail_attachment_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_record_id uuid not null references public.gmail_source_records(id) on delete cascade,
  gmail_attachment_id text not null,
  filename text,
  mime_type text,
  source_link text,
  processing_status text not null default 'pending' check (processing_status in ('pending','processed','ignored','skipped','retry')),
  processing_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_record_id, gmail_attachment_id)
);

create table if not exists public.gmail_extracted_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_record_id uuid not null references public.gmail_source_records(id) on delete cascade,
  attachment_record_id uuid references public.gmail_attachment_records(id) on delete set null,
  fact_type text not null,
  fact_value jsonb not null,
  fact_schema_version integer not null default 1,
  parser_version text not null,
  classification_confidence numeric,
  extraction_confidence numeric,
  entity_match_confidence numeric,
  urgency_confidence numeric,
  is_current_candidate boolean not null default true,
  supersedes_fact_id uuid references public.gmail_extracted_facts(id) on delete set null,
  rejected_for_entity_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.gmail_activity_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_record_id uuid references public.gmail_source_records(id) on delete set null,
  fact_id uuid references public.gmail_extracted_facts(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  field_name text,
  old_value jsonb,
  new_value jsonb,
  action text not null check (action in ('create','update','undo','reject','skip')),
  automatic boolean not null default true,
  manual_authority boolean not null default false,
  rule_version text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.gmail_review_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_record_id uuid references public.gmail_source_records(id) on delete cascade,
  fact_id uuid references public.gmail_extracted_facts(id) on delete set null,
  review_item_id uuid not null,
  review_type text not null check (review_type in ('confirm_new_item','resolve_conflict','confirm_match','review_unreadable_source')),
  recommended_action text,
  current_value jsonb,
  gmail_value jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, source_record_id, fact_id, review_type)
);

alter table public.gmail_connections enable row level security;
alter table public.gmail_scan_runs enable row level security;
alter table public.gmail_source_records enable row level security;
alter table public.gmail_attachment_records enable row level security;
alter table public.gmail_extracted_facts enable row level security;
alter table public.gmail_activity_entries enable row level security;
alter table public.gmail_review_links enable row level security;

create policy "gmail_connections_select_own" on public.gmail_connections for select using (auth.uid() = user_id);
create policy "gmail_connections_insert_own" on public.gmail_connections for insert with check (auth.uid() = user_id);
create policy "gmail_connections_update_own" on public.gmail_connections for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gmail_connections_delete_own" on public.gmail_connections for delete using (auth.uid() = user_id);

create policy "gmail_scan_runs_select_own" on public.gmail_scan_runs for select using (auth.uid() = user_id);
create policy "gmail_scan_runs_insert_own" on public.gmail_scan_runs for insert with check (auth.uid() = user_id);
create policy "gmail_scan_runs_update_own" on public.gmail_scan_runs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gmail_scan_runs_delete_own" on public.gmail_scan_runs for delete using (auth.uid() = user_id);

create policy "gmail_source_records_select_own" on public.gmail_source_records for select using (auth.uid() = user_id);
create policy "gmail_source_records_insert_own" on public.gmail_source_records for insert with check (auth.uid() = user_id);
create policy "gmail_source_records_update_own" on public.gmail_source_records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gmail_source_records_delete_own" on public.gmail_source_records for delete using (auth.uid() = user_id);

create policy "gmail_attachment_records_select_own" on public.gmail_attachment_records for select using (auth.uid() = user_id);
create policy "gmail_attachment_records_insert_own" on public.gmail_attachment_records for insert with check (auth.uid() = user_id);
create policy "gmail_attachment_records_update_own" on public.gmail_attachment_records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gmail_attachment_records_delete_own" on public.gmail_attachment_records for delete using (auth.uid() = user_id);

create policy "gmail_extracted_facts_select_own" on public.gmail_extracted_facts for select using (auth.uid() = user_id);
create policy "gmail_extracted_facts_insert_own" on public.gmail_extracted_facts for insert with check (auth.uid() = user_id);
create policy "gmail_extracted_facts_update_own" on public.gmail_extracted_facts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gmail_extracted_facts_delete_own" on public.gmail_extracted_facts for delete using (auth.uid() = user_id);

create policy "gmail_activity_entries_select_own" on public.gmail_activity_entries for select using (auth.uid() = user_id);
create policy "gmail_activity_entries_insert_own" on public.gmail_activity_entries for insert with check (auth.uid() = user_id);
create policy "gmail_activity_entries_update_own" on public.gmail_activity_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gmail_activity_entries_delete_own" on public.gmail_activity_entries for delete using (auth.uid() = user_id);

create policy "gmail_review_links_select_own" on public.gmail_review_links for select using (auth.uid() = user_id);
create policy "gmail_review_links_insert_own" on public.gmail_review_links for insert with check (auth.uid() = user_id);
create policy "gmail_review_links_update_own" on public.gmail_review_links for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gmail_review_links_delete_own" on public.gmail_review_links for delete using (auth.uid() = user_id);
