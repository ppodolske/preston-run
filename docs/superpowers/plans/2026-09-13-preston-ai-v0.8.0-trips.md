# preston.ai v0.8.0 Trips, Segments & Bookings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first-class Trips module: owner-scoped trips, ordered multi-city segments, manual bookings, a lightweight generated itinerary, task-to-trip linking, and upcoming-trip context on the authenticated homepage.

**Architecture:** Extend the v0.7.0 private Supabase model with `trips`, `trip_segments`, and `bookings`. Trips own segments/bookings; cross-owner references use composite foreign keys. Segment/booking local travel times are entered with an explicit IANA time zone and converted to UTC for storage while preserving the time-zone name for correct display. The itinerary is generated only from stored segments/bookings—never invented sightseeing or placeholder activities.

**Tech Stack:** Node.js >=20, built-in `http`, `@supabase/supabase-js` 2.109.0, `@supabase/ssr` 0.10.3, Supabase Postgres/RLS, vanilla HTML/CSS, Node assert-based tests.

**Spec:** `docs/superpowers/specs/2026-09-13-life-admin-design.md`

## Global Constraints

- Canonical URL remains `https://preston.run`; product name remains `preston.ai`.
- `parks.preston.run` remains public and independent.
- All Trip/booking data is owner-authenticated and served with `Cache-Control: private, no-store`.
- All exposed private tables have RLS plus CRUD-only authenticated grants and no `anon` grants.
- No service-role key is introduced.
- Manual edits are authoritative in v0.8.0. Gmail discovery/version reconciliation begins only in v0.10+.
- Trip statuses: `planning`, `upcoming`, `in_progress`, `completed`, `cancelled`.
- Segment types: `travel`, `stay`, `activity`, `other`.
- Booking types: `flight`, `accommodation`, `hire_car`, `activity`, `other`.
- Booking statuses: `confirmed`, `tentative`, `changed`, `cancelled`.
- `trip_segments.position` and `bookings.position` are positive integers used as stable manual ordering fallbacks.
- Operational timestamps use `timestamptz`; each segment/booking stores the explicit IANA `time_zone` used to enter/display local time.
- A booking linked to a segment must belong to the same trip and user at the database level.
- Deleting a trip cascades its contained segments/bookings. Tasks linked to a trip are not silently deleted: the task link uses `NO ACTION` and must be cleared first.
- Deleting a segment with linked bookings is blocked until bookings are reassigned/unlinked.
- v0.8.0 does not create `gmail_sources`, automatic booking grouping, trip-change detection, notifications, or inferred sightseeing.
- Target release version is exactly `0.8.0`.

---

## Planned file structure

```text
supabase/migrations/<version>_v080_trips_bookings.sql
supabase/migrations/<version>_v080_restrict_trip_privileges.sql
src/data/trips.js
src/data/bookings.js
src/domain/trips.js
src/pages/trips.js
src/routes/trips.js
src/pages/home.js
src/routes/site.js
src/app.js
src/branding.js
package.json
package-lock.json
test/trips-migration.test.js
test/trips-domain.test.js
test/trips-data.test.js
test/trips-pages.test.js
test/trips-routes.test.js
test/pages.test.js
test/smoke.test.js
test.js
```

---

### Task 1: Add Trips, segments, bookings, and task-trip linkage schema

**Files:**
- Create: `test/trips-migration.test.js`
- Create after apply: `supabase/migrations/<version>_v080_trips_bookings.sql`
- Create after hardening: `supabase/migrations/<version>_v080_restrict_trip_privileges.sql`

**Required schema:**

```sql
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  status text not null default 'planning' check (status in ('planning','upcoming','in_progress','completed','cancelled')),
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (start_date is null or end_date is null or end_date >= start_date)
);

create table public.trip_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null,
  position integer not null default 1 check (position > 0),
  segment_type text not null default 'travel' check (segment_type in ('travel','stay','activity','other')),
  title text not null check (char_length(btrim(title)) between 1 and 240),
  origin text,
  destination text,
  starts_at timestamptz,
  ends_at timestamptz,
  time_zone text not null default 'Australia/Sydney',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, trip_id, user_id),
  foreign key (trip_id, user_id) references public.trips(id, user_id) on delete cascade,
  check (starts_at is null or ends_at is null or ends_at >= starts_at)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null,
  segment_id uuid,
  position integer not null default 1 check (position > 0),
  booking_type text not null check (booking_type in ('flight','accommodation','hire_car','activity','other')),
  title text not null check (char_length(btrim(title)) between 1 and 240),
  provider text,
  confirmation_reference text,
  status text not null default 'confirmed' check (status in ('confirmed','tentative','changed','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  time_zone text not null default 'Australia/Sydney',
  location text,
  booking_url text,
  notes text,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (trip_id, user_id) references public.trips(id, user_id) on delete cascade,
  foreign key (segment_id, trip_id, user_id) references public.trip_segments(id, trip_id, user_id),
  check (starts_at is null or ends_at is null or ends_at >= starts_at)
);

alter table public.tasks add column linked_trip_id uuid;
alter table public.tasks add constraint tasks_linked_trip_owner_fkey
  foreign key (linked_trip_id, user_id) references public.trips(id, user_id);
```

- [ ] Write migration contract tests before creating migrations.
- [ ] Add owner/date/status indexes for trips plus `(user_id,trip_id,position)` indexes for segments/bookings.
- [ ] Enable RLS and owner SELECT/INSERT/UPDATE/DELETE policies on all three new tables.
- [ ] Apply `v080_trips_bookings`, capture its real Supabase migration version, and commit exact SQL.
- [ ] Apply `v080_restrict_trip_privileges` to revoke all from `anon`/`authenticated` then grant CRUD only to `authenticated` for the three new tables; commit exact SQL.
- [ ] Run Supabase security advisors and query live RLS/policies/grants/FKs.
- [ ] Commit.

---

### Task 2: Add time-zone-safe Trip domain and itinerary generation

**Files:**
- Create: `src/domain/trips.js`
- Create: `test/trips-domain.test.js`

**Interfaces:**
- `validateTripInput(input)`.
- `validateSegmentInput(input)`.
- `validateBookingInput(input)`.
- `isValidTimeZone(zone)`.
- `localDateTimeToUtc(value, zone)` converts HTML `datetime-local` to ISO UTC, validating round-trip local fields.
- `utcToLocalDateTime(value, zone)` returns HTML `datetime-local` value.
- `buildItinerary({ segments, bookings })` returns ordered entries.
- `getUpcomingTrips(trips, today, days=180)`.

**Itinerary rule:**
- Every booking is an itinerary entry.
- A segment with one or more linked bookings is represented by those booking entries rather than duplicated as a second top-level entry.
- An unbooked segment remains an itinerary entry.
- Sort dated entries by `starts_at`; break ties with `position`, then title. Undated entries follow dated entries by `position`.
- Never synthesize unrecorded activities.

- [ ] Test Sydney, Chicago, and daylight-saving conversions; invalid IANA zones; invalid/end-before-start inputs; multi-city trip date validation; linked/unlinked itinerary suppression; cancelled bookings remaining visible but clearly status-marked; ordering; upcoming-trip filtering.
- [ ] Run tests and commit.

---

### Task 3: Add owner-scoped Trip/booking data modules

**Files:**
- Create: `src/data/trips.js`
- Create: `src/data/bookings.js`
- Create: `test/trips-data.test.js`

**Interfaces:**
- Trips: list/get/create/update/delete.
- Segments: list/get/create/update/delete.
- Bookings: list/get/create/update/delete.
- Creates/updates receive authenticated user; `user_id` never comes from form data.
- Manual bookings stamp `source_metadata={source:'manual'}` server-side.

- [ ] Fake-Supabase tests prove owner filters, trip/segment linking, ordering, null normalization, and provenance control.
- [ ] Run tests and commit.

---

### Task 4: Build mobile-first Trips and itinerary pages

**Files:**
- Create: `src/pages/trips.js`
- Create: `test/trips-pages.test.js`

**Interfaces:**
- `renderTripsPage({ trips, upcoming, flash })`.
- `renderTripDetailPage({ trip, segments, bookings, itinerary, tasks })`.
- `renderTripFormPage({ trip, mode, error })`.
- `renderSegmentFormPage({ segment, trip, mode, error })`.
- `renderBookingFormPage({ booking, trip, segments, mode, error })`.

- [ ] Trip list shows dates/status and upcoming order.
- [ ] Detail page shows lightweight itinerary, bookings, segments, linked tasks, and activity-free empty states.
- [ ] Forms preserve local times in their stored `time_zone`.
- [ ] Manual booking fields include provider, confirmation reference, status, location, booking URL, and optional segment assignment.
- [ ] Include explicit delete controls with confirmation for trip/segment/booking routes.
- [ ] HTML escape all user values and never expose owner email.
- [ ] Run tests and commit.

---

### Task 5: Add authenticated Trip CRUD routes

**Files:**
- Create: `src/routes/trips.js`
- Modify: `src/app.js`
- Create: `test/trips-routes.test.js`

**Routes:**
- Trips: `GET /trips`, `GET /trips/new`, `POST /trips`, `GET /trips/:id`, `GET /trips/:id/edit`, `POST /trips/:id`, `POST /trips/:id/delete`.
- Segments: `GET /trips/:tripId/segments/new`, `POST /trips/:tripId/segments`, `GET /segments/:id/edit`, `POST /segments/:id`, `POST /segments/:id/delete`.
- Bookings: `GET /trips/:tripId/bookings/new`, `POST /trips/:tripId/bookings`, `GET /bookings/:id/edit`, `POST /bookings/:id`, `POST /bookings/:id/delete`.

- [ ] Every route requires owner auth and every POST requires same-origin protection.
- [ ] Validate parent trip and optional segment through owner-scoped reads before writes.
- [ ] A booking segment must belong to the selected trip.
- [ ] Missing records return 404; invalid form input rerenders safely; DB errors stay generic.
- [ ] Trip deletion with linked tasks returns 409 with safe guidance instead of silently deleting tasks.
- [ ] Segment deletion with linked bookings returns 409 until reassigned/unlinked.
- [ ] Wire before site 404.
- [ ] Run tests and commit.

---

### Task 6: Add Trips to authenticated home and task forms

**Files:**
- Modify: `src/routes/site.js`
- Modify: `src/pages/home.js`
- Modify: `src/routes/life-admin.js`
- Modify: `src/pages/life-admin.js`
- Modify relevant tests.

- [ ] Load Trips only after owner authorization; independent failure must not break birthdays/Life Admin/apps/weather.
- [ ] Add an authenticated Coming Up Trips card with next trips and `/trips/:id` deep links; no fake trip data.
- [ ] Task create/edit forms gain an optional Trip selector now that Trips exist.
- [ ] Task linked-trip selection is validated owner-side before write.
- [ ] Login HTML remains free of Trip labels/names/URLs.
- [ ] Run tests and commit.

---

### Task 7: Bump to v0.8.0 and full CI verification

**Files:**
- Modify: `package.json`, `package-lock.json`, `src/branding.js`, `test.js`, `test/smoke.test.js`, `.github/workflows/ci.yml`.

- [ ] Set visible/package/lockfile version to exactly `0.8.0`.
- [ ] Add all v0.8 test files to the suite and add `build/preston-ai-v0.8.0` CI trigger.
- [ ] Smoke tests require private Trips routes and confirm anonymous login remains minimal.
- [ ] Run Node 20 + `npm ci` + all tests + `node --check server.js` in GitHub Actions.
- [ ] Commit.

---

### Task 8: Live security and boundary verification

- [ ] Verify RLS/policies/CRUD-only grants/composite FKs live in Supabase.
- [ ] Verify `anon` has no SELECT privilege on trip tables.
- [ ] Run Supabase security advisors and resolve findings.
- [ ] Confirm no service-role key in repository/Railway.
- [ ] If an owner session exists, perform and clean up a manual trip + segment + booking + linked task round trip. If not, defer browser E2E rather than bypassing auth.
- [ ] Confirm `parks.preston.run` remains public and unchanged.
- [ ] Do not merge/deploy without explicit user approval.

## Self-review checklist

- Trips, segments, bookings are first-class and owner-scoped.
- Multi-city/manual booking model works without Gmail.
- Time zones are explicit; local operational times round-trip correctly.
- Booking-to-segment relation cannot cross trips/users.
- Itinerary contains only stored data and avoids duplicate linked segments.
- Trip cascades remove contained segments/bookings, but linked tasks block deletion until explicitly unlinked.
- Task forms now support optional Trip linkage.
- Anonymous responses never contain private Trip data.
- No Gmail automation/change detection/reminders are implemented early.
- Version is consistently `0.8.0`.
