revoke all on table public.reminder_settings, public.reminder_overrides, public.reminders, public.push_subscriptions, public.notification_deliveries from anon;
revoke all on table public.reminder_settings, public.reminder_overrides, public.reminders, public.push_subscriptions, public.notification_deliveries from authenticated;
grant select, insert, update, delete on table public.reminder_settings, public.reminder_overrides, public.reminders, public.push_subscriptions, public.notification_deliveries to authenticated;
