revoke all on table public.calendar_connections, public.calendar_sources, public.calendar_events from anon;
revoke all on table public.calendar_connections, public.calendar_sources, public.calendar_events from authenticated;
grant select, insert, update, delete on table public.calendar_connections, public.calendar_sources, public.calendar_events to authenticated;
