create table public.reminder_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  timezone text not null default 'Australia/Sydney',
  morning_summary_time time not null default '07:05',
  quiet_hours_start time not null default '22:00',
  quiet_hours_end time not null default '07:00',
  birthday_offsets jsonb not null default '[30,14,7,1]'::jsonb,
  renewal_offsets jsonb not null default '[60,30,14,7,1]'::jsonb,
  deadline_offsets jsonb not null default '[14,7,3,0]'::jsonb,
  appointment_offsets jsonb not null default '[7,1,0]'::jsonb,
  trip_offsets jsonb not null default '[14,7,1]'::jsonb,
  noon_urgent_check boolean not null default true,
  evening_urgent_check boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reminder_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  offsets jsonb not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, entity_type, entity_id)
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  reminder_class text not null,
  occurrence_key text not null,
  target_date date not null,
  effective_trigger_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','sent','acknowledged','snoozed','cancelled')),
  acknowledged_at timestamptz,
  snoozed_until timestamptz,
  first_sent_at timestamptz,
  last_sent_at timestamptz,
  deep_link text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, occurrence_key),
  unique(id, user_id)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  device_label text not null default 'This device',
  active boolean not null default true,
  last_used_at timestamptz,
  failure_code text,
  failure_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, endpoint),
  unique(id, user_id)
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_id uuid not null,
  push_subscription_id uuid not null,
  attempted_at timestamptz not null default now(),
  delivered_at timestamptz,
  status text not null default 'pending' check (status in ('pending','delivered','transient_failure','permanent_failure')),
  error_category text,
  retry_count integer not null default 0 check (retry_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (reminder_id, user_id) references public.reminders (id, user_id) on delete cascade,
  foreign key (push_subscription_id, user_id) references public.push_subscriptions (id, user_id) on delete cascade,
  unique(reminder_id, push_subscription_id, attempted_at)
);

create index reminder_overrides_user_entity_idx on public.reminder_overrides(user_id, entity_type, entity_id);
create index reminders_due_idx on public.reminders(user_id, status, effective_trigger_at);
create index push_subscriptions_active_idx on public.push_subscriptions(user_id, active);
create index notification_deliveries_history_idx on public.notification_deliveries(user_id, attempted_at desc);

alter table public.reminder_settings enable row level security;
alter table public.reminder_overrides enable row level security;
alter table public.reminders enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;

create policy reminder_settings_select on public.reminder_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy reminder_settings_insert on public.reminder_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy reminder_settings_update on public.reminder_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy reminder_settings_delete on public.reminder_settings for delete to authenticated using ((select auth.uid()) = user_id);

create policy reminder_overrides_select on public.reminder_overrides for select to authenticated using ((select auth.uid()) = user_id);
create policy reminder_overrides_insert on public.reminder_overrides for insert to authenticated with check ((select auth.uid()) = user_id);
create policy reminder_overrides_update on public.reminder_overrides for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy reminder_overrides_delete on public.reminder_overrides for delete to authenticated using ((select auth.uid()) = user_id);

create policy reminders_select on public.reminders for select to authenticated using ((select auth.uid()) = user_id);
create policy reminders_insert on public.reminders for insert to authenticated with check ((select auth.uid()) = user_id);
create policy reminders_update on public.reminders for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy reminders_delete on public.reminders for delete to authenticated using ((select auth.uid()) = user_id);

create policy push_subscriptions_select on public.push_subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy push_subscriptions_insert on public.push_subscriptions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy push_subscriptions_update on public.push_subscriptions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated using ((select auth.uid()) = user_id);

create policy notification_deliveries_select on public.notification_deliveries for select to authenticated using ((select auth.uid()) = user_id);
create policy notification_deliveries_insert on public.notification_deliveries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy notification_deliveries_update on public.notification_deliveries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy notification_deliveries_delete on public.notification_deliveries for delete to authenticated using ((select auth.uid()) = user_id);
