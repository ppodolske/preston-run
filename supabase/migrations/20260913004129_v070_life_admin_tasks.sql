alter table public.people add constraint people_id_user_id_key unique (id, user_id);

create table public.life_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  category text not null check (category in ('renewal','deadline','bill','appointment','government','property','subscription','membership','event','other')),
  status text not null default 'upcoming' check (status in ('upcoming','needs_action','waiting','completed','ignored')),
  due_at timestamptz,
  starts_at timestamptz,
  recurrence_rule text,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  notes text,
  linked_person_id uuid,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (linked_person_id, user_id) references public.people(id, user_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  status text not null default 'open' check (status in ('open','in_progress','waiting','completed','ignored')),
  due_at timestamptz,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  linked_life_item_id uuid,
  linked_person_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (linked_life_item_id, user_id) references public.life_items(id, user_id),
  foreign key (linked_person_id, user_id) references public.people(id, user_id)
);

create index life_items_user_status_due_idx on public.life_items (user_id, status, due_at);
create index life_items_user_category_due_idx on public.life_items (user_id, category, due_at);
create index tasks_user_status_due_idx on public.tasks (user_id, status, due_at);
create index tasks_user_priority_due_idx on public.tasks (user_id, priority, due_at);

alter table public.life_items enable row level security;
alter table public.tasks enable row level security;

create policy life_items_select_owner on public.life_items for select to authenticated using ((select auth.uid()) = user_id);
create policy life_items_insert_owner on public.life_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy life_items_update_owner on public.life_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy life_items_delete_owner on public.life_items for delete to authenticated using ((select auth.uid()) = user_id);

create policy tasks_select_owner on public.tasks for select to authenticated using ((select auth.uid()) = user_id);
create policy tasks_insert_owner on public.tasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy tasks_update_owner on public.tasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy tasks_delete_owner on public.tasks for delete to authenticated using ((select auth.uid()) = user_id);
