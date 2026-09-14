# preston.ai v0.13.0 Trip / Booking / Event Linkage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace confirmation-email-created trip shells with a booking/event-first travel model, allow any booking or event to link to a trip, give trips structured destination geography, and provide a safe targeted path to reconstruct the existing bad Gmail-derived trip data.

**Architecture:** Preserve the existing `trips`, `bookings`, `trip_segments`, and `life_items` domains but reverse the current Gmail dependency: Gmail creates or updates a canonical Booking or Life Admin Event first, then a separate trip-linking decision may attach that object to an existing trip, create a high-confidence geography/date-derived trip, or leave the object unlinked for review. Bookings become independently addressable, Life Admin events gain trip/detail fields, trips gain structured destination fields, and Gmail source-to-booking provenance is normalized through a small `booking_source_links` table. Manual user edits always outrank Gmail automation.

**Tech Stack:** Node.js 22/CommonJS, native Node `assert` tests, existing server-rendered preston.ai route/page architecture, Supabase/PostgreSQL with RLS, Gmail REST API `format=full`, existing Gmail source/fact/activity tables, Railway production deployment.

**Spec:** `docs/superpowers/specs/2026-09-14-trip-booking-linkage-design.md`

## Global Constraints

- Product name remains `preston.ai` in touched UI copy.
- Target release is **v0.13.0**.
- Start implementation from the approved design commit on `design/trip-booking-linkage-v0130`; implementation should occur on a separate feature branch such as `feature/trip-booking-linkage-v0130`.
- Use test-driven development. Each task starts with a failing focused test, then the minimum implementation, then focused + full-suite verification.
- Do not weaken existing owner-scoped RLS or composite ownership foreign-key patterns.
- Before writing any Supabase migration, fetch the current Supabase changelog/relevant docs and inspect the installed CLI help. Create migrations with `supabase migration new ...`; never hand-invent a timestamped migration filename.
- The schema migration must be backward-compatible with v0.12.4 while application code rolls out: additive columns/table plus dropping the `bookings.trip_id` NOT NULL restriction are allowed; no destructive data rewrite belongs in the release migration.
- Gmail remains read-only. This release must not request write/modify/send Gmail scopes.
- Do **not** rerun the 523-message historical backfill.
- Do **not** delete the existing 28 Gmail-created trip shells during implementation, migration, deployment, reconstruction dry-run, or reconstruction apply. Their deletion requires a later explicit user approval after the mapping report is reviewed.
- Never delete or rewrite the manually created `ANZ` trip as part of historical repair.
- Existing manual trip title, dates, destination geography, booking trip assignment, event trip assignment, and notes are authoritative.
- A confirmation/reference value must never become a trip title or trip destination.
- Weak or ambiguous evidence must produce an unlinked booking/event or review item, never a placeholder trip.
- New automated trips are allowed only from strong destination **and** date evidence. A single weak one-way confirmation, reminder, or activity is not sufficient.
- Existing processed Gmail source records remain audit evidence; do not delete the source emails or source records.
- Historical reconstruction must be source-scoped to the Gmail records responsible for the legacy shells.
- No production cleanup transaction is run until the user explicitly approves the exact shell mapping.

---

## Locked Implementation Decisions

### Booking provenance

Add a normalized many-to-many table `booking_source_links` rather than storing an ever-growing array of Gmail messages in `bookings.source_metadata`.

The table links a canonical booking to one or more `gmail_source_records`. It must allow one source to link to more than one booking if a future itinerary contains multiple reservations, so uniqueness is on `(user_id, booking_id, source_record_id)`, not source record alone.

`bookings.source_metadata` remains useful for canonical extraction metadata such as `source`, `manual_fields`, extractor version/confidence, and structured geography evidence; the source-link table is the authoritative source-message mapping.

### Manual authority

- Manual trip creation sets `automation_managed=false`.
- Gmail-created trips set `automation_managed=true`.
- A manual trip edit sets `automation_managed=false`, after which Gmail must not change trip title, dates, or destination geography automatically.
- Manual booking create/edit records `manual_fields` in `source_metadata`. Gmail updates may fill missing non-manual fields but cannot overwrite fields marked manual.
- Manual Life Admin edits similarly merge `manual_fields` into existing `source_metadata`; Gmail event enrichment/linking must honor them.

### Independent booking UI

Create a dedicated `/bookings` route/page rather than making unlinked bookings live invisibly under Trips. Preserve the existing nested add-booking URL as a convenience that preselects a trip.

### Travel extraction input

Use the complete Gmail message body, not only `message.snippet`. Decode MIME `text/plain`; fall back to sanitized `text/html`; include the snippet only as fallback/context. Extract native PDF text as additional evidence before producing the booking candidate.

### New-trip safety threshold

Automatic new-trip creation is limited to candidates with both strong geography and strong travel dates, for example:

- dated accommodation with explicit property city/region/country; or
- a clearly parsed round-trip itinerary with destination and outbound/return dates; or
- an already coherent cluster of at least two unlinked travel bookings with overlapping/contiguous dates and compatible geography.

Other travel bookings remain unlinked or go to review until a trip exists or the user links them.

### Existing-trip matching

Manual trips are considered before generated trips. Date containment/overlap is necessary but geography conflict blocks auto-linking. If an existing manual trip has no structured destination, date-only evidence may produce a **review recommendation** but is not by itself enough to silently link an event or booking. This means the Qantas 18 Dec 2026 booking can be proposed for `ANZ` without deriving geography from the `ANZ` title.

---

## File Structure and Responsibilities

### Create

- `src/domain/date-time.js` — shared time-zone validation and local↔UTC conversion currently embedded in Trips.
- `src/domain/gmail-booking-extractor.js` — booking candidate extraction, provider-aware parsing, conservative fallback, candidate-to-facts conversion.
- `src/domain/trip-linker.js` — pure trip-link/create/review scoring from booking/event geography and dates.
- `src/data/booking-sources.js` — booking↔Gmail source links and booking identity lookup helpers.
- `src/services/gmail-booking-actions.js` — Gmail booking upsert, source-link persistence, manual-field-aware update, activity logging, and trip-link application.
- `src/routes/bookings.js` — independent booking list/create/edit/delete/link routes plus nested trip-prefill compatibility.
- `src/pages/bookings.js` — booking list and editor UI.
- `src/services/gmail-trip-reconstruction.js` — targeted legacy-shell source discovery, reconstruction mapping, and apply-without-delete behavior.
- `src/jobs/gmail-trip-reconstruction.js` — guarded CLI entry point; dry-run default.
- `test/trip-booking-linkage-migration.test.js`
- `test/date-time.test.js`
- `test/booking-sources-data.test.js`
- `test/bookings-pages.test.js`
- `test/bookings-routes.test.js`
- `test/gmail-booking-extractor.test.js`
- `test/trip-linker.test.js`
- `test/gmail-booking-actions.test.js`
- `test/gmail-trip-reconstruction.test.js`

### Modify

- Supabase migration files generated during Task 1.
- `src/domain/trips.js`
- `src/domain/life-admin.js`
- `src/domain/gmail-normalize.js`
- `src/domain/gmail-life-admin-extractor.js`
- `src/data/bookings.js`
- `src/data/trips.js`
- `src/data/life-admin.js`
- `src/services/gmail-scan-runner.js`
- `src/services/gmail-manual-scan.js`
- `src/services/gmail-life-admin-actions.js`
- `src/routes/trips.js`
- `src/routes/life-admin.js`
- `src/pages/trips.js`
- `src/pages/life-admin.js`
- `src/app.js`
- existing Trips/Life Admin/Gmail tests
- `test.js`
- `package.json`
- `package-lock.json`
- `.github/workflows/ci.yml` only if new source files need explicit syntax checks beyond `npm test`.

### Retire after replacement tests pass

- `src/domain/gmail-trip-extractor.js`
- `src/domain/gmail-trip-matcher.js`
- `src/services/gmail-trip-actions.js`
- their old tests if no other imports remain.
- `src/domain/gmail-decisions.js` only if a repository-wide import search proves it is no longer used.

Do not delete these files early. Remove them only after the booking-first scan path passes focused and full-suite tests.

---

### Task 1: Schema foundation for independent bookings, linked events, destination-aware trips, and booking source links

**Files:**
- Create via CLI: Supabase migration `v0130_trip_booking_event_linkage`
- Create via CLI if privilege hardening is kept separate: Supabase migration `v0130_restrict_booking_source_privileges`
- Create: `test/trip-booking-linkage-migration.test.js`
- Modify: `test.js`

- [ ] **Step 1: Refresh Supabase implementation guidance before DDL**

Read the current Supabase changelog and relevant docs for PostgreSQL migrations, RLS, and constraints. Run the installed Supabase CLI help commands before using it:

```bash
supabase --help
supabase migration --help
supabase migration new --help
```

Do not assume CLI syntax from memory.

- [ ] **Step 2: Write a failing migration contract test**

Create `test/trip-booking-linkage-migration.test.js` that locates the generated v0.13 migration by suffix/name and asserts all of these contracts:

- `bookings.trip_id` is nullable.
- `bookings` has `origin` and `destination`.
- booking type constraint includes `transport` while retaining existing values.
- `bookings` has a unique `(id,user_id)` constraint for owner-safe source-link FKs.
- `segment_id is null or trip_id is not null` check exists.
- trips have `destination_label`, `destination_city`, `destination_region`, `destination_country`, `automation_managed`.
- life items have `linked_trip_id`, `ends_at`, `time_zone`, `location`, `provider`, `confirmation_reference`, `booking_url`.
- Life Admin trip FK uses `(linked_trip_id,user_id) -> trips(id,user_id)`.
- Gmail source records have unique `(id,user_id)` if required by the owner-safe source-link FK.
- `booking_source_links` exists with owner-safe FKs to both bookings and Gmail source records.
- `booking_source_links` has unique `(user_id,booking_id,source_record_id)` plus useful source/booking indexes.
- RLS is enabled on `booking_source_links` and owner policies use `auth.uid() = user_id`.
- anon has no access; authenticated access is explicitly granted only as needed.

Register the test in `test.js` next to Trips/Gmail migration tests.

- [ ] **Step 3: Verify red**

```bash
node test/trip-booking-linkage-migration.test.js
```

Expected: FAIL because the v0.13 migration does not yet exist.

- [ ] **Step 4: Create migration(s) with the CLI**

Run the CLI command discovered in Step 1, equivalent to:

```bash
supabase migration new v0130_trip_booking_event_linkage
```

Use the exact generated path from the command output. If privilege hardening is clearer as a second migration, create it the same way; do not manually make up a timestamp.

- [ ] **Step 5: Implement backward-compatible DDL**

Migration behavior:

```sql
-- trips
alter table public.trips add column destination_label text;
alter table public.trips add column destination_city text;
alter table public.trips add column destination_region text;
alter table public.trips add column destination_country text;
alter table public.trips add column automation_managed boolean not null default false;

-- bookings
alter table public.bookings alter column trip_id drop not null;
alter table public.bookings add column origin text;
alter table public.bookings add column destination text;
-- add unique(id,user_id) if not already present
-- replace booking_type check to include transport
-- add check (segment_id is null or trip_id is not null)

-- life_items
alter table public.life_items add column linked_trip_id uuid;
alter table public.life_items add column ends_at timestamptz;
alter table public.life_items add column time_zone text;
alter table public.life_items add column location text;
alter table public.life_items add column provider text;
alter table public.life_items add column confirmation_reference text;
alter table public.life_items add column booking_url text;
-- add owner-safe FK linked_trip_id + user_id -> trips
```

Add indexes for user/unlinked booking dates, user/trip booking dates, provider/reference lookup, life item linked trip/date, and trip destination/date matching.

Create `booking_source_links` with:

```text
id uuid PK
user_id uuid NOT NULL
booking_id uuid NOT NULL
source_record_id uuid NOT NULL
created_at timestamptz NOT NULL default now()
unique(user_id,booking_id,source_record_id)
FK (booking_id,user_id) -> bookings(id,user_id) ON DELETE CASCADE
FK (source_record_id,user_id) -> gmail_source_records(id,user_id) ON DELETE CASCADE
RLS owner policies
```

Do not mutate existing trip rows or delete legacy shells in this migration.

- [ ] **Step 6: Verify migration contract and full suite**

```bash
node test/trip-booking-linkage-migration.test.js
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations test/trip-booking-linkage-migration.test.js test.js
git commit -m "feat: add v0.13 trip booking linkage schema"
```

---

### Task 2: Shared date/time primitives and domain validation

**Files:**
- Create: `src/domain/date-time.js`
- Create: `test/date-time.test.js`
- Modify: `src/domain/trips.js`
- Modify: `src/domain/life-admin.js`
- Modify: `test/trips-domain.test.js`
- Modify: `test/life-admin-domain.test.js`
- Modify: `test.js`

- [ ] **Step 1: Write failing tests for shared local-time behavior**

Cover:

- valid IANA time zones;
- `datetime-local` → UTC conversion;
- UTC → local form value round-trip;
- DST-invalid local times reject;
- date-only Life Admin inputs remain accepted;
- event `starts_at`/`ends_at` accept local datetime + `time_zone`;
- end before start rejects;
- booking `trip_id` may be null;
- booking with no trip forces/validates `segment_id=null` at the application boundary;
- booking validates `origin`, `destination`, and `transport` type;
- trip validates destination label/city/region/country.

- [ ] **Step 2: Verify red**

```bash
node test/date-time.test.js
node test/trips-domain.test.js
node test/life-admin-domain.test.js
```

- [ ] **Step 3: Extract time helpers from Trips**

Move `isValidTimeZone`, `localDateTimeToUtc`, `utcToLocalDateTime`, and private supporting helpers into `src/domain/date-time.js`. Re-export from `src/domain/trips.js` temporarily if existing callers/tests rely on those exports, then update direct callers in the same task.

- [ ] **Step 4: Extend validation contracts**

`validateTripInput()` returns:

```js
{
  title, status, start_date, end_date,
  destination_label,
  destination_city,
  destination_region,
  destination_country,
  notes
}
```

`validateBookingInput()` returns optional `trip_id`, optional `segment_id`, `origin`, `destination`, and all current booking fields. If `trip_id` is null, normalize `segment_id` to null.

`validateLifeItemInput()` adds `linked_trip_id`, `ends_at`, `time_zone`, `location`, `provider`, `confirmation_reference`, `booking_url`. Keep `due_at` backward-compatible with the existing date-only behavior. Allow `starts_at` to accept the existing date-only representation or an event datetime representation; normalize event datetimes through `time_zone` rather than assuming Sydney UTC offsets.

- [ ] **Step 5: Verify**

```bash
node test/date-time.test.js
node test/trips-domain.test.js
node test/life-admin-domain.test.js
npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/domain test/date-time.test.js test/trips-domain.test.js test/life-admin-domain.test.js test.js
git commit -m "refactor: share trip and event time validation"
```

---

### Task 3: Data access, source identity, and manual-authority semantics

**Files:**
- Create: `src/data/booking-sources.js`
- Create: `test/booking-sources-data.test.js`
- Modify: `src/data/bookings.js`
- Modify: `src/data/trips.js`
- Modify: `src/data/life-admin.js`
- Modify: `test/trips-data.test.js`
- Modify: `test/life-admin-data.test.js`
- Modify: `test.js`

- [ ] **Step 1: Write failing data-layer tests**

Require these behaviors:

- `listBookings(supabase,user,{tripId})` supports a trip filter without requiring one.
- `listBookings(...,{unlinked:true})` emits `.is('trip_id',null)`.
- `createBooking(supabase,user,input)` accepts `trip_id:null` and sets manual source metadata.
- manual booking create/edit records `manual_fields` for all editable values supplied by the form.
- unlinked booking payload clears `segment_id`.
- moving a booking can update `trip_id` and clears segment unless a destination-trip segment is explicitly validated.
- Gmail update helper preserves manual fields and only fills/updates automation-owned fields.
- `tripPayload` includes structured destination fields.
- manual `createTrip`/`updateTrip` leaves or sets `automation_managed=false`.
- a separate generated-trip helper sets `automation_managed=true`.
- Life Admin payload persists new event fields and `linked_trip_id`.
- manual Life Admin edit merges `manual_fields` instead of destroying Gmail provenance.
- source-link create is owner-scoped and idempotent.
- source lookup may return multiple bookings for one Gmail source; provider/reference identity resolves the canonical booking when possible.

- [ ] **Step 2: Verify red**

```bash
node test/trips-data.test.js
node test/life-admin-data.test.js
node test/booking-sources-data.test.js
```

- [ ] **Step 3: Refactor `src/data/bookings.js`**

Adopt a single booking input shape containing optional `trip_id` rather than passing trip ID as a separate required positional argument.

Expose focused helpers such as:

```js
listBookings(supabase,user,filters={})
getBooking(supabase,user,id)
createBooking(supabase,user,input)
updateBooking(supabase,user,id,input,{manual=true}={})
updateBookingFromGmail(supabase,user,id,patch,metadata)
findBookingsByReference(supabase,user,confirmationReference)
deleteBooking(...)
```

Preserve existing source metadata when updating. Do not allow client form values to replace arbitrary `source_metadata`.

- [ ] **Step 4: Implement `src/data/booking-sources.js`**

Expose:

```js
linkBookingSource(supabase,user,bookingId,sourceRecordId)
listBookingSources(supabase,user,bookingId)
listBookingsForSource(supabase,user,sourceRecordId)
findCanonicalBookingForGmailCandidate(supabase,user,candidate,source)
```

Resolution order:

1. already-linked source + matching candidate;
2. canonical provider + normalized confirmation reference;
3. provider booking URL/identifier when present;
4. Gmail thread only when it resolves unambiguously to one booking;
5. no match.

Normalization is application-side and conservative. Do not invent a confirmation reference to make identity work.

- [ ] **Step 5: Extend Trips and Life Admin data modules**

Add generated-trip create/update helpers with automation guard. Add `listLifeItemsByTrip(supabase,user,tripId)` owner-scoped rather than filtering an unscoped full list in route code.

- [ ] **Step 6: Verify**

```bash
node test/booking-sources-data.test.js
node test/trips-data.test.js
node test/life-admin-data.test.js
npm test
```

- [ ] **Step 7: Commit**

```bash
git add src/data test/booking-sources-data.test.js test/trips-data.test.js test/life-admin-data.test.js test.js
git commit -m "feat: support unlinked bookings and manual authority"
```

---

### Task 4: Independent booking UI and route split

**Files:**
- Create: `src/pages/bookings.js`
- Create: `src/routes/bookings.js`
- Create: `test/bookings-pages.test.js`
- Create: `test/bookings-routes.test.js`
- Modify: `src/pages/trips.js`
- Modify: `src/routes/trips.js`
- Modify: `src/app.js`
- Modify: `test/trips-pages.test.js`
- Modify: `test/trips-routes.test.js`
- Modify: `test/routes.test.js`
- Modify: `test.js`

- [ ] **Step 1: Write failing page tests**

Require:

- `/bookings` page visibly distinguishes unlinked bookings and linked bookings.
- unlinked booking card offers Edit and a clear trip-link state.
- booking form has `Trip` selector with `No trip`.
- booking form has origin + destination + location.
- Gmail-origin booking exposes `Open source email` when source links exist.
- nested add-booking preselection displays the chosen trip.
- Trips page provides a visible `All bookings`/unlinked-bookings entry point.

- [ ] **Step 2: Write failing route tests**

Cover:

```text
GET  /bookings
GET  /bookings/new
POST /bookings
GET  /bookings/:id/edit
POST /bookings/:id
POST /bookings/:id/delete
GET  /trips/:tripId/bookings/new   (compatibility/prefill)
```

Required behavior:

- create with no trip succeeds;
- trip ID is owner-validated when supplied;
- segment ID is validated only against the selected trip;
- changing/unlinking trip clears incompatible segment;
- deletion of an unlinked booking redirects to `/bookings`, not `/trips/null`;
- nested create redirects to the selected trip detail;
- normal create redirects to booking list.

- [ ] **Step 3: Verify red**

```bash
node test/bookings-pages.test.js
node test/bookings-routes.test.js
```

- [ ] **Step 4: Implement the booking page and route**

Keep the booking editor server-rendered. Do not add complex client-side segment fetching. If the user changes trip assignment, clear segment; a segment in the destination trip can be selected on the subsequent edit.

Call `handleBookingsRoute` before `handleTripsRoute` in `src/app.js` so nested booking compatibility URLs are captured cleanly.

- [ ] **Step 5: Remove booking CRUD responsibility from `src/routes/trips.js`**

Only after new booking route tests pass, remove the old booking create/edit/delete branches from Trips. Keep Trip detail loading/rendering bookings.

Move `renderBookingFormPage` responsibility from `src/pages/trips.js` to `src/pages/bookings.js`.

- [ ] **Step 6: Verify**

```bash
node test/bookings-pages.test.js
node test/bookings-routes.test.js
node test/trips-pages.test.js
node test/trips-routes.test.js
node test/routes.test.js
npm test
```

- [ ] **Step 7: Commit**

```bash
git add src/pages src/routes src/app.js test
git commit -m "feat: add independent booking management"
```

---

### Task 5: Trip destination editing, Life Admin event linking, and combined trip timeline

**Files:**
- Modify: `src/routes/trips.js`
- Modify: `src/pages/trips.js`
- Modify: `src/routes/life-admin.js`
- Modify: `src/pages/life-admin.js`
- Modify: `src/domain/trips.js`
- Modify: `test/trips-domain.test.js`
- Modify: `test/trips-pages.test.js`
- Modify: `test/trips-routes.test.js`
- Modify: `test/life-admin-pages.test.js`
- Modify: `test/life-admin-routes.test.js`

- [ ] **Step 1: Add failing Life Admin linkage tests**

Require the Life Admin form to expose:

- optional Trip selector;
- starts/ends + timezone;
- location;
- provider;
- confirmation reference;
- booking URL.

Require create/edit routes to owner-validate the selected trip and preserve Gmail source metadata on manual edits.

- [ ] **Step 2: Add failing Trip presentation tests**

Require:

- trip create/edit form fields for destination label/city/region/country;
- trip header shows `destination_label` separately from title and date range;
- trip detail loads linked Life Admin events;
- itinerary combines segments, bookings, and linked events chronologically;
- trip delete explicitly refuses deletion while linked booking/segment/task/Life Admin rows exist.

- [ ] **Step 3: Extend itinerary domain behavior**

Change `buildItinerary({segments,bookings,events})` to emit normalized entries without duplicating a booking already represented by its segment. Events use `starts_at` and event/location metadata for display.

- [ ] **Step 4: Implement Life Admin event fields/linking**

The Trip selector may be shown for all Life Admin items for UI simplicity, but Gmail automation only auto-links event/appointment-style items. Manually linking another Life Admin item is allowed and does not change its category.

- [ ] **Step 5: Implement Trip destination UI and detail sections**

Trip detail order:

1. Next item
2. Combined itinerary
3. Bookings
4. Events / linked Life Admin
5. Linked tasks
6. Manage trip

- [ ] **Step 6: Verify**

```bash
node test/trips-domain.test.js
node test/trips-pages.test.js
node test/trips-routes.test.js
node test/life-admin-pages.test.js
node test/life-admin-routes.test.js
npm test
```

- [ ] **Step 7: Commit**

```bash
git add src/domain/trips.js src/routes/trips.js src/pages/trips.js src/routes/life-admin.js src/pages/life-admin.js test
git commit -m "feat: link events and destination data to trips"
```

---

### Task 6: Decode full Gmail message bodies safely

**Files:**
- Modify: `src/domain/gmail-normalize.js`
- Modify: `test/gmail-normalize.test.js`
- Modify: `src/services/gmail-scan-runner.js`
- Modify: `test/gmail-scan-runner.test.js`

- [ ] **Step 1: Write failing MIME body tests**

Add fixtures for:

- direct `text/plain` body data;
- multipart body with nested `text/plain`;
- HTML-only fallback;
- base64url padding differences;
- attachment parts ignored as body text;
- snippet fallback when no body is available.

Expected helper:

```js
extractGmailMessageText(message)
```

It returns bounded plain text suitable for classification/extraction. Strip script/style tags from HTML fallback and collapse excessive whitespace; do not execute or render HTML.

- [ ] **Step 2: Verify red**

```bash
node test/gmail-normalize.test.js
```

- [ ] **Step 3: Implement and wire into scan evidence**

Replace the scan runner's use of `message.snippet` as the primary extraction text with the decoded full body. Keep snippet as fallback/context.

Refactor PDF processing so it can return extracted text fragments plus processing counts; do not force the old trip-fact extractor to remain the PDF API.

- [ ] **Step 4: Verify**

```bash
node test/gmail-normalize.test.js
node test/gmail-scan-runner.test.js
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/gmail-normalize.js src/services/gmail-scan-runner.js test/gmail-normalize.test.js test/gmail-scan-runner.test.js
git commit -m "feat: extract full gmail message text"
```

---

### Task 7: Provider-aware Gmail booking extractor

**Files:**
- Create: `src/domain/gmail-booking-extractor.js`
- Create: `test/gmail-booking-extractor.test.js`
- Modify: `test.js`

**Primary interface:**

```js
extractBookingCandidate(envelope,{parserVersion})
// -> { candidate, facts }
```

Canonical candidate shape:

```js
{
  booking_type,
  provider,
  confirmation_reference,
  title,
  status,
  starts_at,
  ends_at,
  time_zone,
  location,
  origin,
  destination,
  booking_url,
  geography:{label,city,region,country},
  confidence,
  evidence
}
```

- [ ] **Step 1: Create sanitized failing provider fixtures**

Use minimal synthetic excerpts reflecting the already observed formats, not full private email dumps. Cover at minimum:

- Qantas reference `ECECAB`, Sydney → Brisbane, 18 Dec 2026.
- Jetstar reference `QNRY8J`, outbound/inbound dates 15–22 Aug 2026.
- Booking.com `5072736754`, Belle in Bowral, Bowral NSW.
- Hertz `L5920779422` and `L661E0FC0A1` without truncation.
- FareHarbor/Cruise Te Anau booking `372492184`, 17 Aug 2026 13:00–15:00.
- Airbnb reminder that does **not** turn `REMINDER` into a reference.

Negative reference cases must explicitly reject:

```text
EMAIL
REMINDER
NUMBER
CONFIRMED
DISCOVERY
PRESTON
ERENCE
```

- [ ] **Step 2: Verify red**

```bash
node test/gmail-booking-extractor.test.js
```

- [ ] **Step 3: Implement known-provider parsers first**

Parser order:

1. Qantas
2. Jetstar
3. Booking.com
4. Airbnb
5. Hertz
6. FareHarbor/Cruise Te Anau
7. conservative generic fallback

Provider rules may use sender domain + subject/body context. Generic reference extraction requires an explicit label plus a plausible token and denylist validation; do not reuse the existing `{5,10}` loose regex.

- [ ] **Step 4: Emit booking facts for audit**

Convert structured candidate fields into `gmail_extracted_facts` using booking-oriented fact types such as:

```text
booking.identity
booking.schedule
booking.location
booking.transport
booking.status
```

Facts retain parser version/confidence/source IDs.

- [ ] **Step 5: Verify**

```bash
node test/gmail-booking-extractor.test.js
npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/domain/gmail-booking-extractor.js test/gmail-booking-extractor.test.js test.js
git commit -m "feat: add provider-aware gmail booking extraction"
```

---

### Task 8: Pure trip-linking engine with conservative auto-create rules

**Files:**
- Create: `src/domain/trip-linker.js`
- Create: `test/trip-linker.test.js`
- Modify: `test.js`

**Primary interface:**

```js
proposeTripLink({subjectType,subject,trips,relatedBookings=[]})
// -> {kind:'link'|'create'|'review'|'none',tripId:null|string,score,reasons,proposedTrip:null|object}
```

- [ ] **Step 1: Write failing matching tests**

Cover:

- exact/compatible date + geography → existing manual trip link;
- conflicting country blocks auto-link even if dates overlap;
- manual trip with dates but blank destination → review recommendation, not silent geography inference;
- generated trip with compatible dates/geography → link;
- clear dated accommodation in Bowral with no trip → create proposal titled/destined from `Bowral, NSW`, never confirmation number;
- clear round-trip Queenstown itinerary → create proposal from destination/dates;
- one-way flight with no return/stay context → review/unlinked, not create;
- isolated activity → review/unlinked;
- two compatible related bookings can justify a generated trip;
- events require stronger geographic compatibility than travel bookings when auto-linking;
- generated trip update proposal never touches a trip with `automation_managed=false`.

- [ ] **Step 2: Verify red**

```bash
node test/trip-linker.test.js
```

- [ ] **Step 3: Implement deterministic scoring**

Keep rules explainable. Return reason codes for every positive/negative component so Gmail activity and historical reports can show why a match happened.

No rule may inspect booking confirmation text to derive trip title or destination.

- [ ] **Step 4: Verify**

```bash
node test/trip-linker.test.js
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/trip-linker.js test/trip-linker.test.js test.js
git commit -m "feat: add conservative trip linkage engine"
```

---

### Task 9: Gmail booking upsert/actions and scan-runner cutover

**Files:**
- Create: `src/services/gmail-booking-actions.js`
- Create: `test/gmail-booking-actions.test.js`
- Modify: `src/services/gmail-scan-runner.js`
- Modify: `src/services/gmail-manual-scan.js`
- Modify: `test/gmail-scan-runner.test.js`
- Modify: `test/gmail-manual-scan.test.js`
- Modify: `test/gmail-scan-routing.test.js`
- Modify: `test.js`

- [ ] **Step 1: Write failing Gmail booking action tests**

Required behaviors:

- first strong travel source creates a booking, not a trip;
- source link is written after booking resolution;
- reminder/follow-up with same provider/reference updates/links the canonical booking rather than duplicates;
- thread fallback only matches when unambiguous;
- Gmail does not overwrite `manual_fields`;
- cancellation can update automation-owned booking status;
- trip-link decision `link` updates booking `trip_id` and records booking activity;
- `create` creates an `automation_managed=true` trip with geography/date-derived title/fields, then links booking;
- `review` leaves booking unlinked and creates canonical review behavior;
- Gmail activity uses `entityType:'booking'` for booking changes and `entityType:'trip'` only for actual trip changes.

- [ ] **Step 2: Verify red**

```bash
node test/gmail-booking-actions.test.js
```

- [ ] **Step 3: Implement `buildGmailBookingActions`**

Dependencies are injectable for tests. It should orchestrate existing data modules, `booking_source_links`, `trip-linker`, Gmail activity, and review creation. Do not hide matching logic inside the service; keep scoring in `src/domain/trip-linker.js`.

- [ ] **Step 4: Cut over the travel branch in `gmail-scan-runner.js`**

For `classification.intent === 'trip'` keep the existing classifier intent name for backward compatibility, but change semantics to:

1. assemble full body + PDF evidence;
2. extract structured booking candidate + facts;
3. persist facts;
4. upsert canonical booking;
5. persist booking-source link;
6. evaluate/apply trip link;
7. review when ambiguous;
8. mark source processed.

Keep `tripCount` in scan counters as the legacy name for “travel-classified source” unless a schema-safe counter rename is separately justified. Do not make the counter imply that a Trip row was created.

- [ ] **Step 5: Replace manual-scan wiring**

`src/services/gmail-manual-scan.js` should build Gmail booking actions, not `buildGmailTripActions`.

- [ ] **Step 6: Verify focused cutover tests**

```bash
node test/gmail-booking-actions.test.js
node test/gmail-scan-runner.test.js
node test/gmail-manual-scan.test.js
node test/gmail-scan-routing.test.js
npm test
```

- [ ] **Step 7: Retire old direct-trip code after import search**

Run repository searches for:

```text
gmail-trip-extractor
gmail-trip-matcher
gmail-trip-actions
decideGmailTripActions
Trip booking 
```

Delete the old extractor/matcher/action modules and their tests only after there are no live imports. Delete `gmail-decisions.js` only if it is genuinely unused.

Run full suite again after deletion.

- [ ] **Step 8: Commit**

```bash
git add src test
git commit -m "feat: route gmail travel through canonical bookings"
```

---

### Task 10: Enrich Gmail-created Life Admin events and link them to trips safely

**Files:**
- Modify: `src/domain/gmail-life-admin-extractor.js`
- Modify: `src/services/gmail-life-admin-actions.js`
- Modify: `test/gmail-life-admin-extractor.test.js`
- Modify: `test/gmail-life-admin-actions.test.js`
- Modify: `test/gmail-life-admin-data-idempotency.test.js`

- [ ] **Step 1: Write failing event enrichment tests**

Cover restaurant/event examples with provider, location, confirmation reference, start/end/timezone, booking URL when present. Keep existing membership/bill/subscription date-only behavior unchanged.

Include a Yonder-style restaurant reservation and Cafe Sydney-style reservation as event fixtures. Tests should prove the confirmation is a detail of the event, not an event/trip title source.

- [ ] **Step 2: Add failing trip-link tests for events**

Require:

- event with compatible date + destination geography can link to an existing trip;
- date-only match with missing trip geography returns review/unlinked;
- manual `linked_trip_id` is never replaced by Gmail;
- follow-up event email remains idempotent.

- [ ] **Step 3: Implement enrichment and link orchestration**

After `ensureGmailLifeItem`, event-category items may pass through `proposeTripLink`. Auto-link only if the event has sufficiently strong location/time evidence and the field is not manually owned.

Record `life_item` activity for event updates/linking.

- [ ] **Step 4: Verify**

```bash
node test/gmail-life-admin-extractor.test.js
node test/gmail-life-admin-actions.test.js
node test/gmail-life-admin-data-idempotency.test.js
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/gmail-life-admin-extractor.js src/services/gmail-life-admin-actions.js test
git commit -m "feat: enrich and trip-link gmail events"
```

---

### Task 11: Targeted historical reconstruction tool — no shell deletion

**Files:**
- Create: `src/services/gmail-trip-reconstruction.js`
- Create: `src/jobs/gmail-trip-reconstruction.js`
- Create: `test/gmail-trip-reconstruction.test.js`
- Modify: `package.json`
- Modify: `test.js`

**Modes:**

```text
--dry-run   default; read-only report
--apply     create/update reconstructed bookings/events and links, but DO NOT delete legacy trip shells
```

There is deliberately no automatic `--delete` mode in the application job. Legacy-shell deletion will be a separately reviewed Supabase transaction after explicit user approval.

- [ ] **Step 1: Write failing reconstruction tests**

Test fixture should model:

- a set of Gmail-created empty trip shells identified from `gmail_activity_entries`;
- duplicate shell creates from the same Gmail source;
- one manual trip (`ANZ`) that must never enter the shell set;
- source records mapping to Qantas/Jetstar/Hertz/Booking.com/activity examples;
- a shell with a real segment/task/booking/event link that must be marked `blocked_from_cleanup`.

Require dry-run output rows containing:

```text
old trip shell ID/title
source record IDs / Gmail message IDs
candidate object type
canonical booking/event ID if already known
extracted confirmation reference
extracted dates
extracted geography
proposed/actual trip link or unlinked state
score/reasons
cleanup eligibility
```

- [ ] **Step 2: Verify red**

```bash
node test/gmail-trip-reconstruction.test.js
```

- [ ] **Step 3: Implement legacy source discovery**

Select only historical trip-create activity consistent with the old Gmail trip action rule, then validate that each candidate shell is empty of real segments/bookings/tasks/event links/manual content before labeling it cleanup-eligible.

Do not assume the count is always 28; report the observed count and explicitly compare it to the expected baseline. A mismatch must be surfaced, not silently accepted.

- [ ] **Step 4: Implement dry-run reconstruction**

For each distinct source, re-read exactly that Gmail message through the existing authenticated provider, parse with the new booking/event flow, resolve duplicates, and generate the mapping report. Use quota-safe pacing/retry behavior. Do not iterate the 523-source historical set.

- [ ] **Step 5: Implement apply-without-delete**

`--apply` may create/update canonical bookings/events, source links, and safe trip links using the same production services. It may not delete, rename, or mutate the legacy shell trips.

The command should be idempotent: rerunning `--apply` after a successful apply must not create duplicate bookings/events.

- [ ] **Step 6: Add package script**

Add an explicit script such as:

```json
"job:gmail:trip-reconstruction": "node src/jobs/gmail-trip-reconstruction.js"
```

- [ ] **Step 7: Verify**

```bash
node test/gmail-trip-reconstruction.test.js
npm test
node --check src/jobs/gmail-trip-reconstruction.js
```

- [ ] **Step 8: Commit**

```bash
git add src/services/gmail-trip-reconstruction.js src/jobs/gmail-trip-reconstruction.js test/gmail-trip-reconstruction.test.js package.json package-lock.json test.js
git commit -m "feat: add guarded gmail trip reconstruction job"
```

---

### Task 12: Version, regression hardening, CI, and static safety checks

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `test.js`
- Modify: `.github/workflows/ci.yml` only as needed
- Modify: any regression tests discovered by full-suite failures

- [ ] **Step 1: Set v0.13.0 consistently**

Update package version/lockfile to `0.13.0`. Update the final `test.js` success string so it no longer reports v0.12.3.

- [ ] **Step 2: Add/retain syntax checks for new critical modules**

At minimum verify:

```bash
node --check src/routes/bookings.js
node --check src/domain/gmail-booking-extractor.js
node --check src/domain/trip-linker.js
node --check src/services/gmail-booking-actions.js
node --check src/services/gmail-trip-reconstruction.js
node --check src/jobs/gmail-trip-reconstruction.js
```

Add to CI if the repository convention warrants explicit checks.

- [ ] **Step 3: Run static regression searches**

Search source for dangerous legacy behavior:

```text
Trip booking 
applyCreateTripFromGmail
inferTripInputFromFacts
(?:booking reference|confirmation|reservation ... {5,10})
```

Expected: no live production path can create a confirmation-named trip.

Also search for route code that assumes `booking.trip_id` is always truthy and fix each valid occurrence.

- [ ] **Step 4: Full local verification**

```bash
npm ci --no-audit --no-fund
npm test
node --check server.js
```

All tests must pass from a clean install.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json test.js .github/workflows/ci.yml test src
git commit -m "chore: finalize preston.ai v0.13.0"
```

---

### Task 13: Supabase verification and safe release rollout

**Files:**
- No new feature scope. This task applies and verifies already-reviewed artifacts.

- [ ] **Step 1: Run migration against a non-production database when available**

Use local/UAT if available. If UAT remains inactive and cannot be used, state that limitation explicitly and rely on migration contract tests plus a reviewed production apply because the migration is additive/backward-compatible.

Verify:

- nullable `bookings.trip_id`;
- owner-safe constraints;
- booking source-link RLS;
- booking segment check;
- Life Admin linked-trip FK;
- no unexpected row count changes.

Run Supabase security/performance advisors and address any v0.13-introduced issues.

- [ ] **Step 2: Open PR to `build/preston-ai-v0.11.0`**

PR summary must call out:

- booking-first Gmail cutover;
- schema changes;
- manual-authority protections;
- historical reconstruction job is non-deleting;
- the 28 legacy shells are intentionally preserved pending review.

- [ ] **Step 3: Require green GitHub CI**

Do not merge while any v0.13 test/check is failing.

- [ ] **Step 4: Apply backward-compatible production schema**

Apply the reviewed generated migration to Supabase production using the supported Supabase migration mechanism. Verify migration history and schema before deploying app code.

Because v0.12.4 can tolerate added columns and nullable booking trip IDs, schema-first minimizes rollout risk.

- [ ] **Step 5: Merge/deploy application**

Deploy through the existing Railway production branch/service. Verify Railway reaches terminal SUCCESS and logs identify preston.ai v0.13.0.

- [ ] **Step 6: Production smoke verification**

Verify with authenticated production reads/UI:

- `/trips` renders;
- `/bookings` renders;
- unlinked booking create/edit works;
- trip selector works;
- event trip selector works;
- manual `ANZ` trip is unchanged;
- current Life Admin items remain present;
- no migration-created trip rows appeared.

- [ ] **Step 7: Run one controlled Gmail scan/new-source test**

Confirm a travel-classified source now creates/updates a Booking first. Confirm no title matching `Trip booking ...` is created. Confirm activity references the booking.

Do not initiate a 523-message rebackfill.

- [ ] **Step 8: Run historical reconstruction dry-run only**

Execute the targeted job in `--dry-run` mode. Capture the mapping report and compare:

- observed legacy shell count vs expected 28 baseline;
- distinct Gmail sources;
- deduplicated canonical bookings/events;
- proposed trip links/reviews;
- blocked cleanup rows.

Do **not** delete the shells.

- [ ] **Step 9: Review before any historical mutation**

If dry-run output is sensible, run `--apply` only to create/update canonical bookings/events and safe links. Re-run dry-run afterward and prove idempotency.

Still do **not** delete legacy trip shells.

- [ ] **Step 10: Present the exact cleanup mapping for explicit approval**

The user must be shown the exact old-shell → canonical-object/trip mapping and the rows blocked from cleanup. Only after explicit approval may a separate, one-off Supabase transaction delete eligible obsolete shells and their obsolete Gmail trip-create activity.

That later cleanup transaction must:

- start from an exact reviewed shell ID set;
- re-check every shell is still empty of real bookings, segments, tasks, Life Admin links, and manual content;
- abort on set/count mismatch;
- preserve `ANZ`;
- preserve Gmail source records/emails;
- delete only obsolete Gmail trip-create activity tied to the approved shells;
- verify post-transaction counts.

---

## Production Acceptance Checklist

- [ ] v0.13.0 package/runtime version is consistent.
- [ ] `bookings.trip_id` is nullable and unlinked bookings are visible in UI.
- [ ] An unlinked booking cannot retain `segment_id`.
- [ ] A booking can be linked, moved, or unlinked without recreation.
- [ ] Any Life Admin event can be manually linked/unlinked to a trip.
- [ ] Trips store/edit destination label/city/region/country independently of title.
- [ ] Combined trip itinerary displays bookings/events/segments chronologically.
- [ ] Gmail extraction uses full message body plus available PDF evidence.
- [ ] Qantas/Jetstar/Booking.com/Airbnb/Hertz/FareHarbor patterns pass fixtures.
- [ ] `EMAIL`, `REMINDER`, `NUMBER`, `CONFIRMED`, `DISCOVERY`, `PRESTON`, `ERENCE` cannot become references through generic parsing.
- [ ] Gmail travel processing creates/updates Booking before any trip decision.
- [ ] Reminder/follow-up emails are idempotent by canonical booking identity/source links.
- [ ] Gmail does not overwrite manual booking/event/trip authority.
- [ ] New automatic trip titles/destinations come only from real geography/date evidence.
- [ ] Ambiguous matches remain unlinked/reviewed rather than creating junk trips.
- [ ] Gmail activity records the entity actually changed.
- [ ] Manual `ANZ` trip is preserved.
- [ ] Historical reconstruction scopes only the legacy-shell source records.
- [ ] Reconstruction dry-run is reviewed before `--apply`.
- [ ] Reconstruction `--apply` is idempotent and does not delete shells.
- [ ] No full 523-message backfill is run.
- [ ] No legacy shell deletion occurs without separate explicit approval.
- [ ] `npm test` passes from clean install.
- [ ] GitHub CI passes.
- [ ] Supabase advisors show no unresolved issue introduced by v0.13.
- [ ] Railway deployment reaches terminal SUCCESS and production smoke checks pass.

## Expected Commit Sequence

1. `feat: add v0.13 trip booking linkage schema`
2. `refactor: share trip and event time validation`
3. `feat: support unlinked bookings and manual authority`
4. `feat: add independent booking management`
5. `feat: link events and destination data to trips`
6. `feat: extract full gmail message text`
7. `feat: add provider-aware gmail booking extraction`
8. `feat: add conservative trip linkage engine`
9. `feat: route gmail travel through canonical bookings`
10. `feat: enrich and trip-link gmail events`
11. `feat: add guarded gmail trip reconstruction job`
12. `chore: finalize preston.ai v0.13.0`

## Out of Scope for v0.13.0

- General-purpose universal events table replacing Bookings/Life Admin.
- Gmail write scopes/actions.
- Geocoding API integration or third-party place lookup.
- Automatic inference of geography from a trip title such as `ANZ`.
- Full historical mailbox rescan.
- Automatic deletion of legacy Gmail trip shells.
- Broad redesign of unrelated preston.ai modules.
