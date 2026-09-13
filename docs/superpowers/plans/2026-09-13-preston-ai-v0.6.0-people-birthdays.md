# preston.ai v0.6.0 People, Birthdays & Coming Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first private Supabase-backed Life Admin data domain to preston.ai: owner-scoped People/Birthdays CRUD plus a secure Coming Up birthday summary on the authenticated homepage.

**Architecture:** Continue the v0.5.0 Node 20 + Supabase SSR architecture. Store `profiles` and `people` in Supabase with RLS keyed to `auth.uid()`. All database access occurs through the authenticated request-scoped Supabase client, so the publishable key is sufficient and the database remains protected by RLS. Server-rendered pages and form POST routes provide mobile-friendly CRUD without exposing data to anonymous HTML or static assets.

**Tech Stack:** Node.js >=20, built-in `http`, `@supabase/supabase-js` 2.109.0, `@supabase/ssr` 0.10.3, Supabase Postgres/RLS, vanilla HTML/CSS, Node assert-based tests.

**Spec:** `docs/superpowers/specs/2026-09-13-life-admin-design.md`

## Global Constraints

- Canonical URL remains `https://preston.run`; product name remains `preston.ai`.
- `parks.preston.run` remains public and independent.
- All People/Birthday routes are owner-authenticated and return `Cache-Control: private, no-store` when private data is present.
- `people.user_id` and `profiles.user_id` are UUIDs tied to the authenticated Supabase user.
- Every exposed private table has RLS enabled and owner-scoped policies using `(select auth.uid()) = user_id`.
- No service-role key is added or exposed.
- Birthday year remains nullable. Unknown years are stored only as month/day, never as a fake full date.
- People records support `name`, `relationship`, `birthday_month`, `birthday_day`, nullable `birth_year`, `notes`, `active`, and timestamps.
- v0.6.0 does not add Gmail, tasks, trips, push notifications, or fake future-domain cards.
- Mutating form routes require an authenticated owner and same-origin POST validation.
- Target release version is exactly `0.6.0`; package, branding marker, tests, and lockfile stay consistent.

---

## Planned file structure

```text
supabase/migrations/<actual-version>_v060_people_birthdays.sql
src/data/profile.js
src/data/people.js
src/domain/birthdays.js
src/http/forms.js
src/pages/home.js
src/pages/people.js
src/routes/people.js
src/routes/site.js
src/app.js
src/branding.js
package.json
package-lock.json
test/birthdays.test.js
test/forms.test.js
test/people-data.test.js
test/people-pages.test.js
test/people-routes.test.js
test/routes.test.js
test/smoke.test.js
```

---

### Task 1: Add v0.6.0 database schema and RLS

**Files:**
- Create: `supabase/migrations/<actual-version>_v060_people_birthdays.sql`
- Add/update tests that inspect the committed migration text.

**Interfaces:**
- Produces `public.profiles` and `public.people`.
- `profiles.user_id` unique; `people.user_id` indexed.
- Both tables are RLS-protected by the authenticated user's `auth.uid()`.

- [ ] Write migration assertions covering table names, RLS enablement, owner predicates, nullable `birth_year`, and valid month/day checks.
- [ ] Verify the test fails before the migration file exists.
- [ ] Apply the migration through the connected Supabase project using the migration name `v060_people_birthdays`.
- [ ] Query Supabase migration history to capture the actual generated migration version/name and commit the exact SQL under that versioned filename.
- [ ] Run Supabase security advisors and fix any schema/RLS findings introduced by this migration.
- [ ] Run migration-text tests and commit.

Schema requirements:

```sql
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'Australia/Sydney',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  relationship text,
  birthday_month smallint check (birthday_month between 1 and 12),
  birthday_day smallint check (birthday_day between 1 and 31),
  birth_year smallint check (birth_year is null or birth_year between 1900 and 2200),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((birthday_month is null and birthday_day is null) or (birthday_month is not null and birthday_day is not null))
);
```

Add an index on `(user_id, active, birthday_month, birthday_day)`. Enable RLS and create SELECT/INSERT/UPDATE/DELETE policies `to authenticated` with ownership predicates. UPDATE requires both `using` and `with check`.

---

### Task 2: Add profile and People data-access modules

**Files:**
- Create: `src/data/profile.js`
- Create: `src/data/people.js`
- Create: `test/people-data.test.js`

**Interfaces:**
- `ensureProfile(supabase, user)` -> profile row.
- `listPeople(supabase)` -> people ordered by active/name.
- `getPerson(supabase, id)` -> row or null.
- `createPerson(supabase, user, input)` -> inserted row.
- `updatePerson(supabase, user, id, input)` -> updated row or null.
- `deletePerson(supabase, id)` -> boolean.

- [ ] Write fake-Supabase tests that assert filters, ordering, and authenticated `user.id` assignment on inserts/updates.
- [ ] Run and verify failure.
- [ ] Implement minimal modules; never accept `user_id` from request/form input.
- [ ] Normalize empty optional strings to `null`.
- [ ] Run tests and commit.

---

### Task 3: Implement birthday validation and Coming Up calculations

**Files:**
- Create: `src/domain/birthdays.js`
- Create: `test/birthdays.test.js`

**Interfaces:**
- `validateBirthdayParts({ month, day, year })` -> normalized values or throws a safe validation error.
- `getNextBirthday(person, today)` -> `{ date, daysAway, ageTurning }`, with null `ageTurning` when `birth_year` is null.
- `getUpcomingBirthdays(people, today, days=90)` -> sorted array.

- [ ] Add tests for normal dates, year rollover, unknown year, leap-day birthdays, invalid day/month combinations, and stable sort by days-away/name.
- [ ] Run and verify failure.
- [ ] Implement Gregorian date validation without third-party date libraries.
- [ ] For Feb 29 in non-leap years, treat the upcoming birthday as Feb 28 for display/Coming Up calculation while preserving stored month/day as 2/29.
- [ ] Run tests and commit.

---

### Task 4: Add safe form parsing and same-origin mutation protection

**Files:**
- Create: `src/http/forms.js`
- Create: `test/forms.test.js`

**Interfaces:**
- `readForm(req, { maxBytes=16384 })` -> `URLSearchParams`.
- `isSameOriginRequest(req, config)` -> boolean.

- [ ] Test URL-encoded parsing, maximum body size, unsupported content type, malformed body handling, and exact Origin/Referer checks against `config.siteUrl`.
- [ ] Implement with built-in streams only.
- [ ] POST mutations reject cross-origin requests with 403 before database writes.
- [ ] Run tests and commit.

---

### Task 5: Build People list/create/edit server-rendered pages

**Files:**
- Create: `src/pages/people.js`
- Create: `test/people-pages.test.js`

**Interfaces:**
- `renderPeoplePage({ people, upcoming, flash })` -> complete HTML.
- `renderPersonFormPage({ person, mode, error })` -> complete HTML.

- [ ] Write page tests for list rows, unknown-year birthday rendering, age/milestone rendering when year exists, active/inactive status, HTML escaping, and form field persistence after validation errors.
- [ ] Verify pages include preston.ai logo/PWA metadata, link back to `/`, and never expose owner email.
- [ ] Implement mobile-first cards rather than dense tables.
- [ ] Include actions: Add person, Edit, Activate/Deactivate, Delete with explicit confirmation copy.
- [ ] Run tests and commit.

---

### Task 6: Add authenticated People CRUD routes

**Files:**
- Create: `src/routes/people.js`
- Modify: `src/app.js`
- Create: `test/people-routes.test.js`

**Interfaces:**
- `handlePeopleRoute(req, res, context)` -> handled boolean.
- Handles `GET /people`, `GET /people/new`, `POST /people`, `GET /people/:id/edit`, `POST /people/:id`, `POST /people/:id/delete`.

- [ ] Write route tests proving every route requires owner auth.
- [ ] Test valid create/update/delete, validation rerender, nonexistent IDs -> 404, and cross-origin POST -> 403.
- [ ] Owner check uses existing `getAuthorizedOwner`; never trust form `user_id`.
- [ ] Successful mutations redirect to `/people` with generic flags such as `?saved=1` rather than private values in URLs.
- [ ] Private HTML responses set `Cache-Control: private, no-store`.
- [ ] Wire route before site 404 in `src/app.js`.
- [ ] Run tests and commit.

---

### Task 7: Add Coming Up birthdays to authenticated home

**Files:**
- Modify: `src/pages/home.js`
- Modify: `src/routes/site.js`
- Modify: `test/pages.test.js`
- Modify: `test/routes.test.js`

**Interfaces:**
- `renderHomePage({ user, upcomingBirthdays=[] })`.
- `/` loads active people after owner authorization and calculates upcoming birthdays for the next 90 days.

- [ ] Add failing tests proving anonymous home still contains no People/Birthday data or labels.
- [ ] Add authenticated tests for next birthday, next five birthdays, unknown-year rendering, and `/people` deep-link.
- [ ] Fetch people only after `getAuthorizedOwner` succeeds.
- [ ] Homepage shows a concise `Coming Up` birthday card and no Life Admin/tasks/trips placeholders yet.
- [ ] Database read failure keeps home usable with a generic unavailable state and never leaks raw error text.
- [ ] Run tests and commit.

---

### Task 8: Bump to v0.6.0 and extend release verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/branding.js`
- Modify: `test/smoke.test.js`
- Modify: `test.js`
- Modify: `.github/workflows/ci.yml` only if branch-name coverage requires it.

**Interfaces:**
- Visible and package version exactly `0.6.0`.
- `npm test` includes all v0.6.0 test files.

- [ ] Update package/lockfile/branding release marker together.
- [ ] Extend smoke tests to require `/people` support and Coming Up markup only in authenticated home.
- [ ] Ensure anonymous login HTML still contains none of: People names, birthdays, Coming Up, dashboard app links, Railway URLs.
- [ ] Run `npm ci`, full `npm test`, and `node --check server.js` in GitHub Actions on the v0.6.0 branch.
- [ ] Commit.

---

### Task 9: End-to-end database and security verification

**Files:**
- No code unless verification exposes a tested defect.

- [ ] Query RLS/policy metadata and verify both tables have RLS enabled and complete owner policies.
- [ ] Verify security advisors after migration.
- [ ] Confirm no `service_role` key exists in repository or Railway variables.
- [ ] Verify owner People records can round-trip with known and unknown birth years.
- [ ] Verify anonymous requests cannot obtain People data from preston.ai routes or Supabase Data API.
- [ ] Verify `parks.preston.run` remains public and unchanged.
- [ ] Remove only verification records created during this task.
- [ ] Do not merge/deploy without explicit user approval.

## Self-review checklist

- v0.6.0 implements only private data foundation + People/Birthdays + Coming Up.
- `birth_year` is nullable throughout schema, validation, data access, and display.
- RLS is owner-scoped for SELECT/INSERT/UPDATE/DELETE; UPDATE has `using` + `with check`.
- No form can choose or alter `user_id`.
- Anonymous HTML remains minimal and private-data-free.
- All mutations are authenticated and same-origin checked.
- People pages are mobile-friendly and server-rendered.
- Homepage only queries private data after owner verification.
- No Gmail, task, trip, push, reminder, or fake Morning Digest data is added.
- Version is consistently `0.6.0`.
