# preston.ai v0.14.0 — Travel Intelligence & Trip Archive Design

Date: 2026-09-14
Status: Proposed for review
Target release: v0.14.0
Repository: `ppodolske/preston-run`
Production branch: `build/preston-ai-v0.11.0`

## 1. Summary

v0.14.0 makes the existing Trip / Booking / Event model more useful without replacing it.

The release adds four related capabilities:

1. richer structured Booking detail, including flight/service numbers and multi-leg transport data;
2. one compact travel card per Trip on the preston.ai home page, with child Booking/Event rows formatted in the same visual language as Planned Workouts;
3. clearer Trip detail presentation, including booking-type badges and a clearer meaning for existing Trip Segments; and
4. reversible Trip archiving that preserves all linked records and protects archived Trips from inappropriate new Gmail auto-linking.

The existing architecture remains authoritative:

- **Trip** = travel container / journey.
- **Booking** = reservation or confirmation.
- **Booking Leg** = one transport leg inside a Booking, used only when a Booking has route-specific child legs.
- **Trip Segment** = optional user-defined stage or stop within a Trip.
- **Life Admin Event** = scheduled event that may be linked to a Trip.
- **Gmail source** = evidence/provenance, never the primary travel object.

This release does not turn preston.ai into a full travel-management product. It deliberately avoids live airline status, boarding passes, automated routing, spend tracking, automatic Trip archiving, and automatic Stage generation.

## 2. Goals

### 2.1 User-visible goals

A user should be able to glance at the preston.ai front page and understand the important structure of an upcoming Trip without opening Gmail or the Trip page.

For example, one Queenstown Trip card may contain compact rows such as:

- `Jetstar · JQ223 / JQ224 · 15–22 Aug · Ref QNRY8J`
- `Accommodation · 15–22 Aug · Queenstown`
- `Hire car · 15 Aug 5:00pm – 22 Aug 4:00pm · Ref L5920779422`
- `Activity · 17 Aug · 1:00–3:00pm · Ref 372492184`
- `Event · 17 Aug · 6:30–8:00pm · Ref 95640384`

The Trip detail page should show the same facts in more visual badge/chip form rather than duplicating the front-page line verbatim.

Completed historical Trips should be manually archivable and later unarchivable without losing any data.

### 2.2 Data-quality goals

Where source evidence provides the information, Booking extraction should persist:

- provider;
- confirmation reference;
- booking type;
- status;
- start datetime;
- end datetime;
- timezone;
- origin;
- destination;
- location;
- booking URL;
- flight/service number(s);
- transport legs and their individual departure/arrival facts.

Missing facts remain null. The system must not guess dates, times, references, locations, service numbers, or routes.

### 2.3 Architecture goals

- Preserve the v0.13 Trip / Booking / Event split.
- Reuse existing `booking_type`, `trip_id`, and `segment_id` fields rather than inventing parallel classification systems.
- Keep manual-field authority protections intact.
- Avoid N+1 dashboard queries.
- Make archive lifecycle independent from Trip travel status.
- Keep Gmail automation conservative around archived Trips.

## 3. Non-goals

v0.14.0 will not add:

- live flight status;
- airline API integrations;
- terminals, gates, seat assignments, boarding passes or baggage allowances;
- hotel room details;
- travel spend / budgeting;
- automatic Trip Stage generation;
- automatic Trip archiving;
- map routing;
- itinerary optimisation;
- a general-purpose universal event table;
- automatic reassignment of ambiguous December Qantas/Hertz records into the manual ANZ Trip.

## 4. Current-state findings driving this design

The current v0.13 model is structurally sound but presentation and data capture are inconsistent in several places.

### 4.1 Booking UI duplication

There are two Booking-editing paths today:

- the standalone `/bookings` flow; and
- a second Booking form path inside the Trip routes/pages.

They have already drifted. The standalone flow supports the `transport` booking type and captures `origin`/`destination`; the Trip-local flow does not expose the same complete set of fields.

v0.14.0 will remove this duplication from user-facing behaviour.

### 4.2 Trip Segments are underused

Bookings already support nullable `segment_id`, but production currently has almost no segment-linked Bookings. The existing Segment concept is useful as a multi-stop Trip stage, but it should not be overloaded to mean Booking type.

### 4.3 Dashboard Trip data is too shallow

The home page currently loads upcoming Trips without their Bookings/Events and shows only basic Trip metadata. It therefore cannot display useful travel intelligence despite the richer Booking records now available.

### 4.4 Flight extraction is not structured enough

Provider-specific Gmail extraction can identify booking references, dates and routes, but flight numbers and multi-leg structure are not persisted as first-class data.

### 4.5 Trip lifecycle has no archive dimension

Trip status currently captures travel lifecycle (`planning`, `upcoming`, `in_progress`, `completed`, `cancelled`) but there is no independent way to remove historical Trips from active views while retaining their records.

## 5. Data model

### 5.1 Trips

Add:

```sql
trips.archived_at timestamptz null
```

`archived_at` is independent from `status`.

Rules:

- null = active/unarchived;
- non-null = archived;
- archiving does not delete or detach any linked record;
- unarchiving clears `archived_at` only;
- archive/unarchive is a manual user action;
- Gmail never archives or unarchives Trips.

When a non-cancelled Trip is archived, its status becomes `completed` in the same user action. A `cancelled` Trip remains `cancelled` when archived.

When a Trip is unarchived, its status is not automatically changed back. For example, a completed Trip remains completed until the user edits it.

### 5.2 Bookings

The existing Booking remains the canonical reservation-level object.

No transport-specific columns such as `flight_number_1` or `flight_number_2` will be added to `bookings`.

Existing top-level Booking fields remain authoritative for the reservation-level summary:

- `booking_type`;
- `provider`;
- `confirmation_reference`;
- `starts_at`;
- `ends_at`;
- `time_zone`;
- `location`;
- `origin`;
- `destination`;
- `booking_url`;
- `status`;
- `trip_id`;
- `segment_id`;
- manual-field metadata.

### 5.3 Booking Legs

Add a child table for transport-leg detail:

```text
booking_legs
- id uuid primary key
- user_id uuid not null
- booking_id uuid not null
- position integer not null
- service_number text null
- origin text null
- destination text null
- departs_at timestamptz null
- arrives_at timestamptz null
- departure_time_zone text null
- arrival_time_zone text null
- source_metadata jsonb not null default '{}'
- created_at timestamptz not null
- updated_at timestamptz not null
```

Constraints / indexes:

- owner-safe composite FK to Booking (`booking_id`, `user_id`);
- positive `position`;
- unique `(booking_id, position)`;
- index `(booking_id, position)`;
- RLS equivalent to Bookings;
- no nullable user ownership.

`booking_legs` is intended primarily for flights and transport bookings. Accommodation, hire car, ordinary activity and event records should not get synthetic leg rows.

### 5.4 Booking Leg manual authority

Booking Legs created or edited manually must be protected from Gmail in the same spirit as Booking manual fields.

Preferred implementation:

```json
{
  "source": "gmail" | "manual",
  "manual_fields": ["service_number", "origin", "destination", "departs_at", "arrives_at", "departure_time_zone", "arrival_time_zone"],
  "source_record_ids": ["..."]
}
```

A later Gmail scan may enrich unprotected fields but must not overwrite manually protected leg fields.

### 5.5 Trip Segments

No schema change is required for `trip_segments` in v0.14.0.

The UI label changes from **Segment** to **Stage** wherever practical.

Semantic definition:

> A Stage is a meaningful part or stop of a multi-part Trip, such as Sydney, Brisbane, or Melbourne. It is not a Booking type.

Examples of appropriate Stages:

- Sydney;
- Brisbane;
- Melbourne;
- Queenstown / Te Anau if the user wants to separate them.

Examples that should remain Booking types rather than Stages:

- Flight;
- Accommodation;
- Hire car;
- Activity.

Automatic Stage generation is out of scope for v0.14.0.

## 6. Gmail extraction and canonicalisation

### 6.1 Extraction contract

Provider extraction returns the existing Booking candidate plus optional `legs`.

Example:

```js
{
  booking_type: 'flight',
  provider: 'Jetstar',
  confirmation_reference: 'QNRY8J',
  title: 'Sydney → Queenstown flights',
  starts_at: '...',
  ends_at: '...',
  origin: 'Sydney',
  destination: 'Queenstown',
  legs: [
    {
      position: 1,
      service_number: 'JQ223',
      origin: 'Sydney',
      destination: 'Queenstown',
      departs_at: '...',
      arrives_at: '...',
      departure_time_zone: 'Australia/Sydney',
      arrival_time_zone: 'Pacific/Auckland'
    },
    {
      position: 2,
      service_number: 'JQ224',
      origin: 'Queenstown',
      destination: 'Sydney',
      departs_at: '...',
      arrives_at: '...',
      departure_time_zone: 'Pacific/Auckland',
      arrival_time_zone: 'Australia/Sydney'
    }
  ]
}
```

Provider-specific parsing remains preferred over generic regex matching.

### 6.2 Canonical leg identity

For an existing Booking, Gmail leg upsert identity is:

1. `booking_id + position` when the parser has a complete ordered itinerary; otherwise
2. exact strong shape: service number + origin + destination + departure datetime.

The implementation must not create duplicate leg rows when the same source is processed twice.

If a later email supplies better detail for an existing leg, it may enrich unprotected fields.

### 6.3 Booking-level dates from legs

For transport Bookings with valid legs:

- top-level `starts_at` may derive from the first leg departure;
- top-level `ends_at` may derive from the last leg arrival or departure when arrival is unavailable;
- top-level `origin` derives from the first leg origin;
- top-level `destination` represents the Trip-facing destination for the Booking, not necessarily the final airport of a round trip.

Provider-specific candidate logic remains responsible for choosing the appropriate Booking-level destination. The leg table does not replace the existing Trip-linking geography rules.

### 6.4 No guessing

A flight number or time is persisted only when supported by source evidence. A source containing only a date must not get an invented time.

## 7. Targeted canonical enrichment

v0.14.0 includes a controlled enrichment operation for existing canonical Bookings.

It must:

- operate only on canonical Booking source links already present in `booking_source_links`;
- reread only those source messages;
- never replay the entire historic Gmail corpus;
- never create a new Trip solely because an existing canonical Booking is being enriched;
- preserve manual fields;
- be dry-run by default;
- have an explicit apply confirmation gate;
- be idempotent;
- report before/after Booking and leg facts per canonical Booking.

The initial production candidates include the currently canonical travel Bookings such as Jetstar `QNRY8J`, Hertz reservations, Booking.com Bowral, Airbnb, Discovery Cruise and Qantas `ECECAB`.

The enrichment process does not auto-link the ambiguous Qantas/Hertz December records to ANZ.

## 8. Home-page Trip travel cards

### 8.1 One card per Trip

The preston.ai home page displays one card for each active upcoming/current Trip rather than one top-level card per Booking.

Archived Trips are excluded.

Each Trip card contains:

1. Trip header;
2. Trip dates / state;
3. compact child rows for relevant Bookings and linked Events.

### 8.2 Visual language

Child rows intentionally mirror the Planned Workout pattern:

- small contextual/state line where useful;
- strong item title;
- muted metadata line built from structured values separated by ` · `.

The home page should not render raw source-email text.

### 8.3 Booking summary formatter

Create a reusable domain/presentation formatter that produces structured summary tokens, not pre-escaped HTML.

Examples:

Flight:

```text
Jetstar · JQ223 / JQ224 · 15–22 Aug · Ref QNRY8J
```

Accommodation:

```text
Accommodation · 11–13 Sep · Check-in 3:00pm · Ref 5072736754
```

Hire car:

```text
Hire car · 15 Aug 5:00pm – 22 Aug 4:00pm · Ref L5920779422
```

Activity:

```text
Activity · 17 Aug · 1:00–3:00pm · Ref 372492184
```

Event:

```text
Event · 17 Aug · 6:30–8:00pm · Queenstown · Ref 95640384
```

Token inclusion rules:

- omit missing values rather than rendering placeholders;
- do not display `null`, `Unknown`, zero times, or synthetic references;
- prefer service/flight number before confirmation reference;
- preserve provider name when useful;
- format times in the record’s own timezone;
- use concise date ranges when start/end span multiple days.

### 8.4 Dashboard data access

Avoid N+1 queries.

Preferred flow:

1. query active upcoming/current Trips;
2. collect Trip IDs;
3. fetch all linked Bookings for those Trip IDs in one query;
4. fetch all linked Life Admin Events for those Trip IDs in one query;
5. fetch Booking Legs for the returned Booking IDs in one query;
6. construct Trip-card view models in memory.

No per-Trip or per-Booking database loop is acceptable.

### 8.5 Card item ordering

Within a Trip card, child items sort by effective start time:

- Booking `starts_at`;
- Event `starts_at`;
- undated records last.

Ties fall back to Booking position / title.

Cancelled Bookings may remain visible but must visibly carry cancelled state and must not be presented as an active next action.

## 9. Trip detail presentation

### 9.1 Type badges

Trip detail Booking/Event rows use derived visual badges/chips.

Examples:

```text
FLIGHT   JQ223   SYD → ZQN   15 AUG
FLIGHT   JQ224   ZQN → SYD   22 AUG
JETSTAR  REF QNRY8J
```

```text
STAY   11–13 SEP   2 NIGHTS
BOOKING.COM   REF 5072736754
```

```text
CAR   15–22 AUG
HERTZ   REF L5920779422
```

Badges are presentation only. No separate database badge system is introduced.

### 9.2 Booking type summary on Trip header/card

Trip card/detail header shows a concise inventory derived from linked records, for example:

```text
Flight · Stay · Car · 2 Activities
```

Counts are derived from linked Bookings/Events and are not persisted.

### 9.3 Correct “Next” logic

The existing Trip detail “Next” concept must become time-aware.

Rules:

- choose the earliest non-cancelled itinerary entry whose relevant end/start time has not fully passed;
- if an entry has `ends_at`, it remains current until `ends_at`;
- otherwise use `starts_at`;
- completed historical Trips with no future/current item render no “Next” card;
- archived Trips render no “Next” card unless an explicit future item still exists, which would be an unusual but valid state worth surfacing.

## 10. Booking editor consolidation

There will be one canonical Booking editor.

### 10.1 Routing

- Add Booking globally: `/bookings/new`
- Add Booking from Trip: `/bookings/new?trip_id=<trip-id>`
- Edit Booking: `/bookings/<booking-id>/edit`

Legacy nested Trip Booking creation routes redirect to the canonical editor for compatibility.

### 10.2 Field parity

The canonical editor must expose all supported Booking fields consistently, including:

- booking type, including `transport`;
- Trip;
- Stage;
- provider;
- confirmation reference;
- start/end;
- timezone;
- location;
- origin;
- destination;
- booking URL;
- notes.

Booking Legs display beneath transport Bookings. Manual leg editing is allowed but remains intentionally lightweight rather than becoming a full airline itinerary editor.

### 10.3 Archived Trips in manual Booking editing

Automation excludes archived Trips, but manual editing must remain capable of maintaining historical records.

Rules:

- the Trip selector groups active and archived Trips distinctly;
- an existing Booking linked to an archived Trip remains editable with that Trip selected;
- a user may manually assign or reassign a Booking to an archived Trip;
- the Add Booking action from an archived Trip detail page preselects that archived Trip;
- these manual actions receive normal `manual_fields` protection and must not later be undone by Gmail.

## 11. Archive lifecycle

### 11.1 Active Trip list

Normal `/trips` shows unarchived Trips only.

It has distinct presentation for:

- Coming Up / current Trips; and
- Past, unarchived Trips that have ended but have not yet been archived.

A Trip can therefore remain visible after its dates have passed until the user chooses Archive. The UI may label it `Ended yesterday`, `Ended 3 days ago`, etc., without silently mutating its stored status.

This is the path the user will use to archive Bowral and Queenstown after v0.14.0 is validated.

The page also contains an obvious link/action to **Archived Trips**.

### 11.2 Archived Trip list

`/trips/archived` lists Trips where `archived_at is not null`.

Ordering is deterministic:

1. `end_date` descending, nulls last;
2. `start_date` descending, nulls last;
3. `archived_at` descending;
4. title ascending.

Archived Trip detail remains fully viewable and manually editable. Archive means historical visibility state, not read-only state.

### 11.3 Archive action

Route:

```text
POST /trips/:id/archive
```

The action:

- requires authenticated owner and same-origin POST;
- sets `archived_at = now()`;
- if current status is not `cancelled`, sets status to `completed`;
- leaves all Bookings, Stages, Events, Tasks and provenance intact;
- redirects back to a stable Trip/archive view with flash confirmation.

Calling Archive on an already archived Trip is idempotent and does not alter `archived_at` again unless the implementation explicitly chooses to treat it as a no-op response. The preferred behaviour is no-op success.

### 11.4 Unarchive action

Route:

```text
POST /trips/:id/unarchive
```

The action:

- clears `archived_at`;
- leaves current status unchanged;
- leaves linked records untouched;
- is idempotent when the Trip is already unarchived.

### 11.5 Archive is not delete

Deletion guard behaviour remains independent. Archiving must never call Trip deletion code or require linked records to be detached.

## 12. Gmail behaviour with archived Trips

Archive awareness is mandatory to prevent duplicate Trip creation.

### 12.1 New Booking candidate

When Gmail processes a new Booking candidate with no existing canonical Booking:

- archived Trips are excluded from automatic Trip-link candidates;
- a new Booking may link to an active compatible Trip;
- if no active compatible Trip exists, existing conservative create/review/none rules apply.

### 12.2 Existing canonical Booking already linked to archived Trip

If Gmail identifies an existing Booking whose `trip_id` points to an archived Trip:

- Gmail may enrich/update unprotected Booking fields;
- Gmail may enrich/update unprotected Booking Legs;
- the existing archived `trip_id` is treated as a hard preservation lock for automation;
- the Booking must not be moved to another Trip;
- Gmail must not create a replacement Trip for that Booking;
- no review task is needed solely because the existing Trip is archived.

A manual Trip assignment remains a stronger lock than automation state, as in v0.13.

### 12.3 Archived Trip itself

Gmail must never update the archived Trip’s title, dates, geography, status or archive state as part of ordinary Booking processing.

## 13. Upcoming / current Trip selection

Archived Trips are excluded from the normal `getUpcomingTrips` result.

Trip date/status presentation may derive user-facing context such as:

- `Today`;
- `Tomorrow`;
- `In 5 days`;
- `In progress`;
- `Ended 2 days ago`.

These display states do not themselves persist status changes.

The only automatic status change introduced in this release is the explicit manual Archive action setting non-cancelled Trips to completed.

Archived Trips are also excluded from scheduled Trip-level reminder generation. Linked Life Admin Events retain their own lifecycle and are not silently deleted, completed or hidden merely because their Trip is archived.

## 14. Error handling and safety

### 14.1 Schema migration

Migration must be additive and backwards-compatible:

- `trips.archived_at` nullable;
- new `booking_legs` table;
- owner-safe FKs;
- RLS/grants;
- indexes included in the same migration.

No existing Booking/Trip data is deleted or rewritten by the schema migration.

### 14.2 Enrichment

Existing Booking enrichment must be:

- targeted;
- dry-run-first;
- apply-gated;
- idempotent;
- observable through a structured report;
- incapable of deleting Trips/Bookings/Events.

### 14.3 Archive protection

Archive routes must be explicit POST actions. No GET request may mutate archive state.

### 14.4 Manual authority

All v0.13 manual-field protections remain mandatory for Booking fields. Equivalent protections apply to manually edited Booking Legs.

## 15. Testing strategy

### 15.1 Domain tests

Test:

- booking-summary token formatting for each Booking type;
- missing-value omission;
- timezone-aware date/time formatting;
- type inventory/count formatting;
- current/future “Next” selection;
- archived Trip exclusion from active/upcoming lists;
- ended-unarchived Trip presentation;
- archive status transition rules;
- archive/unarchive idempotency;
- unarchive status preservation.

### 15.2 Extractor tests

Use production-shaped fixtures for:

- Jetstar `QNRY8J` with JQ223 and JQ224;
- Qantas `ECECAB` service/route extraction where present;
- Hertz pickup/drop-off time parsing;
- Booking.com check-in/check-out facts;
- activity/event time parsing.

Prove:

- RED before parser implementation;
- exact flight/service number extraction;
- leg ordering;
- no duplicate legs after rerun;
- missing times remain null;
- legal-policy text does not create false cancellation state.

### 15.3 Data-layer tests

Test:

- booking-leg CRUD ownership;
- Gmail leg upsert/idempotency;
- manual leg field locks;
- archived filtering;
- manual assignment to archived Trips;
- batch retrieval for dashboard Trip view models.

### 15.4 Route/UI tests

Test:

- canonical Booking editor parity;
- legacy nested add-Booking redirect;
- archived Trip present in manual Booking selector;
- archive/unarchive POST controls;
- archived list visibility/order;
- past-unarchived list visibility;
- archived detail access/editing;
- no Next card for fully historical Trip;
- dashboard one-card-per-Trip composition.

### 15.5 Gmail archive tests

Test all three cases:

1. new Booking cannot auto-link to archived Trip;
2. existing Booking attached to archived Trip stays attached when updated;
3. existing archived Booking does not cause a replacement Trip to be generated.

### 15.6 Reminder tests

Test:

- archived Trips do not produce Trip-level reminders;
- unarchiving makes the Trip eligible for Trip reminder logic again when dates/status otherwise qualify;
- linked Life Admin Events are not altered by Trip archive state.

### 15.7 Release verification

Before production apply:

- full CI green;
- migration applied in UAT/dev environment first;
- targeted enrichment dry-run reviewed;
- dashboard smoke test;
- Trip detail smoke test;
- archive/unarchive tested on a test Trip, not Bowral or Queenstown.

Production release must leave Bowral and Queenstown unarchived. The user will archive them manually only after validating the feature.

## 16. Rollout plan

### Phase A — Schema and domain

- add `archived_at`;
- add `booking_legs`;
- add indexes/RLS/FKs;
- add archive filtering/data access;
- add leg data access and validation.

### Phase B — Rich Booking extraction

- extend provider candidate contract with optional legs;
- implement Jetstar leg/service-number parsing first;
- extend other providers only where reliable evidence exists;
- add canonical leg upsert/manual protection.

### Phase C — Booking UI consolidation

- canonicalise `/bookings` editor;
- Trip “Add booking” links into canonical editor with preselected Trip;
- redirect/remove duplicate user-facing nested form logic;
- add lightweight transport leg presentation/edit support;
- keep archived Trips available for explicit manual assignment.

### Phase D — Trip detail UX

- rename Segment presentation to Stage;
- add booking/event badges;
- add booking-type inventory;
- improve itinerary rows;
- correct Next logic.

### Phase E — preston.ai front-page travel intelligence

- batch-fetch Trip Bookings/Events/Legs;
- build reusable Trip travel view model;
- render one Trip card with compact metadata child rows;
- match Planned Workout visual hierarchy.

### Phase F — Archive lifecycle

- archive/unarchive routes;
- active/past-unarchived/archived list separation;
- archived-state UI;
- status transition on archive;
- reminder exclusion.

### Phase G — Gmail archive safety

- exclude archived Trips from new auto-link candidates;
- preserve archived assignment for existing canonical Booking;
- prevent duplicate replacement Trip creation.

### Phase H — Targeted enrichment and release

- dry-run enrichment of current canonical Booking source links;
- inspect proposed leg/detail updates;
- apply only after clean report;
- verify idempotency;
- deploy v0.14.0;
- user manually archives historical Trips after validating behaviour.

## 17. Acceptance criteria

v0.14.0 is complete only when all of the following are true:

1. The home page shows one card per active upcoming/current Trip.
2. Each Trip card can show compact Booking/Event rows using the Planned Workout metadata visual hierarchy.
3. Flight rows show structured flight/service numbers when available from source evidence.
4. Jetstar `QNRY8J` can represent JQ223 and JQ224 as separate ordered legs without creating duplicate Bookings.
5. Booking reference, dates, times, provider, route/location and URL remain visible/editable at Booking level where available.
6. Trip detail uses derived badges/chips and can show transport legs clearly.
7. Booking type badges are derived from existing Booking/Event data rather than persisted separately.
8. Trip Segments are presented as optional Stages, not Booking-type categories.
9. There is one canonical Booking editor with field parity.
10. Manual Booking editing can maintain or assign historical Bookings to archived Trips, while Gmail automation cannot auto-link new Bookings to archived Trips.
11. Trip “Next” points to the earliest current/future itinerary item rather than the first historical item.
12. Past unarchived Trips remain visible with an Archive action until the user archives them.
13. Archive is reversible and preserves every linked Booking, Stage, Event, Task and Gmail source link.
14. Archiving a non-cancelled Trip marks it completed; archiving a cancelled Trip preserves cancelled status.
15. Archive and Unarchive actions are idempotent.
16. Unarchive clears archive state without silently changing status.
17. Archived Trips disappear from active/home upcoming lists and remain accessible/editable in Archived Trips.
18. Archived Trips do not generate Trip-level reminders.
19. New Gmail candidates do not auto-link to archived Trips.
20. Existing canonical Bookings already attached to archived Trips stay attached when Gmail updates them.
21. Gmail never creates a replacement Trip solely because an existing Booking’s Trip is archived.
22. Targeted enrichment is dry-run-first, apply-gated and idempotent.
23. Bowral and Queenstown are not archived by the release process itself.
24. Full CI and production smoke verification pass before release completion.

## 18. Key decisions

The design intentionally makes these choices:

- **Booking Legs are a child table, not JSON and not fixed flight-number columns.** This supports multiple legs, relational integrity, manual-field protection and idempotent updates.
- **Trip archive is `archived_at`, not another Trip status.** Archive is a visibility/lifecycle dimension independent of completed/cancelled travel state.
- **Archive marks non-cancelled Trips completed.** This prevents archived Trips remaining semantically `planning`.
- **Unarchive does not restore the old status automatically.** Status remains explicit and predictable.
- **Trip Segments remain but are presented as Stages.** Booking types remain Booking types.
- **The home page shows one Trip card with compact child rows, not separate top-level travel cards.**
- **Badges are derived UI, not persisted classification data.**
- **Archived Trips remain manually editable and manually linkable, but are excluded from automatic Gmail linking.**
- **Past Trips are not auto-archived.** They remain visible until the user explicitly archives them.
- **No automatic Stage creation or automatic Trip archiving in v0.14.0.**
- **No full historical Gmail replay.** Existing canonical source links are the enrichment boundary.

## 19. Future extensions deliberately deferred

This design leaves clean extension points for later releases without committing v0.14.0 to them:

- live transport status providers;
- richer airport/station codes;
- terminal/gate fields;
- boarding-pass attachments;
- automatic Stage suggestions;
- map view;
- trip cost aggregation;
- packing / travel checklist integration;
- weather at destination;
- calendar export/import of structured Booking legs.

These should be evaluated from actual usage after v0.14.0 rather than pre-built now.
