alter table public.reminder_settings
  alter column morning_summary_time set default '07:15';

update public.reminder_settings
set morning_summary_time='07:15',
    updated_at=now()
where morning_summary_time='07:05';
