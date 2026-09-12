# Preston.run Life Admin Design

**Date:** 2026-09-13  
**Status:** Approved design baseline  
**Target application:** `ppodolske/preston-run`  
**Current Preston.run version:** v0.4.0

## 1. Purpose

Life Admin is a private operating layer inside Preston.run for personal information that must be remembered, reviewed, renewed, acted on, or surfaced at the right time.

The product boundary is:

> Things in my personal life that I need to remember, renew, buy, check, travel for, or deal with eventually.

Life Admin must not become a generic calendar, email client, password manager, banking system, or project-management app.

The first-class domains are:

1. People and birthdays
2. Life Admin items such as renewals, deadlines, bills, appointments, government/admin, property, subscriptions and memberships
3. Tasks linked to people, Life Admin items, or trips
4. Trips composed from travel bookings and lightweight itineraries
5. Gmail discoveries and automatic record maintenance
6. PWA push notifications
7. Morning Digest integration with Dose & Scale

## 2. Product principles

### 2.1 Private by default

Private data must never be embedded in public HTML, static JSON, client-side source files, GitHub, or localStorage-only state.

Unauthenticated visitors must not receive private counts or private record data from the backend.

### 2.2 Automation can maintain data but must not erase user intent

High-confidence Gmail discoveries may create or update records automatically. Manual edits are authoritative and must not be silently overwritten by future inference.

### 2.3 Review only uncertainty

The Gmail review inbox is not a staging area for every detected email. High-confidence records should be created or updated automatically. Only ambiguous matches, conflicts, or uncertain classification should require review.

### 2.4 Preserve history

Automatic changes, manual changes, cancellations, merges, splits and status transitions must be auditable.

### 2.5 One morning notification

Routine Life Admin information should feed the Dose & Scale Morning Digest and be represented by one morning PWA push, rather than several separate morning notifications.

Standalone push notifications are reserved for meaningful or urgent changes.

## 3. Architecture

### 3.1 Responsibilities

**Preston.run PWA**
- Public home shell
- Authenticated `/me` private area
- People, birthdays, Life Admin, Trips, Gmail review and settings UI
- PWA push subscription management
- Private summary cards on the home page when authenticated

**Supabase**
- Google-backed authentication
- PostgreSQL source of truth for private structured data
- Row Level Security on all exposed private tables
- Ownership scoped to the authenticated user

**Railway backend**
- Gmail OAuth and token handling
- Gmail scanning and classification
- Record matching and trip grouping
- Reminder evaluation
- Web Push delivery
- Private service endpoints consumed by Preston.run and Dose & Scale

**Dose & Scale**
- Remains the morning cockpit
- Reads a private Life Admin morning-summary endpoint
- Does not own Life Admin data or Gmail processing

### 3.2 Authentication

Use Google sign-in through Supabase Auth.

Google sign-in and Gmail access are separate permissions:
- Google sign-in authenticates access to `/me`
- Gmail access is an optional later connection with additional Google scopes

Initial access is restricted to the designated Preston.run owner account. Successful Google authentication by another account does not grant access to private Life Admin data.

Authorization must not rely on user-editable metadata. RLS policies must scope rows to the authenticated owning user.

### 3.3 Private route structure

```text
/me
├── Overview
├── People
│   └── Birthdays
├── Trips
├── Life Admin
├── Inbox
└── Settings
```

## 4. Core data model

### 4.1 Profiles

`profiles`
- `id`
- `user_id`
- display/settings fields
- timestamps

### 4.2 People

`people`
- `id`
- `user_id`
- `name`
- `relationship`
- `birthday_month`
- `birthday_day`
- `birth_year` nullable
- `notes`
- `active`
- timestamps

Birthday year is optional. Unknown years must not be represented with a fake date.

### 4.3 Life Admin items

`life_items`
- `id`
- `user_id`
- `title`
- `category`
- `status`
- `due_at`
- `starts_at`
- recurrence information
- `priority`
- `notes`
- `linked_person_id` nullable
- source metadata
- timestamps

Initial categories:
- renewal
- deadline
- bill
- appointment
- government
- property
- subscription
- membership
- event
- other

Initial statuses:
- upcoming
- needs_action
- waiting
- completed
- ignored

### 4.4 Tasks

`tasks`
- `id`
- `user_id`
- `title`
- `status`
- `due_at`
- `priority`
- `linked_life_item_id` nullable
- `linked_person_id` nullable
- `linked_trip_id` nullable
- `notes`
- timestamps

Tasks are actions. Life Admin items are facts/events/obligations. They must remain distinct.

### 4.5 Trips

`trips`
- `id`
- `user_id`
- `title`
- `start_at`
- `end_at`
- `status`
- `notes`
- flag/metadata indicating manually controlled naming
- timestamps

Trips are containers for related travel bookings.

### 4.6 Trip segments

`trip_segments`
- `id`
- `trip_id`
- `sequence`
- `title`
- `location`
- `starts_at`
- `ends_at`

Segments support multi-city or multi-region travel while preserving one overall trip.

### 4.7 Bookings

`bookings`
- `id`
- `user_id`
- `trip_id`
- `trip_segment_id` nullable
- `booking_type`
- `provider`
- `title`
- `reference`
- `status`
- `starts_at`
- `ends_at`
- `origin`
- `destination`
- `location`
- `notes`
- manual-edit/provenance metadata
- timestamps

Initial booking types:
- flight
- accommodation
- car_rental
- activity
- train
- bus
- restaurant
- event
- other

The lightweight itinerary is generated primarily by sorting bookings chronologically within trip/segment structure. The system must not invent activities to fill gaps.

### 4.8 Gmail sources

`gmail_sources`
- `id`
- `user_id`
- `gmail_message_id`
- `gmail_thread_id`
- `sender`
- `subject`
- `received_at`
- `classification`
- `confidence`
- `processing_status`
- optional links to Life Admin item, booking or task
- structured `extracted_data`
- timestamps

Do not persist full email bodies as the Life Admin source of truth. Gmail remains the source; Preston.run stores message identifiers, provenance and extracted structured values.

### 4.9 Field provenance / manual locks

Important fields must support provenance and manual protection, either through a dedicated field-level table or equivalent metadata.

For each protected field, the system must be able to determine:
- source
- source record/message
- last changed time
- whether the field is manually locked

Manual edits win over inferred metadata. Operational fields such as flight times may continue to auto-update unless explicitly locked.

### 4.10 Reminders

`reminders`
- `id`
- `user_id`
- target `entity_type`
- target `entity_id`
- `trigger_at`
- `reminder_type`
- `status`
- `pushed_at`
- `acknowledged_at`
- snooze metadata

### 4.11 Push subscriptions

`push_subscriptions`
- `id`
- `user_id`
- endpoint
- PWA push key material
- device label
- active flag
- last-used timestamp

Multiple devices are supported.

### 4.12 Activity history

`activity_history`
- `id`
- `user_id`
- `entity_type`
- `entity_id`
- `action`
- `source`
- `old_values`
- `new_values`
- `created_at`

Activity history must record meaningful automatic and manual changes.

## 5. Gmail ingestion and matching

### 5.1 Scope from mailbox discovery

The initial Gmail sweep showed useful recurring signals in these groups:
- renewals and expiries
- action-required notices
- bills and financial notices
- government/admin correspondence
- appointments
- property/inspection notices
- travel bookings
- event registrations
- subscriptions and memberships
- process/status changes

Common noise includes:
- verification codes
- password-reset messages
- generic promotions
- newsletters
- ordinary retail receipts
- post-event marketing
- routine messages with no future consequence

The guiding classifier question is:

> Does this message imply a future date, obligation, decision, booking, material change, or action that the user may otherwise forget?

### 5.2 Processing pipeline

```text
New Gmail message
  → relevance filter
  → classification
  → structured extraction
  → existing-record matching
  → confidence decision
  → auto-create / auto-update OR Needs Review
  → reminder recalculation
  → trip/itinerary recalculation where relevant
  → activity-history entry
```

### 5.3 Initial classifications

- travel_booking
- travel_change
- travel_cancellation
- appointment
- renewal
- subscription
- bill
- deadline
- government_admin
- property
- event_registration
- action_required
- status_change
- other

Each classification must carry confidence.

### 5.4 Matching priority

For travel/bookings, prefer:
1. exact booking reference
2. exact provider + identifiable route/property
3. same Gmail thread
4. strong date + destination overlap
5. existing trip date/location overlap

For Life Admin items, use stable sender/thread identifiers, matching dates, titles/categories and prior source linkage.

### 5.5 Confidence behavior

**High confidence**
- create/update automatically
- log the change
- recalculate dependent reminders/itinerary

**Medium confidence**
- create a review item with suggested action

**Low confidence**
- ignore unless clearly actionable enough to justify review

### 5.6 Updates

Multiple Gmail messages may point to the same booking or Life Admin item.

Example: a later airline schedule-change message updates the existing flight booking rather than creating another flight.

Meaningful updates may trigger standalone push notifications.

### 5.7 Cancellations

Cancellations mark records cancelled. Do not delete the original booking or its history. Dependent reminders must be cancelled or recalculated.

### 5.8 Undo

Automatic Gmail changes must offer a practical undo path. Undo restores prior structured values while preserving source and audit history.

## 6. Trips behavior

### 6.1 Automatic creation

A strong new travel booking may automatically create a trip when no existing trip fits.

### 6.2 Automatic grouping

Bookings are automatically attached to an existing trip only when date/destination evidence is strong.

If confidence is not strong, the booking goes to review with options such as:
- add to suggested trip
- create new trip
- ignore

### 6.3 Multi-city travel

Trips may contain ordered segments. The user can manually combine or split trips.

Example:

```text
USA Trip
├── Sydney → Los Angeles
├── Los Angeles → Minneapolis
├── Minneapolis → Chicago
└── Chicago → Sydney
```

### 6.4 Editing

All trips, segments, bookings, dates, locations, titles and itinerary items are editable.

Manual naming and manual field edits are respected by future automation.

### 6.5 Itinerary

Trip itinerary is intentionally lightweight:
- date/day grouping
- chronological bookings
- flight, accommodation, rental, activity and other booking entries
- direct links to booking/source details

No automatic sightseeing/activity invention in the initial release.

## 7. Notifications and reminders

### 7.1 Delivery channel

PWA Web Push is the only outbound notification channel in scope. Do not build email notification delivery.

### 7.2 Notification classes

- scheduled reminder
- action-required alert
- material-change alert
- batched review-needed alert

### 7.3 Routine reminder defaults

Initial configurable defaults:

**Birthdays**
- 30 days
- 14 days
- 7 days
- 1 day

**Renewals/expiries**
- 60 days
- 30 days
- 14 days
- 7 days
- 1 day

**Bills/deadlines**
- 14 days
- 7 days
- 3 days
- due day

**Appointments**
- 24 hours
- 2 hours

**Trips**
- 14 days
- 7 days
- 1 day

Defaults can be overridden globally or per item.

### 7.4 Standalone push rules

Standalone push is appropriate for:
- flight or booking cancellation
- material time/date/location change
- materially changed renewal cost
- newly urgent action required
- imminent appointment where configured
- other explicitly high-priority events

Do not send standalone push for formatting-only or duplicate Gmail changes.

### 7.5 Review notifications

Review items are batched, e.g.:

> 3 Life Admin items need review

Do not send one push per discovery.

### 7.6 Snooze and acknowledgement

Support:
- tomorrow
- 3 days
- 1 week
- custom date

Acknowledge and complete are distinct concepts. Snoozing a reminder does not modify the underlying due date.

### 7.7 Quiet hours

Global quiet hours are configurable. Default proposal: 10:00 PM to 7:00 AM local time.

Ordinary reminders wait until quiet hours end. High-priority travel cancellation/material-change behavior is configurable.

### 7.8 Deep links

Pushes open the relevant private route, such as:
- `/me/people/:id`
- `/me/trips/:id`
- `/me/items/:id`
- `/me/inbox`

## 8. Morning Digest integration

### 8.1 Principle

Life Admin owns Life Admin data. Dose & Scale owns the morning briefing experience.

### 8.2 Morning flow

```text
Morning scheduled jobs
├── Garmin/recovery sync
├── Gmail Life Admin scan
├── Life Admin reminder evaluation
└── trip/birthday/renewal updates
        ↓
Build Dose & Scale Morning Digest
        ↓
Send ONE PWA morning push
```

Routine Life Admin alerts should be folded into this morning digest.

### 8.3 Digest content

Dose & Scale receives a private summary from Preston.run, for example:
- birthdays coming up
- Life Admin items needing action
- upcoming trips
- overnight trip changes
- Gmail items needing review
- renewals due soon

Dose & Scale displays summaries and deep-links to Preston.run. It does not own or mutate Life Admin data.

### 8.4 Private service endpoint

Preston.run will expose a private authenticated service interface for Dose & Scale to retrieve the current morning summary.

The exact endpoint and service-auth mechanism are implementation details to define in the implementation plan.

## 9. UI and navigation

### 9.1 `/me` overview

Primary sections:

**Coming up**
- upcoming birthdays
- upcoming trip
- renewals approaching

**Needs attention**
- overdue/urgent tasks
- review items
- action-required Life Admin items

**Recent changes**
- meaningful Gmail-derived updates
- trip updates
- manual changes where useful

### 9.2 Public Preston.run homepage

When authenticated, show a compact private Life Admin summary, such as:
- 2 upcoming birthdays
- 1 upcoming trip
- 3 things need attention
- 2 Gmail discoveries

Each is clickable into `/me`.

When unauthenticated, do not fetch or expose these counts. A generic sign-in tile may be shown instead.

### 9.3 People

People list includes:
- name
- relationship
- next birthday
- days until birthday
- gift/task status where relevant

Person detail includes:
- birthday
- notes
- gift ideas
- linked tasks
- relevant Life Admin items
- activity history

### 9.4 Trips

Trips page shows upcoming/completed trips with date range, primary locations, booking count and attention/change state.

Trip detail tabs/sections:
- Overview
- Itinerary
- Bookings
- Tasks
- Activity

Users can edit, move, merge and split trip content.

### 9.5 Life Admin

Filterable views include:
- Needs action
- Upcoming
- Renewals
- Bills
- Government
- Property
- Appointments
- Subscriptions
- Completed

### 9.6 Gmail Inbox

Only uncertain/conflicting cases appear.

Each review card must explain:
- what was detected
- why review is needed
- the proposed destination/action
- confidence where useful

### 9.7 Settings

Include:
- signed-in Google account
- Gmail connection status
- push notification settings
- quiet hours
- reminder defaults
- Morning Digest integration
- registered devices
- Gmail automation preferences

### 9.8 Mobile-first

The private experience must work well as an installed iPhone PWA:
- large tap targets
- single-column primary flows
- no dependence on hover
- no drag-and-drop required for core workflows
- editable forms optimized for mobile
- deep links from push notifications

## 10. Privacy and security

### 10.1 RLS

Enable Row Level Security on every exposed private table.

Policies must both authenticate and authorize ownership. `TO authenticated` alone is insufficient.

### 10.2 Credentials

Never expose:
- Supabase service-role/secret key
- Google OAuth client secret
- Gmail refresh tokens
- Web Push private/VAPID secret

These remain server-side.

### 10.3 Data minimization

Normal private records may include names, birthdays, subscription costs, renewal dates, notes and booking metadata.

Avoid making Preston.run a vault for highly sensitive identity or financial credentials. Full card numbers, passwords, recovery codes, SSNs/TFNs and comparable secrets are explicitly out of scope.

### 10.4 Gmail data minimization

Store source identifiers, message metadata and extracted values rather than full Gmail content whenever practical.

## 11. Error and recovery behavior

- Gmail scan failures must not delete or corrupt existing records.
- Store last successful scan checkpoint separately from current attempt.
- A failed scan is retryable and visible in settings/status.
- Duplicate Gmail processing must be idempotent by message/source identifier.
- Record matching must not merge uncertain trips silently.
- Automatic updates must be auditable and undoable.
- Push delivery failures must not mark the underlying reminder completed.
- Expired/invalid push subscriptions should be deactivated safely.

## 12. Testing strategy

The implementation plan must include automated coverage for at least:
- authenticated vs unauthenticated private-data access
- RLS ownership isolation
- birthday date calculations including unknown birth year
- Life Admin due-state calculations
- trip grouping and non-grouping confidence behavior
- Gmail idempotency
- booking update vs duplicate creation
- manual-lock protection
- cancellation handling
- reminder scheduling
- quiet hours
- notification deduplication
- Morning Digest summary generation
- deep-link generation

Each release must remain independently deployable and functional.

## 13. Versioned delivery direction

Proposed release sequence:

- **v0.5.0** — private foundation, Google/Supabase auth, `/me`, RLS
- **v0.6.0** — People and Birthdays, private homepage birthday count
- **v0.7.0** — Life Admin items and linked tasks
- **v0.8.0** — Trips, segments, bookings and editable itinerary
- **v0.9.0** — PWA push infrastructure and reminder engine
- **v0.10.0** — Gmail OAuth and manual scan
- **v0.11.0** — automatic classification, matching, update/history and review inbox
- **v0.12.0** — scheduled Gmail sweep and Morning Digest integration
- **v0.13.0** — unified Coming Up dashboard and polish

The implementation plan may refine boundaries if repository/hosting constraints make a different sequencing safer, but it must preserve a fully working app after each release.

## 14. Explicitly out of scope for the first build

- email reminder delivery
- generic calendar replacement
- email client
- password manager
- banking aggregation
- full budgeting
- general note-taking app
- full CRM
- project-management system
- autonomous itinerary activity invention
- storing highly sensitive secrets or identity credentials

## 15. Success criteria

The design is successful when Preston.run can securely answer, from one private system:

- What birthdays are coming up?
- What personal admin needs action?
- What is expiring or renewing soon?
- What trips do I have and what bookings belong to them?
- Did Gmail discover a meaningful new booking, deadline or change?
- Did an existing booking change?
- What should appear in my morning briefing?
- What is important enough to push me immediately?

while keeping automation editable, auditable, low-noise and subordinate to explicit user edits.
