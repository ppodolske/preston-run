revoke all on public.life_items, public.tasks from anon;
revoke all on public.life_items, public.tasks from authenticated;
grant select, insert, update, delete on public.life_items, public.tasks to authenticated;
