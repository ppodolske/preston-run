alter table public.reminders
  add column policy_source text not null default 'default'
  check (policy_source in ('default','override'));

create index reminders_policy_source_idx on public.reminders(user_id, policy_source, status, effective_trigger_at);
