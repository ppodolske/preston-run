# preston.ai Trip / Booking / Event Linkage Design

Date: 2026-09-14
Status: Approved design, pending implementation plan
Target release: v0.13.0
Repository: ppodolske/preston-run

## Summary

The current Gmail travel pipeline models an email confirmation as if it were a trip. That is the wrong entity boundary.

The corrected model is:

**Gmail source → Booking or Event → optional Trip**

A Gmail message is evidence about a real-world booking or event. The booking/event is the primary object. A trip is a higher-level grouping that may contain several bookings, events, itinerary segments, and tasks.

This release will make bookings independently storable, allow both bookings and Life Admin events to link to trips, replace the current Gmail trip-creation path with booking-first ingestion, improve extraction of booking facts such as provider/date/location/reference, give trips structured destination geography, and repair the historical Gmail-created trip shells without rerunning the full 523-message backfill.

## Problem statement

Production currently contains 29 trips, of which 28 are Gmail-generated empty trip shells and one (`ANZ`) is a manually created trip. The Gmail-generated trips have no bookings and no segments. Some were created more than once from the same Gmail source.

The current flow has four defects:

1. Gmail travel evidence creates a trip directly rather than creating or updating a booking.
2. `bookings.trip_id` is required, so a booking cannot exist until a trip already exists.
3. Life Admin event items cannot link to trips.
4. Trip naming is driven by a weak booking-reference extractor, producing nonsense titles such as `Trip booking EMAIL`, `Trip booking REMINDER`, `Trip booking NUMBER`, `Trip booking ERENCE`, and duplicate trip shells.

The system therefore loses the useful real-world entity while preserving the confirmation message as a misleading trip.

## Design goals

### Primary goals

- Make a booking/event the primary real-world object extracted from Gmail.
- Allow a booking or event to exist without a trip.
- Allow any booking or event to be linked to an existing trip manually.
- Allow the Gmail pipeline to suggest or automatically establish a trip link only when confidence is high.
- Derive trip identity and destination from actual travel geography and dates, not from email wording or booking references.
- Store structured trip destination geography independently of the trip title.
- Keep confirmation numbers, provider references, and Gmail source links on the booking/event.
- Prevent duplicate objects when reminders, follow-up emails, or repeated scans refer to the same booking.
- Repair historical Gmail-derived data using only the source records that created the current bad trip shells.
- Preserve manually created trips and manual edits as authoritative.

### Non-goals

- Do not replace all existing domain models with a generic universal event table.
- Do not rerun the full historical 523-message backfill.
- Do not automatically delete the 28 Gmail-generated trip shells until replacement objects and mappings are verified.
- Do not delete or rewrite the manual `ANZ` trip.
- Do not infer a trip when location/date evidence is weak.
- Do not merge operational or diagnostic Gmail-backfill branches into production.

## Domain model

### Gmail source

`gmail_source_records` remains the immutable evidence record for an email message.

It may supply or update facts about a booking/event, but it is never itself a trip.

Relevant source metadata should include, where available:

- `source_record_id`
- `gmail_message_id`
- `gmail_thread_id`
- sender
- subject
- Gmail source link
- extraction/classification version
- extraction confidence

### Booking

The existing `bookings` table remains the canonical object for travel-related reservations.

Examples:

- flight
- accommodation
- hire car
- activity/tour/cruise
- ferry/train/other transport
- other travel booking

A booking may exist with no trip assignment.

Recommended fields after migration:

- `id`
- `user_id`
- `trip_id` nullable
- `segment_id` nullable
- `position`
- `booking_type`
- `title`
- `provider`
- `confirmation_reference`
- `status`
- `starts_at`
- `ends_at`
- `time_zone`
- `location`
- `origin`
- `destination`
- `booking_url`
- `notes`
- `source_metadata`
- timestamps

`origin` and `destination` are explicit fields because travel bookings cannot always be represented by a single `location`. Accommodation and activities may primarily use `location`; flights and point-to-point transport should use origin/destination.

A booking may only have a `segment_id` when it also has a `trip_id`. Unlinking a booking from a trip must clear `segment_id` in the same operation. Moving a booking between trips must clear an incompatible segment assignment unless a segment in the destination trip is explicitly selected.

### Life Admin event

The existing `life_items` table remains the primary home for non-travel Life Admin items, including restaurant reservations and appointments.

For event-like items, add support for:

- `linked_trip_id` nullable
- `ends_at` nullable
- `time_zone` nullable/defaulted appropriately
- `location` nullable
- `provider` nullable
- `confirmation_reference` nullable
- `booking_url` nullable

These fields make a Life Admin event useful as an actual reservation/event object rather than a title plus timestamp.

Examples:

- Cafe Sydney reservation
- restaurant reservation during a trip
- ticketed local event
- appointment that happens to occur while travelling

Linking to a trip must remain optional.

### Trip

A trip is a container/grouping, not a confirmation record.

A trip contains or references:

- linked bookings
- linked Life Admin events
- trip segments / itinerary
- linked tasks

A trip also has structured destination geography independent of its display title:

- `destination_label` — human-readable destination such as `Bowral, NSW`, `Queenstown, New Zealand`, or `Australia & New Zealand`
- `destination_city` — nullable when the trip spans multiple cities
- `destination_region` — state/province/region where meaningful
- `destination_country` — country name or stable country representation

Trip identity should be based on:

- actual date range
- structured destination geography
- user-provided title/manual edits
- existing linked objects

A confirmation number must never determine the trip title or destination fields.

Manual trip fields are authoritative. Gmail automation may fill blank values or suggest changes, but it must not overwrite manually edited trip title, dates, or destination geography without explicit user action.

## Database changes

### Trips

Add nullable structured destination fields:

- `destination_label text`
- `destination_city text`
- `destination_region text`
- `destination_country text`

These fields are descriptive and must not be derived from confirmation text. Automated values must come from extracted booking/event location evidence.

Add an index suitable for user/date/destination matching. Do not require every trip to have structured geography; existing/manual trips remain valid with null destination fields.

### Bookings

Alter `bookings.trip_id` from required to nullable.

Update foreign-key behavior so an unlinked booking remains valid. Existing linked bookings must continue to enforce ownership and referential integrity.

Add:

- `origin text`
- `destination text`

Retain current `location` for venue/property/general place text.

Retain `source_metadata jsonb` and use it for Gmail identity and provenance.

Add a constraint equivalent to:

`segment_id IS NULL OR trip_id IS NOT NULL`

The application must additionally ensure that moving/unlinking a booking cannot leave a segment from the previous trip attached.

Add indexes supporting:

- unlinked bookings by user/date
- bookings by confirmation reference/provider
- trip-linked bookings by user/trip/date

### Life items

Add nullable `linked_trip_id uuid` with an owner-safe composite foreign key to `trips(id, user_id)`.

Add event detail fields:

- `ends_at timestamptz`
- `time_zone text`
- `location text`
- `provider text`
- `confirmation_reference text`
- `booking_url text`

Add indexes for linked-trip and event-date retrieval.

### Gmail identity / deduplication

A Gmail-origin booking should be idempotent by stable booking identity, preferring the strongest available key:

1. provider + normalized confirmation reference
2. known provider booking URL / provider booking identifier
3. Gmail thread identity when the thread clearly represents a single booking
4. source record as final fallback

The system must not treat the Gmail message ID alone as the booking identity when multiple messages describe the same reservation.

A booking may accumulate multiple Gmail source references in `source_metadata` or an associated source-link table if implementation complexity warrants it. The implementation plan should prefer the smallest schema that supports multiple sources without destructive overwrites and preserves reliable idempotency.

## Gmail classification and extraction

### Intent routing

The current high-level intents remain useful:

- travel booking
- Life Admin
- review
- ignore

However, the travel path no longer means “create trip.” It means “extract/resolve booking, then evaluate trip linkage.”

Restaurant reservations continue through Life Admin/event handling, not travel booking by default.

### Booking extraction

Replace the current loose reference regex with provider-aware and context-aware extraction.

The extractor should produce a structured booking candidate containing as much of the following as can be established confidently:

- booking type
- provider
- true confirmation/reference number
- title/description
- starts/ends
- time zone
- venue/property
- origin
- destination
- city
- state/region
- country
- booking URL
- cancellation/change status
- source record metadata
- confidence for each major field or overall candidate

The parser must not accept generic words such as:

- EMAIL
- REMINDER
- NUMBER
- CONFIRMED
- DISCOVERY
- PRESTON
- ERENCE

as booking references merely because they appear near words such as confirmation or reservation.

Known-provider rules should be added for high-value common sources observed in production, including at minimum:

- Qantas
- Jetstar
- Booking.com
- Airbnb
- Hertz
- FareHarbor / Cruise Te Anau pattern

Generic fallback parsing remains useful but should be more conservative than the current implementation.

### Examples of correct extraction

- Qantas email: booking reference `ECECAB`; Sydney → Brisbane; travel date 18 Dec 2026.
- Jetstar itinerary: booking reference `QNRY8J`; outbound/inbound flight details around 15–22 Aug 2026.
- Booking.com Belle in Bowral: booking reference `5072736754`; accommodation in Bowral, NSW.
- Hertz: confirmation `L5920779422` or `L661E0FC0A1`; pickup/drop-off location/date from the reservation body.
- Cruise Te Anau: activity/cruise booking with its real booking number, date/time, Te Anau location, and provider.

## Gmail booking upsert flow

For a travel-classified source:

1. Read/normalize the Gmail message.
2. Extract a structured booking candidate.
3. Resolve an existing booking using strong booking identity.
4. If matched, update only fields supported by stronger/newer evidence and preserve manual fields.
5. If not matched, create an unlinked booking.
6. Record Gmail provenance/activity against the booking.
7. Evaluate trip linkage separately.
8. If linkage confidence is insufficient, leave the booking unlinked and surface it for review.

A reminder or follow-up email must update/reinforce an existing booking, not create a new booking or trip.

## Life Admin event linkage

Every event-type Life Admin item should support a nullable trip link.

UI requirements:

- Life Admin event edit screen contains a `Trip` selector with `No trip` plus existing trips.
- Trip detail page shows linked Life Admin events in chronological order.
- Event cards should display useful event details such as location/provider/reference when present.
- Unlinking an event from a trip must not delete the event.

The same optional linkage behavior applies to manually created and Gmail-created events.

## Booking UI changes

Bookings become independently manageable.

Required behaviors:

- A booking can be created without a trip.
- Booking edit form includes a `Trip` selector.
- Existing nested “add booking to trip” flow may remain as a convenience and should preselect the trip.
- Booking form supports origin/destination in addition to location.
- Booking detail/edit surfaces confirmation reference and Gmail/source link where applicable.
- Moving a booking between trips changes only `trip_id` plus any required segment cleanup; it does not recreate the booking.
- Unlinking a booking from a trip preserves the booking and clears `segment_id`.

The Trips page should not be the only way to access bookings. Implementation should add a practical route to review unlinked bookings, either as a dedicated bookings view or a clearly visible unlinked-bookings section within Trips. The implementation plan should choose the simplest UI consistent with the existing application patterns.

Trip create/edit UI should expose destination geography. `destination_label` is the primary human-facing field; city/region/country may be directly editable or maintained through the same form depending on the existing form patterns, but the stored structured fields must be inspectable and correctable by the user.

## Trip linkage engine

Trip linkage happens after booking/event extraction.

### Matching order

1. Existing manual trip whose date range and geography clearly contain the booking/event.
2. Existing generated trip whose linked objects establish the same journey.
3. No confident match: leave unlinked and request review.
4. Optional high-confidence new-trip creation only where a coherent destination/date grouping is established.

### Geography rules

Use the actual booking details:

- accommodation property city/region
- activity venue/location
- hire-car pickup/drop-off
- transport destination/origin

Email sender location, confirmation wording, and booking reference are not trip geography.

Trip destination fields and display should use human-readable destination geography such as:

- Bowral, NSW
- Queenstown, New Zealand
- Brisbane, QLD

When a high-confidence new trip is created, its structured destination fields must be populated from the extracted booking/event geography. The title may be derived from `destination_label` when no better user-facing title exists, but title text is not the source of truth for geography.

For multi-location journeys, use a user-friendly regional `destination_label` and leave `destination_city` null where a single city would be misleading.

### Date rules

Trip dates are inferred from linked objects only when trip dates are blank or the trip is explicitly automation-managed.

A single booking should not arbitrarily expand or replace manually maintained trip dates.

### Confidence and review

If a booking is genuine but the trip match is ambiguous:

- create/update the booking
- leave `trip_id` null
- create a canonical review item or surface it in an unlinked-bookings review UI

Do not create a placeholder trip just to satisfy a relationship.

## Manual data precedence

Manual user edits win over Gmail automation.

At minimum, protect manually edited:

- trip title
- trip dates
- trip destination label/city/region/country
- booking title
- booking trip assignment
- event trip assignment
- booking/event notes

Where field-level manual provenance already exists, reuse it. Otherwise the implementation plan should add the minimum practical mechanism needed to avoid background Gmail scans silently undoing manual corrections.

## Historical reconstruction

Do not rerun all 523 historical Gmail sources.

The repair scope is limited to the Gmail source records that created the 28 bad Gmail-generated trip shells.

### Reconstruction procedure

1. Snapshot the 29 current trips and all Gmail activity/source mappings.
2. Identify the distinct Gmail source records responsible for the 28 bad trip shells.
3. Re-read only those Gmail messages from Gmail using quota-safe pacing if necessary.
4. Parse them with the new booking-first extractor.
5. Create or update canonical bookings/events idempotently.
6. Deduplicate multiple source messages for the same reservation.
7. Evaluate trip linkage against existing trips, especially the manual `ANZ` trip.
8. Produce an explicit mapping report:
   - old trip shell ID/title
   - Gmail source(s)
   - new booking/event ID
   - assigned trip or unlinked state
   - extracted geography/date evidence
   - reason/confidence
9. Verify counts and inspect ambiguous cases.
10. Only after successful verification, delete obsolete Gmail-generated trip shells and their obsolete Gmail create activity in one guarded transaction.

### Historical safety rules

- Never delete `ANZ` as part of this repair.
- Never delete a trip that contains a real booking, segment, task, Life Admin event link, or manually entered content without explicit review.
- The cleanup transaction must abort if the expected bad-shell set has changed since the mapping report was generated.
- Preserve Gmail source records and extracted evidence needed for auditability.
- Do not delete the original emails.

## Expected reconstruction themes

The repair is expected to consolidate several currently separate shells into coherent objects. Examples from the current data include:

- Belle in Bowral confirmation/follow-up messages → one accommodation booking, likely a Bowral trip or another matching existing trip.
- Jetstar itinerary + Queenstown Hertz rental + Queenstown/Te Anau travel activities → likely one coherent New Zealand journey if dates/geography support it.
- Qantas Sydney → Brisbane 18 Dec 2026 → evaluate against `ANZ` because the travel date falls inside the manual ANZ trip window; do not create a confirmation-named trip.
- repeated Yonder / Cruise Te Anau / Booking.com reminder messages → deduplicate into their underlying reservation/activity objects instead of multiple trips.

These are hypotheses to be confirmed from the actual message bodies during the targeted repair; they are not permission to force a match when evidence disagrees.

## Trip detail presentation

Trip detail should become a coherent itinerary view drawing from all linked object types.

Recommended chronological sections:

- next item
- itinerary timeline combining segments, bookings, and linked events
- bookings
- events
- linked tasks
- manage trip

The trip header should display its structured destination label separately from the title/date range when available.

The timeline should show the actual object title, type, time, and relevant origin/destination/location rather than confirmation metadata.

## Activity / audit behavior

Gmail activity should record the entity actually affected:

- `booking` for booking create/update/link actions
- `life_item` for Life Admin event create/update/link actions
- `trip` only when the trip itself is genuinely created or changed

Trip-link decisions should be auditable with reason and confidence in activity metadata where practical.

A Gmail source should not have repeated `trip create` activity simply because the same source was reprocessed.

## Error handling

- Extraction failure: record error/review state without creating a trip.
- Genuine booking with insufficient fields: create an unlinked booking if identity is reliable; otherwise create a review item.
- Duplicate/upsert race: resolve existing canonical object and continue.
- Trip-match ambiguity: leave unlinked.
- Provider parser regression: fall back conservatively; never manufacture confirmation-derived trip titles.
- Historical repair mismatch: abort cleanup and require a new audit snapshot.

## Testing strategy

### Migration tests

Verify:

- `bookings.trip_id` accepts null.
- booking ownership FK still works when linked.
- `segment_id` cannot remain attached to an unlinked booking.
- moving/unlinking a booking clears or validates segment linkage.
- `life_items.linked_trip_id` owner-safe FK works.
- new Life Admin event detail columns exist.
- booking origin/destination columns exist.
- trip destination label/city/region/country columns exist.
- relevant indexes and constraints exist.

### Extractor tests

Add fixtures/tests for the observed production patterns:

- Qantas ECECAB
- Jetstar QNRY8J
- Booking.com 5072736754
- Hertz L5920779422
- Hertz L661E0FC0A1
- Cruise Te Anau / FareHarbor booking
- negative cases for EMAIL, REMINDER, NUMBER, CONFIRMED, DISCOVERY, PRESTON, ERENCE

### Idempotency tests

Verify:

- confirmation plus reminder resolves to one booking
- repeated scan of one Gmail source does not create another booking
- multiple Gmail sources for one confirmation do not create duplicates
- booking linkage does not recreate the booking

### Trip matching tests

Verify:

- destination/date match links to an existing trip
- manual trip assignment is preserved
- manual trip destination geography is preserved
- ambiguous matches remain unlinked
- a booking reference never becomes a trip title or destination
- high-confidence generated trip geography comes from booking/event details

### UI / route tests

Verify:

- create booking without trip
- link/unlink booking to trip
- link/unlink Life Admin event to trip
- trip create/edit supports structured destination geography
- trip page renders bookings and linked events
- unlinked bookings are visible and actionable

### Historical repair tests

Use a dry-run/mapping mode before any destructive transaction. Verify expected source count, old-shell count, replacement-object count, and safety guard behavior.

## Release and rollout

Target release is **v0.13.0** because this changes core data relationships and Gmail travel behavior rather than patching an isolated defect.

Recommended implementation sequence:

1. Schema migration and data-access support for nullable trip linkage and structured destination geography.
2. Booking/Life Admin/trip UI linkage and destination editing.
3. Booking-first Gmail extraction/upsert pipeline.
4. Trip matcher and review behavior.
5. Production deploy with new scans using the new behavior.
6. Targeted historical reconstruction in dry-run mode.
7. Review mapping.
8. Guarded historical cleanup.
9. Production verification and count audit.

Do not combine schema migration and historical destructive cleanup into the same deploy step.

## Production acceptance criteria

The release is complete when all of the following are true:

- New Gmail travel confirmations create/update bookings, not confirmation-named trips.
- A booking can exist with no trip.
- A Life Admin event can link to or unlink from any trip.
- A booking can link to or unlink from any trip.
- An unlinked booking cannot retain a trip segment.
- Confirmation references are stored on bookings/events, not used as trip titles or destinations.
- Trips store structured destination geography derived from actual booking/event details or manual user input.
- Trip matching uses actual date/location evidence.
- Repeated/reminder emails are idempotent.
- The manual `ANZ` trip remains intact.
- The 28 historical Gmail-generated empty trip shells are either mapped and safely removed or explicitly retained if any cannot be proven obsolete.
- No full 523-message backfill is rerun.
- Production tests and exact-head CI pass.
- Railway deploys the exact tested merge commit.
- Post-deploy audit verifies trip, booking, event, and Gmail-origin counts.

## Open implementation choice

There is one implementation-level choice intentionally left to the plan rather than the architecture: how multiple Gmail source records are represented on a canonical booking/event. The preferred solution is the smallest change that preserves all relevant source links and supports idempotent matching. A dedicated join table is acceptable if storing an array in `source_metadata` would make updates or constraints unreliable.

No other product-level behavior in this document is intentionally unspecified.
