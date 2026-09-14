# preston.ai v0.14.0 Travel Intelligence & Trip Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured multi-leg travel detail, one-card-per-Trip travel intelligence, a single Booking editor, reversible Trip archiving, and archive-safe Gmail enrichment without changing the v0.13 Trip / Booking / Event architecture.

**Architecture:** Keep Trip as the journey container, Booking as the canonical reservation, Life Admin Event as the scheduled-event object, and Gmail as provenance. Add `booking_legs` as relational child records for route-specific transport detail and `trips.archived_at` as an independent lifecycle dimension. New presentation/domain helpers build travel summaries and “Next” state from structured records, while Gmail automation continues to update canonical records conservatively and never treats archived Trips as automatic match targets.

**Tech Stack:** Node.js 22/CommonJS, native Node `assert` tests, server-rendered HTML, Supabase/PostgreSQL with owner-scoped RLS, Gmail REST API `format=full`, Railway deployment.

**Spec:** `docs/superpowers/specs/2026-09-14-travel-intelligence-trip-archive-design.md`

## Global Constraints

- Product name remains `preston.ai` in touched UI copy.
- Target release is **v0.14.0**.
- Implement from a feature branch created from the approved design/plan branch; do not implement directly on `build/preston-ai-v0.11.0`.
- Use test-driven development. Every task begins with a focused failing test, then the minimum implementation, then focused and full-suite verification.
- Do not weaken owner-scoped RLS or composite owner foreign-key patterns.
- Before writing the migration, inspect current Supabase migration conventions and create the migration with the installed Supabase CLI; do not hand-invent a timestamped filename.
- Schema changes are additive and backwards-compatible: nullable `trips.archived_at` plus a new `booking_legs` table. No release migration may delete or rewrite existing Trip/Booking/Event data.
- Gmail remains read-only. Do not add Gmail modify/send scopes.
- Do not replay the full historical Gmail corpus.
- Do not delete or rewrite the manual `ANZ` Trip.
- Do not auto-link the ambiguous December Qantas/Hertz records to `ANZ` merely because dates overlap.
- Manual Booking fields and manual Booking-leg fields always outrank Gmail automation.
- Missing travel facts remain null. Do not invent times, flight/service numbers, references, locations, routes, or dates.
- Archived Trips remain manually viewable/editable/linkable but are excluded from new Gmail automatic Trip matching and Trip-level reminder generation.
- Existing canonical Bookings already linked to an archived Trip keep that Trip assignment during Gmail enrichment.
- Archive/unarchive is manual, reversible, explicit POST-only behavior. Archive is not delete.
- Archiving a non-cancelled Trip sets `status='completed'`; a cancelled Trip remains cancelled. Unarchive clears only `archived_at`.
- Bowral and Queenstown remain unarchived during release verification; the user archives them manually afterward.
- No N+1 database loops for home-page travel cards.

---

## File Map

### New files

- `supabase/migrations/<generated>_v0140_travel_intelligence_archive.sql` — additive schema for `trips.archived_at` and `booking_legs`.
- `src/data/booking-legs.js` — owner-scoped Booking-leg CRUD, Gmail upsert, manual-field protection, batch reads.
- `src/domain/travel-presenter.js` — summary tokens, type inventory, Trip timing labels, and time-aware Next selection.
- `src/services/travel-dashboard.js` — batch loads Bookings, Events, and Booking Legs for selected Trips and builds home-card view models.
- `src/services/gmail-booking-enrichment.js` — targeted canonical-Booking reread/enrichment logic with no Trip creation path.
- `src/jobs/gmail-booking-enrichment.js` — dry-run/apply CLI with explicit confirmation gate.
- `test/v0140-migration.test.js` — migration contract.
- `test/booking-legs-data.test.js` — ownership/manual-authority/idempotency tests.
- `test/travel-presenter.test.js` — formatting, inventory, Trip timing, Next logic.
- `test/travel-dashboard.test.js` — batch-query/view-model composition.
- `test/gmail-booking-enrichment.test.js` — targeted enrichment behavior.
- `test/gmail-booking-enrichment-job.test.js` — mode/confirmation safety.
- `test/v0140-static-safety.test.js` — release-level guardrails.

### Existing files to modify

- `src/data/trips.js` — archive filters and archive/unarchive mutations.
- `src/data/bookings.js` — batch Trip reads only; Booking schema remains canonical.
- `src/data/life-admin.js` — batch linked-Trip event read.
- `src/domain/trips.js` — archived exclusion and Stage wording constants remain compatible.
- `src/domain/gmail-booking-extractor.js` — optional `legs` extraction contract.
- `src/services/gmail-booking-actions.js` — Booking-leg persistence plus archived-Trip preservation/exclusion.
- `src/services/gmail-life-admin-actions.js` — archived Trips excluded from new event auto-linking.
- `src/services/gmail-manual-scan.js` / `src/services/gmail-scan-runner.js` — wire Booking-leg actions without changing scan scope.
- `src/services/reminder-engine.js` — archived Trips excluded from Trip-level reminders.
- `src/pages/bookings.js` — canonical Booking editor, grouped Trip selector, lightweight Booking-leg editor/presentation.
- `src/routes/bookings.js` — canonical Booking routes plus leg save/delete actions.
- `src/pages/trips.js` — Stage terminology, badges, leg display, archive state/actions, time-aware Next.
- `src/routes/trips.js` — archived list and archive/unarchive POSTs; remove duplicate user-facing Booking form behavior.
- `src/routes/site.js` — load home travel cards through one batch service.
- `src/pages/home.js` — render one travel card per Trip using Planned Workout-style child rows.
- `src/config.js` — v0.14 Gmail parser/scanner version strings if parser behavior changes.
- `src/branding.js`, `package.json`, `package-lock.json`, `test.js`, `test/smoke.test.js`, `test/pages.test.js` — v0.14 release wiring and verification.

---

### Task 1: Add the v0.14 archive and Booking-leg schema

**Files:**
- Create: `supabase/migrations/<generated>_v0140_travel_intelligence_archive.sql`
- Create: `test/v0140-migration.test.js`
- Modify: `test.js`

**Interfaces:**
- Produces database column `trips.archived_at timestamptz null`.
- Produces table `booking_legs(id,user_id,booking_id,position,service_number,origin,destination,departs_at,arrives_at,departure_time_zone,arrival_time_zone,source_metadata,created_at,updated_at)`.
- Produces owner-safe FK `(booking_id,user_id) -> bookings(id,user_id)` and RLS policies equivalent to Bookings.

- [ ] **Step 1: Write the migration contract test**

```js
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.join(__dirname,'..','supabase','migrations');
const file=fs.readdirSync(dir).find(x=>x.endsWith('_v0140_travel_intelligence_archive.sql'));
assert.ok(file,'v0.14 migration required');
const sql=fs.readFileSync(path.join(dir,file),'utf8');
for(const pattern of [
  /alter table public\.trips add column archived_at timestamptz/i,
  /create table public\.booking_legs/i,
  /booking_id uuid not null/i,
  /position integer not null[^;]*check \(position > 0\)/i,
  /service_number text/i,
  /departure_time_zone text/i,
  /arrival_time_zone text/i,
  /source_metadata jsonb not null default '\{\}'::jsonb/i,
  /foreign key \(booking_id, user_id\) references public\.bookings\(id, user_id\) on delete cascade/i,
  /unique \(booking_id, position\)/i,
  /create index booking_legs_booking_owner_idx on public\.booking_legs \(booking_id, user_id\)/i,
  /create index trips_user_archived_end_idx on public\.trips \(user_id, archived_at, end_date\)/i,
  /alter table public\.booking_legs enable row level security/i,
  /create policy booking_legs_select_owner/i,
  /grant select, insert, update, delete on public\.booking_legs to authenticated/i
]) assert.match(sql,pattern);
console.log('v0.14 migration tests passed');
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node test/v0140-migration.test.js`

Expected: FAIL because the v0.14 migration does not exist.

- [ ] **Step 3: Create the migration with Supabase CLI and write the additive SQL**

Use the installed CLI to generate the filename, then implement equivalent SQL:

```sql
alter table public.trips add column archived_at timestamptz;
create index trips_user_archived_end_idx on public.trips (user_id, archived_at, end_date);

create table public.booking_legs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid not null,
  position integer not null default 1 check (position > 0),
  service_number text,
  origin text,
  destination text,
  departs_at timestamptz,
  arrives_at timestamptz,
  departure_time_zone text,
  arrival_time_zone text,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (booking_id, user_id) references public.bookings(id, user_id) on delete cascade,
  unique (booking_id, position),
  check (departs_at is null or arrives_at is null or arrives_at >= departs_at)
);
create index booking_legs_booking_owner_idx on public.booking_legs (booking_id, user_id);
alter table public.booking_legs enable row level security;
create policy booking_legs_select_owner on public.booking_legs for select to authenticated using ((select auth.uid()) = user_id);
create policy booking_legs_insert_owner on public.booking_legs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy booking_legs_update_owner on public.booking_legs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy booking_legs_delete_owner on public.booking_legs for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.booking_legs from anon;
grant select, insert, update, delete on public.booking_legs to authenticated;
```

- [ ] **Step 4: Run focused migration tests**

Run: `node test/v0140-migration.test.js && node test/trip-booking-linkage-migration.test.js`

Expected: PASS.

- [ ] **Step 5: Add the new test to `test.js`, run the full suite, and commit**

Run: `npm test`

Expected: all pre-existing tests plus the v0.14 migration test pass.

Commit:

```bash
git add supabase/migrations test/v0140-migration.test.js test.js
git commit -m "feat: add v0.14 travel archive schema"
```

---

### Task 2: Implement Booking-leg validation, CRUD, Gmail upsert, and batch reads

**Files:**
- Create: `src/data/booking-legs.js`
- Create: `test/booking-legs-data.test.js`
- Modify: `src/domain/trips.js`
- Modify: `test/trips-domain.test.js`
- Modify: `test.js`

**Interfaces:**
- Produces `validateBookingLegInput(input, {allowPartial=false})` in `src/domain/trips.js`.
- Produces `listBookingLegs(supabase,user,bookingId)`.
- Produces `listBookingLegsByBookingIds(supabase,user,bookingIds)`.
- Produces `createBookingLeg`, `updateBookingLeg`, `deleteBookingLeg`.
- Produces `upsertBookingLegFromGmail(supabase,user,bookingId,candidate,metadata)` which preserves `source_metadata.manual_fields`.

- [ ] **Step 1: Add RED validation/data tests**

Test the exact invariants:

```js
const manual={service_number:'JQ223',origin:'Sydney',destination:'Queenstown',departs_at:'2026-08-15T11:50',arrives_at:'2026-08-15T16:45',departure_time_zone:'Australia/Sydney',arrival_time_zone:'Pacific/Auckland',position:1};
const valid=validateBookingLegInput(manual);
assert.equal(valid.service_number,'JQ223');
assert.equal(valid.departs_at,'2026-08-15T01:50:00.000Z');
assert.equal(valid.arrives_at,'2026-08-15T04:45:00.000Z');
```

For the data layer, prove:

```js
assert.ok(insert.source_metadata.manual_fields.includes('service_number'));
assert.ok(insert.source_metadata.manual_fields.includes('origin'));
```

Then simulate a Gmail update against an existing leg with `manual_fields:['origin']` and assert `origin` is omitted from the database update while `service_number` or `arrives_at` can enrich.

- [ ] **Step 2: Run RED**

Run: `node test/booking-legs-data.test.js && node test/trips-domain.test.js`

Expected: FAIL because the new validation/data module does not exist.

- [ ] **Step 3: Implement leg validation**

Add to `src/domain/trips.js`:

```js
const BOOKING_LEG_FIELDS=['service_number','origin','destination','departs_at','arrives_at','departure_time_zone','arrival_time_zone'];
function validateBookingLegInput(input={}){
  const departureZone=String(input.departure_time_zone||'Australia/Sydney').trim();
  const arrivalZone=String(input.arrival_time_zone||departureZone).trim();
  if(!isValidTimeZone(departureZone)||!isValidTimeZone(arrivalZone))throw new Error('Time zone is invalid');
  const departs=localDateTimeToUtc(input.departs_at,departureZone);
  const arrives=localDateTimeToUtc(input.arrives_at,arrivalZone);
  if(departs&&arrives&&new Date(arrives)<new Date(departs))throw new Error('Arrival time cannot be before departure time');
  return {
    position:positiveInteger(input.position),
    service_number:optionalText(input.service_number),
    origin:optionalText(input.origin),
    destination:optionalText(input.destination),
    departs_at:departs,
    arrives_at:arrives,
    departure_time_zone:departureZone,
    arrival_time_zone:arrivalZone
  };
}
```

- [ ] **Step 4: Implement the owner-scoped data module**

Use the same manual authority model as `src/data/bookings.js`. The key Gmail merge loop must be:

```js
const LEG_FIELDS=['service_number','origin','destination','departs_at','arrives_at','departure_time_zone','arrival_time_zone'];
const protectedFields=new Set(existing.source_metadata?.manual_fields||[]);
const patch={};
for(const key of LEG_FIELDS){
  if(Object.hasOwn(candidate,key)&&!protectedFields.has(key))patch[key]=candidate[key]??null;
}
```

For Gmail identity, first query `(booking_id, position)` when `position` is present. If that row is absent and the candidate has all four strong-shape fields, query exact `service_number`, `origin`, `destination`, and `departs_at`. Create only if neither identity resolves.

- [ ] **Step 5: Run focused and full tests**

Run: `node test/booking-legs-data.test.js && node test/trips-domain.test.js && npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/booking-legs.js src/domain/trips.js test/booking-legs-data.test.js test/trips-domain.test.js test.js
git commit -m "feat: add booking leg data model"
```

---

### Task 3: Add Trip archive domain/data behavior and reminder exclusion

**Files:**
- Modify: `src/data/trips.js`
- Modify: `src/domain/trips.js`
- Modify: `src/services/reminder-engine.js`
- Modify: `test/trips-data.test.js`
- Modify: `test/trips-domain.test.js`
- Modify: `test/reminder-engine.test.js`

**Interfaces:**
- `listTrips(supabase,user,{archiveState='include'}={})` where `archiveState` is `include`, `active`, or `archived`.
- `archiveTrip(supabase,user,id,nowIso)`.
- `unarchiveTrip(supabase,user,id,nowIso)`.
- `getUpcomingTrips()` excludes `archived_at != null` regardless of status.

- [ ] **Step 1: Write RED archive lifecycle tests**

Data tests:

```js
const archived=await archiveTrip(supabase,{id:'u1'},'t1','2026-09-14T08:00:00.000Z');
assert.equal(archived.archived_at,'2026-09-14T08:00:00.000Z');
assert.equal(archived.status,'completed');
```

Repeat archive and prove the existing `archived_at` is retained. Archive a cancelled Trip and prove status remains cancelled. Unarchive and prove only `archived_at` becomes null.

Domain test:

```js
assert.deepEqual(getUpcomingTrips([{id:'a',status:'upcoming',start_date:'2026-09-20',archived_at:'2026-09-14T00:00:00Z'}],new Date('2026-09-14T00:00:00Z')),[]);
```

Reminder test: an archived future Trip must not appear in `eligibleMorningItems`.

- [ ] **Step 2: Run RED**

Run: `node test/trips-data.test.js && node test/trips-domain.test.js && node test/reminder-engine.test.js`

Expected: FAIL on missing archive APIs / archived filtering.

- [ ] **Step 3: Implement archive data helpers**

Add archive filtering without breaking existing callers:

```js
async function listTrips(supabase,user,{archiveState='include'}={}){
  const uid=requireUser(user);
  let q=supabase.from('trips').select('*').eq('user_id',uid);
  if(archiveState==='active')q=q.is('archived_at',null);
  if(archiveState==='archived')q=q.not('archived_at','is',null);
  const r=await q.order('start_date',{ascending:true,nullsFirst:false}).order('title',{ascending:true});
  if(r.error)throw r.error;
  return r.data||[];
}
```

Archive must read the current Trip first and no-op if already archived:

```js
async function archiveTrip(supabase,user,id,now=new Date().toISOString()){
  const existing=await getTrip(supabase,user,id);
  if(!existing||existing.archived_at)return existing;
  const patch={archived_at:now,updated_at:now};
  if(existing.status!=='cancelled')patch.status='completed';
  // owner-scoped update and maybeSingle
}
```

Unarchive uses `{archived_at:null,updated_at:now}` only.

- [ ] **Step 4: Filter reminders and upcoming Trips**

In `getUpcomingTrips`, add the first filter `trip => !trip.archived_at`.

In `eligibleMorningItems`, skip archived Trips before status/date checks:

```js
for(const trip of trips||[]){
  if(trip.archived_at)continue;
  if(['completed','cancelled'].includes(trip.status))continue;
  // existing logic
}
```

- [ ] **Step 5: Verify and commit**

Run: `node test/trips-data.test.js && node test/trips-domain.test.js && node test/reminder-engine.test.js && npm test`

Commit:

```bash
git add src/data/trips.js src/domain/trips.js src/services/reminder-engine.js test/trips-data.test.js test/trips-domain.test.js test/reminder-engine.test.js
git commit -m "feat: add reversible trip archiving"
```

---

### Task 4: Extend provider extraction with structured transport legs

**Files:**
- Modify: `src/domain/gmail-booking-extractor.js`
- Modify: `test/gmail-booking-extractor.test.js`
- Modify: `src/config.js`
- Modify: `test/config.test.js`

**Interfaces:**
- `extractBookingCandidate()` continues returning `{candidate,facts}`.
- `candidate.legs` is an optional ordered array. It is absent or `[]` for non-transport Bookings.
- Each leg uses `{position,service_number,origin,destination,departs_at,arrives_at,departure_time_zone,arrival_time_zone}`.

- [ ] **Step 1: Expand production-shaped Jetstar tests and prove RED**

For `QNRY8J`, assert:

```js
assert.equal(jetstarProduction.candidate.legs.length,2);
assert.deepEqual(jetstarProduction.candidate.legs.map(x=>x.service_number),['JQ223','JQ224']);
assert.equal(jetstarProduction.candidate.legs[0].origin,'Sydney');
assert.equal(jetstarProduction.candidate.legs[0].destination,'Queenstown');
assert.equal(jetstarProduction.candidate.legs[0].departure_time_zone,'Australia/Sydney');
assert.equal(jetstarProduction.candidate.legs[0].arrival_time_zone,'Pacific/Auckland');
assert.equal(jetstarProduction.candidate.legs[1].origin,'Queenstown');
assert.equal(jetstarProduction.candidate.legs[1].destination,'Sydney');
```

Use the existing exact production-shaped body containing `11:50am`, `4:45pm`, and `5:45pm`. Assert missing arrival time for JQ224 remains `null` if the source text does not contain one.

Add a Qantas assertion only when the fixture text includes an actual service number; otherwise prove no synthetic leg/service number is created.

- [ ] **Step 2: Run RED**

Run: `node test/gmail-booking-extractor.test.js`

Expected: FAIL because `candidate.legs` is not emitted.

- [ ] **Step 3: Implement Jetstar leg parsing before generic fallbacks**

Add a provider-specific helper that reads the Jetstar table rows in order. The returned shape must use actual local zones when known and call `localDateTimeToUtc` only when a time exists.

Sketch:

```js
function parseJetstarLegs(text){
  const value=String(text||'');
  const rows=[...value.matchAll(/(?:Sat|Sun|Mon|Tue|Wed|Thu|Fri)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+(\d{1,2}:\d{2}(?:am|pm))\s+(JQ\d{2,4})\s+([^\n]+?)(?=(?:Sat|Sun|Mon|Tue|Wed|Thu|Fri)\s+\d|International check-in times|$)/gi)];
  // normalize each row using known Sydney/Queenstown place+zone mapping;
  // return ordered leg objects; leave unsupported arrival values null.
}
```

Do not use footer prose as route data. Keep the existing explicit `Flight #1` / `Flight #2` route preference.

- [ ] **Step 4: Derive top-level transport dates from valid legs only when stronger**

If legs provide actual datetimes, set top-level `starts_at` from first leg departure and `ends_at` from the last leg arrival, or last departure if arrival is unavailable. Preserve Trip-facing destination as Queenstown for the round trip rather than replacing it with Sydney.

- [ ] **Step 5: Bump Gmail parser/scanner versions to v0.14.0 and verify**

Expected config values:

```js
scannerVersion:'gmail-scanner-v0.14.0'
parserVersion:'gmail-parser-v0.14.0'
```

Run: `node test/gmail-booking-extractor.test.js && node test/config.test.js && npm test`

- [ ] **Step 6: Commit**

```bash
git add src/domain/gmail-booking-extractor.js src/config.js test/gmail-booking-extractor.test.js test/config.test.js
git commit -m "feat: extract structured transport legs"
```

---

### Task 5: Persist Gmail legs and make automatic Trip linking archive-safe

**Files:**
- Modify: `src/services/gmail-booking-actions.js`
- Modify: `src/services/gmail-life-admin-actions.js`
- Modify: `src/services/gmail-manual-scan.js`
- Modify: `test/gmail-booking-actions.test.js`
- Modify: `test/gmail-life-admin-actions.test.js`
- Modify: `test/gmail-manual-scan.test.js`

**Interfaces:**
- `buildGmailBookingActions({... bookingLegData })` accepts the new leg data module.
- `processBooking()` persists `candidate.legs` after canonical Booking resolution.
- Archived Trip lock reason is `existing_archived_trip_assignment`.
- New matching calls `proposeTripLink` with only unarchived Trips.

- [ ] **Step 1: Add RED tests for all three archive cases**

Case 1: a new Booking sees `trips=[active, archived]`; the matcher input must omit archived.

Case 2: existing Booking has `trip_id:'archived-trip'` and the passed Trip has `archived_at`. Assert:

```js
assert.equal(result.linkDecision.kind,'link');
assert.equal(result.linkDecision.tripId,'archived-trip');
assert.deepEqual(result.linkDecision.reasons,['existing_archived_trip_assignment']);
assert.equal(calls.some(c=>c[0]==='createTrip'),false);
assert.equal(calls.filter(c=>c[0]==='updateBooking'&&Object.hasOwn(c[2],'trip_id')).length,0);
```

Case 3: rerunning the same two Jetstar legs calls Gmail leg upsert twice but does not create duplicate leg identities.

Life Admin test: a new Event cannot auto-link to an archived Trip; an existing Event already linked to an archived Trip remains linked because the current `linked_trip_id` preservation path wins.

- [ ] **Step 2: Run RED**

Run: `node test/gmail-booking-actions.test.js && node test/gmail-life-admin-actions.test.js && node test/gmail-manual-scan.test.js`

- [ ] **Step 3: Implement Booking archive lock and active candidate filtering**

Immediately after canonical Booking lookup:

```js
const archivedAssignedTrip=existing?.trip_id ? trips.find(t=>t.id===existing.trip_id&&t.archived_at) : null;
```

Apply locks in this order:

1. manual `trip_id` lock;
2. existing archived assignment lock;
3. ordinary matcher against `trips.filter(t=>!t.archived_at)`.

Never pass archived Trips into `proposeTripLink` for a new/relink decision.

- [ ] **Step 4: Persist candidate legs after canonical Booking save**

```js
for(const leg of Array.isArray(candidate.legs)?candidate.legs:[]){
  await bookingLegData.upsertBookingLegFromGmail(supabase,user,booking.id,leg,{
    source:'gmail',
    source_record_id:source.id,
    extractor_version:ruleVersion
  });
}
```

Do not make leg persistence conditional on Trip linking.

- [ ] **Step 5: Exclude archived Trips in Life Admin auto-linking**

Change only the matcher input:

```js
const activeTrips=(trips||[]).filter(t=>!t.archived_at);
const linkDecision=tripLinker({subjectType:'event',subject:candidate,trips:activeTrips});
```

The early return for an item that already has `linked_trip_id` remains unchanged.

- [ ] **Step 6: Verify and commit**

Run: focused tests above, then `npm test`.

Commit:

```bash
git add src/services/gmail-booking-actions.js src/services/gmail-life-admin-actions.js src/services/gmail-manual-scan.js test/gmail-booking-actions.test.js test/gmail-life-admin-actions.test.js test/gmail-manual-scan.test.js
git commit -m "feat: make gmail travel archive aware"
```

---

### Task 6: Add targeted canonical Booking enrichment with dry-run/apply gate

**Files:**
- Create: `src/services/gmail-booking-enrichment.js`
- Create: `src/jobs/gmail-booking-enrichment.js`
- Create: `test/gmail-booking-enrichment.test.js`
- Create: `test/gmail-booking-enrichment-job.test.js`
- Modify: `src/data/booking-sources.js`
- Modify: `package.json`
- Modify: `test.js`

**Interfaces:**
- `listBookingSourceLinksForEnrichment(supabase,user)` returns canonical Booking/source pairs only from `booking_source_links`.
- `runGmailBookingEnrichment({mode,data,provider,parserVersion,bookingData,bookingLegData})` returns `{mode,bookingCount,sourceCount,results}`.
- Apply confirmation literal: `gmail-booking-enrichment-v0.14.0-apply`.
- The service has **no** `createTrip`, `updateTrip`, or `deleteTrip` dependency.

- [ ] **Step 1: Write RED service tests**

Fixture two source links pointing to the same Jetstar Booking plus one Hertz Booking. Prove:

```js
const dry=await runGmailBookingEnrichment({...base,mode:'dry-run'});
assert.equal(dry.bookingCount,2);
assert.equal(dry.sourceCount,3);
assert.equal(writeCalls.length,0,'dry-run must not mutate bookings or legs');
```

Apply mode must call `updateBookingFromGmail` only for unprotected Booking fields and `upsertBookingLegFromGmail` for parsed legs. Rerun apply and prove the second result does not add duplicate legs.

- [ ] **Step 2: Add RED CLI gate tests**

```js
assert.equal(parseMode([],{}),'dry-run');
assert.equal(parseMode(['--apply'],{}),'apply');
assert.throws(()=>assertApplyConfirmation('apply',{}),/confirmation/i);
assert.doesNotThrow(()=>assertApplyConfirmation('apply',{GMAIL_BOOKING_ENRICHMENT_CONFIRM:APPLY_CONFIRMATION}));
```

- [ ] **Step 3: Implement the canonical source-link query**

In `src/data/booking-sources.js`, add one owner-scoped query selecting source details and Booking details from `booking_source_links`. Do not discover Gmail history outside existing source links.

- [ ] **Step 4: Implement enrichment service**

For each canonical Booking, reread only linked source messages, extract full-body/PDF evidence using the same normalize helpers as current Gmail processing, and select the richest candidate for that canonical Booking. The service may update Booking/legs but must never call Trip linker or Trip data functions.

The result row must include enough audit detail to inspect changes:

```js
{
  bookingId,
  provider,
  confirmationReference,
  sourceRecordIds,
  before:{starts_at,ends_at,origin,destination,location},
  proposed:{starts_at,ends_at,origin,destination,location,legs:[...]},
  applied:mode==='apply'
}
```

- [ ] **Step 5: Implement the CLI and npm script**

Add:

```json
"job:gmail:booking-enrichment": "node src/jobs/gmail-booking-enrichment.js"
```

Default is dry-run. Apply requires both `--apply` (or explicit environment mode) and exact confirmation env.

- [ ] **Step 6: Add static safety assertions**

The enrichment service/job source must not contain `createGeneratedTrip`, `createTrip`, `updateTrip`, `deleteTrip`, or a general Gmail list/query call.

- [ ] **Step 7: Verify and commit**

Run: `node test/gmail-booking-enrichment.test.js && node test/gmail-booking-enrichment-job.test.js && npm test`

Commit:

```bash
git add src/services/gmail-booking-enrichment.js src/jobs/gmail-booking-enrichment.js src/data/booking-sources.js package.json test/gmail-booking-enrichment.test.js test/gmail-booking-enrichment-job.test.js test.js
git commit -m "feat: add targeted booking enrichment"
```

---

### Task 7: Consolidate onto one canonical Booking editor and add lightweight leg editing

**Files:**
- Modify: `src/pages/bookings.js`
- Modify: `src/routes/bookings.js`
- Modify: `src/pages/trips.js`
- Modify: `src/routes/trips.js`
- Modify: `test/bookings-pages.test.js`
- Modify: `test/bookings-routes.test.js`
- Modify: `test/trips-pages.test.js`
- Modify: `test/trips-routes.test.js`

**Interfaces:**
- Canonical routes: `/bookings/new`, `/bookings/new?trip_id=<id>`, `/bookings/:id/edit`.
- Legacy `GET /trips/:id/bookings/new` returns 302 to `/bookings/new?trip_id=<id>`.
- Legacy nested Booking POST is removed from user-facing flow; if retained for compatibility it must delegate to canonical validation/data logic, not render a second form.
- Booking form receives `legs=[]` and all Trips, including archived.

- [ ] **Step 1: Write RED route/page tests for canonicalization**

Change the nested add test from 200/render to redirect:

```js
await handleBookingsRoute(req('GET','/trips/t1/bookings/new'),r,{supabase:s,config});
assert.equal(r.status,302);
assert.equal(r.headers.location,'/bookings/new?trip_id=t1');
```

Page test must prove the canonical editor contains `transport`, origin, destination, Booking URL, Stage selector, and a grouped archived Trip option. For example:

```js
const trips=[{id:'a',title:'Active',archived_at:null},{id:'h',title:'Historic',archived_at:'2026-09-14T00:00:00Z'}];
assert.match(form,/<optgroup label="Active trips">/);
assert.match(form,/<optgroup label="Archived trips">/);
```

For a flight Booking with legs, assert `JQ223` and `JQ224` are shown with lightweight edit controls.

- [ ] **Step 2: Run RED**

Run the four page/route test files.

- [ ] **Step 3: Make `src/pages/bookings.js` the only Booking form renderer**

Replace flat Trip options with grouped `<optgroup>` generation. Rename visible `Segment` label to `Stage`, while keeping the HTML/database field name `segment_id`.

Render leg rows only for `flight`/`transport` or when legs already exist. Keep fields limited to service number, route, departure/arrival local datetimes, and zones.

- [ ] **Step 4: Add leg save/delete POST actions to Booking routes**

Suggested routes:

```text
POST /bookings/:bookingId/legs
POST /bookings/:bookingId/legs/:legId
POST /bookings/:bookingId/legs/:legId/delete
```

Every action must verify owner, same origin, Booking ownership, and leg ownership through the data layer. Manual edits call the manual CRUD functions so `manual_fields` protection is recorded.

- [ ] **Step 5: Remove duplicate Booking rendering from Trip pages/routes**

Trip “Add booking” buttons become:

```js
buttonLink({href:`/bookings/new?trip_id=${encodeURIComponent(trip.id)}`,text:'Add booking'})
```

Trip detail Booking “Edit” buttons already point to `/bookings/:id/edit` and remain canonical.

- [ ] **Step 6: Verify and commit**

Run focused tests and `npm test`.

Commit:

```bash
git add src/pages/bookings.js src/routes/bookings.js src/pages/trips.js src/routes/trips.js test/bookings-pages.test.js test/bookings-routes.test.js test/trips-pages.test.js test/trips-routes.test.js
git commit -m "refactor: consolidate booking editor"
```

---

### Task 8: Add reusable travel presentation helpers and correct Next logic

**Files:**
- Create: `src/domain/travel-presenter.js`
- Create: `test/travel-presenter.test.js`
- Modify: `src/domain/trips.js`
- Modify: `test.js`

**Interfaces:**
- `bookingSummaryTokens(booking,legs)` returns an array of plain strings.
- `eventSummaryTokens(event)` returns an array of plain strings.
- `travelTypeInventory({bookings,events})` returns concise plain-string tokens.
- `describeTripTiming(trip,now)` returns `{state,label}`.
- `selectNextItineraryEntry(itinerary,now)` returns an entry or null.

- [ ] **Step 1: Write RED formatter tests**

Examples:

```js
assert.deepEqual(
  bookingSummaryTokens(jetstar,[{service_number:'JQ223'},{service_number:'JQ224'}]),
  ['Jetstar','JQ223 / JQ224','15–22 Aug','Ref QNRY8J']
);
assert.equal(bookingSummaryTokens({...jetstar,confirmation_reference:null},[]).some(x=>/null|unknown/i.test(x)),false);
assert.deepEqual(travelTypeInventory({bookings:[flight,stay,car,activity1],events:[event]}),['Flight','Stay','Car','2 Activities']);
```

Next test:

```js
const next=selectNextItineraryEntry([
  {type:'booking',record:{title:'Past',starts_at:'2026-09-10T00:00:00Z',ends_at:'2026-09-10T02:00:00Z',status:'confirmed'}},
  {type:'event',record:{title:'Current',starts_at:'2026-09-14T06:00:00Z',ends_at:'2026-09-14T09:00:00Z'}},
  {type:'booking',record:{title:'Future',starts_at:'2026-09-15T00:00:00Z',status:'confirmed'}}
],new Date('2026-09-14T07:00:00Z'));
assert.equal(next.record.title,'Current');
```

Cancelled entries must be ignored.

- [ ] **Step 2: Run RED**

Run: `node test/travel-presenter.test.js`

- [ ] **Step 3: Implement timezone-aware summary helpers**

Use `Intl.DateTimeFormat` with each record/leg zone. Keep these functions pure and return strings, never HTML.

Token rules:

```js
function compact(values){return values.filter(v=>v!==null&&v!==undefined&&String(v).trim()!=='');}
```

Do not emit placeholder text for missing fields.

- [ ] **Step 4: Implement inventory and Trip timing labels**

Inventory maps `flight -> Flight`, `accommodation -> Stay`, `hire_car -> Car`, `activity` Bookings plus linked Event count -> singular/plural `Activity/Activities`.

`describeTripTiming` returns labels such as `Today`, `Tomorrow`, `In 5 days`, `In progress`, `Ended yesterday`, and `Ended 3 days ago` using date-only Trip fields in Sydney date context.

- [ ] **Step 5: Implement Next selection**

Effective current/future rule:

```js
const end=record.ends_at?Date.parse(record.ends_at):null;
const start=record.starts_at?Date.parse(record.starts_at):null;
const stillRelevant=end!=null?end>=nowMs:start!=null?start>=nowMs:false;
```

Sort relevant entries by `starts_at`, then position/title. Never select a cancelled Booking.

- [ ] **Step 6: Verify and commit**

Run: `node test/travel-presenter.test.js && npm test`.

Commit:

```bash
git add src/domain/travel-presenter.js test/travel-presenter.test.js src/domain/trips.js test.js
git commit -m "feat: add travel presentation helpers"
```

---

### Task 9: Upgrade Trip detail UX with Stages, type badges, legs, inventory, and time-aware Next

**Files:**
- Modify: `src/pages/trips.js`
- Modify: `src/routes/trips.js`
- Modify: `test/trips-pages.test.js`
- Modify: `test/trips-routes.test.js`

**Interfaces:**
- Trip detail route loads Booking Legs in one batch for that Trip’s Booking IDs.
- `renderTripDetailPage` receives `bookingLegs=[]`, `inventory=[]`, `nextEntry=null`.
- Visible terminology is **Stage**, while URLs/database names may remain segment-based for compatibility.

- [ ] **Step 1: Write RED Trip-detail tests**

Assert:

```js
assert.match(detail,/FLIGHT/);
assert.match(detail,/JQ223/);
assert.match(detail,/JQ224/);
assert.match(detail,/SYD|Sydney/);
assert.match(detail,/ZQN|Queenstown/);
assert.match(detail,/Flight · Stay · Car · 2 Activities/);
assert.doesNotMatch(detail,/>Segment</);
assert.match(detail,/>Stage</);
```

A fully historical itinerary with `now` after every end must not render `class="next-card"`.

- [ ] **Step 2: Run RED**

Run: `node test/trips-pages.test.js && node test/trips-routes.test.js`.

- [ ] **Step 3: Load legs and compute presentation before rendering**

In the detail route, after Bookings load:

```js
const bookingIds=bookings.map(b=>b.id);
const bookingLegs=await listBookingLegsByBookingIds(supabase,user,bookingIds);
const itinerary=buildItinerary({segments,bookings,events});
const nextEntry=selectNextItineraryEntry(itinerary,new Date());
const inventory=travelTypeInventory({bookings,events});
```

- [ ] **Step 4: Render derived badges/chips**

Badges are CSS/presentation only. Flight Bookings with legs render one compact leg line per leg, then provider/reference metadata. Accommodation/hire-car/activity/event rows render type/date/provider/reference chips from structured fields.

- [ ] **Step 5: Rename visible Segment copy to Stage**

Change labels/buttons/section copy such as `Add segment`, `Segment type`, and `Edit segment` to `Add stage`, `Stage type`, and `Edit stage`. Keep existing routes `/segments/...` to avoid unnecessary migration.

- [ ] **Step 6: Use explicit `nextEntry` rather than `itinerary[0]`**

Remove the old `const next=itinerary[0]?...` behavior. Historical completed Trips with no relevant entry render no Next section.

- [ ] **Step 7: Verify and commit**

Run focused tests and `npm test`.

Commit:

```bash
git add src/pages/trips.js src/routes/trips.js test/trips-pages.test.js test/trips-routes.test.js
git commit -m "feat: improve trip travel detail"
```

---

### Task 10: Add active/past/archived Trip lists and archive/unarchive routes

**Files:**
- Modify: `src/routes/trips.js`
- Modify: `src/pages/trips.js`
- Modify: `test/trips-routes.test.js`
- Modify: `test/trips-pages.test.js`

**Interfaces:**
- `GET /trips` shows only unarchived Trips, separated into current/upcoming and past-unarchived groups.
- `GET /trips/archived` shows only archived Trips in deterministic descending historical order.
- `POST /trips/:id/archive` and `POST /trips/:id/unarchive` are same-origin owner actions.

- [ ] **Step 1: Write RED lifecycle route tests**

Test `GET /trips` excludes archived rows and still includes ended-unarchived rows. Test `/trips/archived` shows archived rows and hides active ones.

Archive action:

```js
await handleTripsRoute(req('POST','/trips/t1/archive'),r,{supabase:s,config});
assert.equal(r.status,302);
assert.equal(s.data.trips.find(t=>t.id==='t1').status,'completed');
assert.ok(s.data.trips.find(t=>t.id==='t1').archived_at);
```

Call it twice and assert the archive timestamp is unchanged. Unarchive twice and assert success/no mutation beyond clearing archive state.

- [ ] **Step 2: Run RED**

Run the Trips page/route tests.

- [ ] **Step 3: Split Trip list view models**

`/trips` loads `listTrips(...,{archiveState:'active'})`, then uses `getUpcomingTrips` plus ended-date logic to produce `upcoming` and `past` arrays. Do not mutate Trip status when merely rendering an ended Trip.

`/trips/archived` loads `{archiveState:'archived'}` and sorts:

```js
archived.sort((a,b)=>
  String(b.end_date||'').localeCompare(String(a.end_date||'')) ||
  String(b.start_date||'').localeCompare(String(a.start_date||'')) ||
  String(b.archived_at||'').localeCompare(String(a.archived_at||'')) ||
  String(a.title).localeCompare(String(b.title))
);
```

- [ ] **Step 4: Add explicit POST handlers**

Include archive/unarchive paths in `isTripPath`. Require `isSameOriginRequest` exactly as other mutating routes. Do not reuse delete guards because linked records are meant to remain attached.

- [ ] **Step 5: Render archive controls and state**

Trip detail shows Archive for active Trips and Unarchive for archived Trips. `/trips` contains an `Archived Trips` link. Archived detail remains editable and the Add Booking link still uses `/bookings/new?trip_id=<id>`.

- [ ] **Step 6: Verify and commit**

Run focused tests plus `npm test`.

Commit:

```bash
git add src/routes/trips.js src/pages/trips.js test/trips-routes.test.js test/trips-pages.test.js
git commit -m "feat: add trip archive workflow"
```

---

### Task 11: Build the batch home-page travel data service

**Files:**
- Create: `src/services/travel-dashboard.js`
- Create: `test/travel-dashboard.test.js`
- Modify: `src/data/bookings.js`
- Modify: `src/data/life-admin.js`
- Modify: `src/data/booking-legs.js`
- Modify: `test/trips-data.test.js`
- Modify: `test/life-admin-data.test.js`
- Modify: `test.js`

**Interfaces:**
- `listBookingsByTripIds(supabase,user,tripIds)` performs one `.in('trip_id',tripIds)` query.
- `listLifeItemsByTripIds(supabase,user,tripIds)` performs one `.in('linked_trip_id',tripIds)` query.
- `listBookingLegsByBookingIds` already comes from Task 2.
- `loadTravelDashboard({supabase,user,trips})` returns one view model per input Trip.

- [ ] **Step 1: Write RED batch-query tests**

Prove empty ID arrays return `[]` without querying. For multiple IDs, assert one query per table and `.in` receives the whole ID array.

- [ ] **Step 2: Write RED service composition test**

Fixture two Trips and verify exactly three child-data calls total: all Bookings, all Events, all Legs. Assert no per-Trip callback/query is used.

Expected view model:

```js
{
  trip,
  inventory:['Flight','Stay','Car','2 Activities'],
  items:[
    {type:'booking',id:'b1',title:'Sydney → Queenstown flights',tokens:['Jetstar','JQ223 / JQ224','15–22 Aug','Ref QNRY8J'],status:'confirmed'},
    {type:'event',id:'e1',title:'Yonder reservation',tokens:['Event','17 Aug','6:30–8:00pm','Queenstown','Ref 95640384']}
  ]
}
```

Items sort by effective start, then position/title; undated rows last.

- [ ] **Step 3: Implement batch data helpers**

Use owner-scoped `.eq('user_id',uid).in(...)` queries. Do not introduce SQL RPC or service-role access.

- [ ] **Step 4: Implement `travel-dashboard.js`**

Group Bookings and Events by Trip ID, legs by Booking ID, call the pure presenter helpers, and return view models in the same Trip order provided by the caller.

- [ ] **Step 5: Verify and commit**

Run focused data/service tests and `npm test`.

Commit:

```bash
git add src/services/travel-dashboard.js src/data/bookings.js src/data/life-admin.js src/data/booking-legs.js test/travel-dashboard.test.js test/trips-data.test.js test/life-admin-data.test.js test.js
git commit -m "feat: add batch travel dashboard data"
```

---

### Task 12: Render one compact travel card per Trip on the preston.ai home page

**Files:**
- Modify: `src/routes/site.js`
- Modify: `src/pages/home.js`
- Modify: `test/routes.test.js`
- Modify: `test/pages.test.js`

**Interfaces:**
- `renderHomePage` receives `travelTrips=[]` in addition to existing arguments.
- `travelTrips` is already composed; the page does not perform travel business logic.

- [ ] **Step 1: Write RED page tests for one-card-per-Trip behavior**

Supply a Queenstown travel view model with flight, car, and event child items. Assert:

```js
assert.equal((home.match(/data-travel-trip="queenstown"/g)||[]).length,1);
assert.match(home,/Jetstar/);
assert.match(home,/JQ223 \/ JQ224/);
assert.match(home,/Ref QNRY8J/);
assert.match(home,/Hertz/);
assert.match(home,/Yonder reservation/);
```

Assert there are not separate top-level Trip cards per child Booking.

- [ ] **Step 2: Write RED route tests for batch service wiring**

Inject `loadTravelDashboard` in `siteDeps` and assert it is called once with the already-filtered `upcomingTrips`. Simulate service failure and prove the rest of the home page still renders with a travel-data unavailable state.

- [ ] **Step 3: Wire `loadTravelDashboard` into `/`**

After `upcomingTrips` is selected, call the service once. Keep the existing cache/no-store behavior.

- [ ] **Step 4: Render travel cards in Planned Workout visual language**

Each Trip card contains header/title/date state/inventory and compact child rows. Child row hierarchy:

```html
<div class="travel-item">
  <span class="travel-context">Flight · Confirmed</span>
  <strong>Sydney → Queenstown flights</strong>
  <small>Jetstar · JQ223 / JQ224 · 15–22 Aug · Ref QNRY8J</small>
</div>
```

Use `escapeHtml` at render time because presenter tokens are plain strings.

- [ ] **Step 5: Place the travel section consistently**

Keep the approved dashboard hierarchy. The Trip travel card replaces the old shallow Trip rows in the Coming Up Trips card; it does not create a new unrelated dashboard section.

- [ ] **Step 6: Verify responsive/mobile behavior and commit**

Run: `node test/pages.test.js && node test/routes.test.js && npm test`.

Commit:

```bash
git add src/routes/site.js src/pages/home.js test/routes.test.js test/pages.test.js
git commit -m "feat: add home travel intelligence cards"
```

---

### Task 13: Release hardening, v0.14.0 versioning, UAT migration, enrichment dry-run, and production verification

**Files:**
- Create: `test/v0140-static-safety.test.js`
- Modify: `src/branding.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `test/smoke.test.js`
- Modify: `test.js`
- Modify: release notes/docs only if needed by existing repository convention.

**Interfaces:**
- Runtime/version string is exactly `0.14.0`.
- Static safety test protects archive semantics and enrichment boundaries.

- [ ] **Step 1: Add RED release safety tests**

Assert source invariants:

```js
assert.equal(pkg.version,'0.14.0');
assert.equal(VERSION,'0.14.0');
```

Scan `src/services/gmail-booking-enrichment.js` and `src/jobs/gmail-booking-enrichment.js` and assert they do not contain `deleteTrip`, `createGeneratedTrip`, or general historical Gmail replay functions.

Scan Trip routes and assert archive mutations are POST-only route handlers; there must be no GET archive mutation path.

- [ ] **Step 2: Bump version metadata and test runner**

Set `package.json`, package-lock root/package versions, and `src/branding.js` to `0.14.0`. Add every new v0.14 test to `test.js`. Update smoke/page expectations from `v0.13.0` to `v0.14.0`.

- [ ] **Step 3: Run the entire suite from a clean install state**

Run:

```bash
npm ci
npm test
```

Expected: full suite GREEN.

- [ ] **Step 4: Run syntax and static scans**

Run `node --check` across all new/modified JS files. Search for stale user-facing `Segment` copy in Trip/Booking pages; database/route identifiers may remain `segment` but visible labels should be Stage. Search for accidental `Trip booking ` placeholder generation and for any new Gmail write scope.

- [ ] **Step 5: Apply the migration to UAT first**

Apply only the new v0.14 migration to `preston-ai-uat`. Verify:

```sql
select archived_at from trips limit 1;
select count(*) from booking_legs;
```

Then run UAT page smoke tests for `/`, `/trips`, `/trips/archived`, one Trip detail, and `/bookings/new`.

- [ ] **Step 6: Run archive/unarchive against a disposable UAT Trip**

Verify archive sets non-cancelled status to completed, preserves linked Booking/Event/Task/Stage rows, and second archive is a no-op. Verify unarchive clears `archived_at`, preserves completed status, and second unarchive is a no-op.

Do **not** use Bowral or Queenstown for this verification.

- [ ] **Step 7: Run targeted Booking enrichment dry-run in UAT/production-equivalent data path**

Command pattern:

```bash
npm run job:gmail:booking-enrichment -- --dry-run
```

Review canonical candidates including Jetstar `QNRY8J`, Hertz `L5920779422`, Hertz `L661E0FC0A1`, Booking.com `5072736754`, Discovery Cruise `372492184`, Airbnb, and Qantas `ECECAB` when linked canonical sources exist.

Acceptance gates:

- Jetstar proposes exactly two ordered legs JQ223/JQ224.
- Hertz remains hire-car Booking data, not Booking legs.
- Booking.com remains accommodation.
- Discovery Cruise remains activity.
- December Qantas/Hertz do not get auto-assigned to ANZ by enrichment.
- no new Trip creation is proposed or possible.
- manual fields remain protected.

- [ ] **Step 8: Apply enrichment only after the dry-run is clean**

Use the exact confirmation gate:

```bash
GMAIL_BOOKING_ENRICHMENT_CONFIRM=gmail-booking-enrichment-v0.14.0-apply npm run job:gmail:booking-enrichment -- --apply
```

Immediately rerun dry-run and verify idempotency: no duplicate Booking Legs and no further material changes.

- [ ] **Step 9: Deploy v0.14.0 and verify production runtime**

Use the established exact-commit Railway deployment method if the GitHub webhook is stale. Verify deployment metadata references the intended merge commit, runtime logs contain `preston.ai v0.14.0 listening on 8080`, and `/health` returns version `0.14.0`.

- [ ] **Step 10: Production smoke checks**

Verify:

1. `/` shows one card per active upcoming/current Trip and structured child rows.
2. Queenstown shows Jetstar JQ223/JQ224 if enrichment applied successfully.
3. `/trips` shows active/current plus past-unarchived groups and an Archived Trips link.
4. `/trips/archived` loads and is empty/appropriate before the user archives historical Trips.
5. Trip detail shows Stage terminology, type badges, and correct Next behavior.
6. `/bookings/new?trip_id=<active>` and the same route for an archived test Trip preserve the selected Trip.
7. No archive action has been run on Bowral or Queenstown by deployment automation.

- [ ] **Step 11: Final full-suite evidence and commit**

Run `npm test` one final time against the exact release head and retain CI evidence.

Commit:

```bash
git add src/branding.js package.json package-lock.json test/smoke.test.js test/v0140-static-safety.test.js test.js
git commit -m "release: preston.ai v0.14.0"
```

---

## Self-Review Against the Approved Spec

- Structured Booking detail and multi-leg transport: Tasks 1, 2, 4, 5.
- Booking-level/manual authority preservation: Tasks 2, 5, 6, 7.
- No guessing / provider-first parsing: Task 4.
- Targeted canonical enrichment only: Task 6 and Task 13 rollout gates.
- One card per Trip on home page, no N+1: Tasks 11 and 12.
- Planned Workout-style compact child rows: Task 12.
- Derived type badges and inventory: Tasks 8 and 9.
- Time-aware Next logic: Tasks 8 and 9.
- Single canonical Booking editor and Stage terminology: Tasks 7 and 9.
- Archived Trips manually selectable/editable: Tasks 7 and 10.
- Reversible manual archive, status transition, idempotency: Tasks 3 and 10.
- Past-unarchived list and archived list ordering: Task 10.
- Archived exclusion from reminders and active/upcoming lists: Tasks 3 and 10.
- Gmail new-match exclusion and existing archived-assignment lock: Task 5.
- Gmail never mutates archived Trip fields: Tasks 5, 6, 13 static safety.
- Bowral/Queenstown remain unarchived during release: Global Constraints and Task 13.
- Full CI/UAT/production gates: Task 13.

No automatic Stage creation, automatic Trip archiving, live flight status, map routing, spend tracking, boarding-pass work, or full historic Gmail replay is included.
