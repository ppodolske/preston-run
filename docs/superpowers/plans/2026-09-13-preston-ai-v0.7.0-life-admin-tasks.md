# preston.ai v0.7.0 Life Admin Items & Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure owner-scoped Life Admin items and tasks, including renewals/deadlines/appointments, filterable views, detail/edit flows, and real Coming Up / Needs Attention summaries on the authenticated preston.ai homepage.

**Architecture:** Extend the v0.6.0 Supabase-backed private portal with two focused tables: `life_items` for facts/events/obligations and `tasks` for actions. Both tables use RLS plus ownership-safe composite foreign keys so linked People/Life Admin records cannot cross users even if an ID is guessed. Continue server-rendered, mobile-first pages and same-origin POST mutations using the existing authenticated request-scoped Supabase client.

**Tech Stack:** Node.js >=20, built-in `http`, `@supabase/supabase-js` 2.109.0, `@supabase/ssr` 0.10.3, Supabase Postgres/RLS, vanilla HTML/CSS, Node assert-based tests.

**Spec:** `docs/superpowers/specs/2026-09-13-life-admin-design.md`

## Global Constraints

- Canonical URL remains `https://preston.run`; product name remains `preston.ai`.
- `parks.preston.run` remains public and independent.
- All Life Admin/task HTML and API data is owner-authenticated and `Cache-Control: private, no-store`.
- Every exposed private Supabase table has RLS enabled and owner-scoped policies using `(select auth.uid()) = user_id`.
- UPDATE policies use both `USING` and `WITH CHECK`.
- `anon` receives no table privileges; `authenticated` receives only SELECT/INSERT/UPDATE/DELETE.
- No service-role key is added or exposed.
- Life Admin items remain distinct from tasks: items are facts/events/obligations; tasks are actions.
- Initial Life Admin categories are exactly: `renewal`, `deadline`, `bill`, `appointment`, `government`, `property`, `subscription`, `membership`, `event`, `other`.
- Initial Life Admin statuses are exactly: `upcoming`, `needs_action`, `waiting`, `completed`, `ignored`.
- Task statuses for v0.7.0 are: `open`, `in_progress`, `waiting`, `completed`, `ignored`.
- Priorities for both domains are: `low`, `normal`, `high`, `urgent`, default `normal`.
- `linked_person_id` is optional and ownership-safe. `linked_trip_id` is intentionally deferred until the v0.8.0 Trips migration.
- Gmail provenance automation, reminders, push notifications, and recurrence execution are out of scope; `source_metadata` and `recurrence_rule` are stored only as future-compatible structured/manual metadata.
- Mutating routes require an authenticated owner and existing same-origin POST validation.
- Target release version is exactly `0.7.0`; package, lockfile, branding marker, tests, and visible release marker remain consistent.

---

## Planned file structure

```text
supabase/migrations/<actual-version>_v070_life_admin_tasks.sql
supabase/migrations/<actual-version>_v070_restrict_life_admin_privileges.sql
src/data/life-admin.js
src/data/tasks.js
src/domain/life-admin.js
src/pages/life-admin.js
src/routes/life-admin.js
src/pages/home.js
src/routes/site.js
src/app.js
src/branding.js
package.json
package-lock.json
test/life-admin-migration.test.js
test/life-admin-domain.test.js
test/life-admin-data.test.js
test/life-admin-pages.test.js
test/life-admin-routes.test.js
test/pages.test.js
test/routes.test.js
test/smoke.test.js
test.js
```

---

### Task 1: Add Life Admin and task schema with ownership-safe links

**Files:**
- Create: `test/life-admin-migration.test.js`
- Create after applying migration: `supabase/migrations/<version>_v070_life_admin_tasks.sql`
- Create after privilege hardening: `supabase/migrations/<version>_v070_restrict_life_admin_privileges.sql`

**Interfaces:**
- Produces `public.life_items` and `public.tasks`.
- Adds a unique `(id, user_id)` constraint to `public.people` for composite ownership-safe references.
- `life_items(linked_person_id,user_id)` references `people(id,user_id)`.
- `tasks(linked_person_id,user_id)` references `people(id,user_id)`.
- `tasks(linked_life_item_id,user_id)` references `life_items(id,user_id)`.

- [ ] Write migration tests that fail until both v0.7 migrations exist and assert RLS, owner policies, category/status/priority constraints, composite ownership foreign keys, no trip field yet, and privilege hardening.
- [ ] Apply migration `v070_life_admin_tasks` to the connected `preston-ai` Supabase project.
- [ ] Query `supabase_migrations.schema_migrations`, capture the real version, and commit the exact SQL under that version.
- [ ] Query role grants. If Supabase defaults include anything beyond CRUD, apply `v070_restrict_life_admin_privileges` to revoke all from `anon`/`authenticated` and grant only CRUD to `authenticated`; commit its exact versioned migration.
- [ ] Run Supabase security advisors and verify zero new security findings.
- [ ] Query `pg_policies`, `pg_class.relrowsecurity`, and role grants to verify the live schema matches the migration contract.
- [ ] Commit.

Required schema shape:

```sql
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
  foreign key (linked_person_id, user_id) references public.people(id, user_id) on delete set null
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
  foreign key (linked_life_item_id, user_id) references public.life_items(id, user_id) on delete set null,
  foreign key (linked_person_id, user_id) references public.people(id, user_id) on delete set null
);
```

Add useful owner/status/due indexes. Enable RLS and create owner SELECT/INSERT/UPDATE/DELETE policies on both tables. Explicitly restrict table grants to CRUD-only for `authenticated` and none for `anon`.

---

### Task 2: Add Life Admin date/status domain logic

**Files:**
- Create: `src/domain/life-admin.js`
- Create: `test/life-admin-domain.test.js`

**Interfaces:**
- `validateLifeItemInput(input)` -> normalized Life Admin values or throws safe validation error.
- `validateTaskInput(input)` -> normalized task values or throws safe validation error.
- `parseLocalDateInput(value)` -> ISO UTC timestamp or null for HTML date values.
- `isOverdue(record, now)` -> boolean.
- `getNeedsAttention({ lifeItems, tasks, now })` -> priority-sorted rows.
- `getComingUpLifeItems(lifeItems, now, days=90)` -> chronologically sorted active upcoming rows.

- [ ] Test every allowed/rejected category/status/priority, blank optional dates, invalid dates, overdue rules, completed/ignored exclusions, urgent/high ordering, and chronological Coming Up ordering.
- [ ] Treat HTML date-only input as UTC midnight for deterministic storage; display later uses Australia/Sydney date formatting, which preserves the entered calendar date.
- [ ] Items with `status='needs_action'` always appear in Needs Attention even without a due date.
- [ ] Open/in-progress tasks past due appear in Needs Attention; completed/ignored never do.
- [ ] Run tests and commit.

---

### Task 3: Add owner-scoped data modules

**Files:**
- Create: `src/data/life-admin.js`
- Create: `src/data/tasks.js`
- Create: `test/life-admin-data.test.js`

**Interfaces:**
- Life items: `listLifeItems`, `getLifeItem`, `createLifeItem`, `updateLifeItem`, `deleteLifeItem`.
- Tasks: `listTasks`, `getTask`, `createTask`, `updateTask`, `deleteTask`.
- All create/update functions receive authenticated `user`; no request field may supply `user_id`.

- [ ] Fake-Supabase tests verify insert ownership, update filters by both `id` and authenticated `user_id`, ordering, null normalization, and linked IDs.
- [ ] Never pass arbitrary source metadata from public forms; manual forms store `{ source: 'manual' }` server-side.
- [ ] Run tests and commit.

---

### Task 4: Build mobile-first Life Admin list/detail/form pages

**Files:**
- Create: `src/pages/life-admin.js`
- Create: `test/life-admin-pages.test.js`

**Interfaces:**
- `renderLifeAdminPage({ lifeItems, tasks, people, filter, needsAttention, comingUp, flash })`.
- `renderLifeItemPage({ item, linkedTasks, person })`.
- `renderLifeItemFormPage({ item, people, mode, error })`.
- `renderTaskFormPage({ task, lifeItems, people, mode, error })`.

- [ ] Test HTML escaping, categories/status chips, overdue/urgent rendering, filters, linked person/task labels, empty states, form persistence after validation errors, and no owner email exposure.
- [ ] List filters include: Needs action, Upcoming, Renewals, Bills, Government, Property, Appointments, Subscriptions, Completed.
- [ ] Detail page shows the item plus linked tasks and clear Edit/Add task actions.
- [ ] Keep one-column mobile-first cards and large tap targets.
- [ ] Run tests and commit.

---

### Task 5: Add authenticated Life Admin/task CRUD routes

**Files:**
- Create: `src/routes/life-admin.js`
- Modify: `src/app.js`
- Create: `test/life-admin-routes.test.js`

**Interfaces:**
- `handleLifeAdminRoute(req,res,context)` handles:
  - `GET /life-admin`
  - `GET /life-admin/new`
  - `POST /life-admin`
  - `GET /life-admin/:id`
  - `GET /life-admin/:id/edit`
  - `POST /life-admin/:id`
  - `POST /life-admin/:id/delete`
  - `GET /tasks/new`
  - `POST /tasks`
  - `GET /tasks/:id/edit`
  - `POST /tasks/:id`
  - `POST /tasks/:id/delete`

- [ ] Every route requires owner auth; non-owner gets no private HTML.
- [ ] Every mutation requires existing `isSameOriginRequest` protection before data writes.
- [ ] Validate linked People/Life Item choices against owner-scoped queries; do not trust arbitrary linked UUIDs from form fields.
- [ ] Missing record -> 404; invalid input -> safe form rerender; database failure -> generic safe error.
- [ ] Successful redirects use generic flags (`?created=1`, `?saved=1`, `?deleted=1`) rather than private values.
- [ ] Private responses use `Cache-Control: private, no-store`.
- [ ] Wire route before `handleSiteRoute`/404 in `src/app.js`.
- [ ] Run tests and commit.

---

### Task 6: Add real Coming Up and Needs Attention homepage data

**Files:**
- Modify: `src/routes/site.js`
- Modify: `src/pages/home.js`
- Modify: `test/pages.test.js`
- Modify: `test/routes.test.js`

**Interfaces:**
- `renderHomePage({ user, upcomingBirthdays, birthdayDataUnavailable, upcomingLifeItems=[], needsAttention=[], lifeAdminDataUnavailable=false })`.

- [ ] Load Life Admin items/tasks only after owner authorization, alongside the existing People read.
- [ ] `Coming Up` includes real renewals/appointments/deadlines in addition to birthdays, with secure `/life-admin/:id` deep links.
- [ ] `Needs Attention` appears only on authenticated home and shows real overdue/urgent/action-required items/tasks.
- [ ] Source failure must not break weather/apps/birthdays; render a generic unavailable state without raw database errors.
- [ ] Login HTML must continue to omit `Coming Up`, `Needs Attention`, Life Admin labels, names, dates, app links, and admin URLs.
- [ ] Run tests and commit.

---

### Task 7: Bump to v0.7.0 and full release verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/branding.js`
- Modify: `test/smoke.test.js`
- Modify: `test.js`
- Modify: `.github/workflows/ci.yml`

- [ ] Set package, lockfile root metadata, branding, and visible marker to exactly `0.7.0`.
- [ ] Add all new tests to `test.js`.
- [ ] Add `build/preston-ai-v0.7.0` to push-triggered CI while retaining prior branch checks.
- [ ] Smoke test requires Life Admin routes, authenticated Needs Attention/Coming Up markup, and confirms anonymous login remains clean.
- [ ] Run GitHub Actions with Node 20, `npm ci`, complete `npm test`, and `node --check server.js`.
- [ ] Commit.

---

### Task 8: Live Supabase/security verification

**Files:**
- No code unless verification exposes a tested defect.

- [ ] Query `pg_class`, `pg_policies`, FK metadata, and role grants to confirm live RLS/ownership/CRUD-only privileges.
- [ ] Run Supabase security advisors and resolve any new findings.
- [ ] Verify no service-role key is present in repository or Railway variables.
- [ ] Confirm `anon` cannot query Life Admin/task rows through the Data API.
- [ ] If an owner Supabase user/session exists by then, perform an authenticated create/update/delete round trip for one Life Admin item and one task and remove only the verification rows afterward. If no owner session exists, record that browser E2E remains deferred rather than bypassing auth.
- [ ] Verify `parks.preston.run` remains public and unchanged.
- [ ] Do not merge or deploy without explicit user approval.

## Self-review checklist

- Life Admin items and tasks are distinct throughout schema/UI/routes.
- Categories/statuses exactly match the approved design; task statuses are explicitly defined for v0.7.
- Cross-owner linked-record references are prevented by composite ownership foreign keys.
- RLS + CRUD-only table privileges are both enforced.
- `linked_trip_id` is deliberately deferred until Trips exist in v0.8.
- No form controls `user_id` or arbitrary source metadata.
- All mutations are owner-authenticated and same-origin protected.
- Private HTML/data never appears in anonymous responses or public caches.
- Homepage shows only real stored Life Admin/task data; no fake placeholders.
- No Gmail automation, reminders, push delivery, or trip model is added early.
- Version is consistently `0.7.0`.
