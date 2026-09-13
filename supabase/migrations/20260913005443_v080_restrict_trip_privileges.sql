revoke all on public.trips, public.trip_segments, public.bookings from anon;
revoke all on public.trips, public.trip_segments, public.bookings from authenticated;
grant select, insert, update, delete on public.trips, public.trip_segments, public.bookings to authenticated;
