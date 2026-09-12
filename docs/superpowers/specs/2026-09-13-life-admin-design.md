# preston.ai Life Admin Design

**Date:** 2026-09-13  
**Status:** Approved design baseline  
**Repository:** `ppodolske/preston-run`  
**Canonical URL:** `https://preston.run`  
**Product name:** `preston.ai`  
**Current application version before implementation:** v0.4.0

## 1. Purpose

`preston.ai` is a private personal operating portal hosted at `preston.run`. It combines a morning dashboard with Life Admin, people and birthdays, trips, Gmail-derived reminders, tasks, notifications, and links into the user's other tools.

The product boundary is:

> Things in my personal life that I need to remember, renew, buy, check, travel for, or deal with eventually, surfaced in one useful private home screen.

The system must not become a generic email client, password manager, banking system, full project manager, or full travel-planning app.

The first-class domains are:

1. Morning Digest
2. People and birthdays
3. Life Admin items such as renewals, deadlines, bills, appointments, government/admin, property, subscriptions and memberships
4. Tasks linked to people, Life Admin items, or trips
5. Trips composed from travel bookings and lightweight itineraries
6. Gmail discoveries and automatic record maintenance
7. PWA push notifications
8. Links and summaries from other Preston apps such as Dose & Scale and State Parks

## 2. Product principles

### 2.1 Private by default

`preston.run` is an authenticated personal portal. Unauthenticated visitors receive only a minimal `preston.ai` sign-in experience and no personal dashboard content, counts, app status, admin information, or private data.

Private data must never be embedded in public HTML, static JSON, client-side source files, GitHub, public cache entries, or localStorage-only state.

`parks.preston.run` remains deliberately public and independent from the authenticated `preston.run` portal.

### 2.2 Google identity, explicit access

Use Google sign-in through Supabase Auth. Authentication and Gmail authorization remain separate grants.

Initial private portal access is restricted to the designated owner Google account. Successfully authenticating with another Google account must not grant access to private portal data.

### 2.3 Automation can maintain data but must not erase user intent

High-confidence Gmail discoveries may create or update records automatically. Manual edits are authoritative and must not be silently overwritten by future inference.

### 2.4 Review only uncertainty

The Gmail review inbox is not a staging area for every detected email. High-confidence records are created or updated automatically. Only ambiguous matches, conflicts, or uncertain classifications require review.

### 2.5 Preserve history

Automatic changes, manual changes, cancellations, merges, splits, reminder state changes, and status transitions must be auditable.

### 2.6 One morning notification

Routine morning information is consolidated into one Morning Digest PWA push. Standalone pushes are reserved for meaningful or urgent changes.

## 3. Brand and visual identity

The product is branded **`preston.ai`**, while all portal URLs remain under **`preston.run`**.

Canonical approved assets:

- Website/header logo: the approved outdoors-oriented transparent `preston.ai` wordmark generated in this design session.
- App icon: the approved outdoors-oriented opaque navy rounded-square icon with the stylized `P`, mountain/peak, and path motif.
- The opaque app icon is the source for the favicon, Apple touch icon, 192x192 PWA icon, 512x512 PWA icon, and maskable PWA icon.

The website should use the transparent wordmark on the authenticated landing/dashboard page and minimal sign-in page where appropriate.

The page title and installed app name use `preston.ai`; the hostname remains `preston.run`.

## 4. Architecture

### 4.1 Responsibilities

**preston.ai / Preston.run PWA**
- Minimal unauthenticated Google sign-in screen
- Full authenticated home dashboard at `/`
- Morning Digest
- People and birthdays
- Life Admin
- Trips and bookings
- Gmail review inbox
- Tasks
- Notification settings and PWA subscriptions
- Links/summaries from other Preston apps

**Supabase**
- Google-backed authentication
- PostgreSQL source of truth for private structured data
- Row Level Security on all exposed private tables
- User ownership and authorization

**Railway backend**
- Application hosting
- Server-side auth/session integration
- Gmail OAuth and token handling
- Gmail scanning and classification
- Record matching and trip grouping
- Reminder evaluation
- Web Push delivery
- Private aggregation endpoints for the dashboard

**Dose & Scale**
- Remains the source of fitness/recovery/training information
- Exposes or provides summary data consumed by preston.ai
- Does not own Life Admin data or Gmail processing

**State Parks**
- Remains a separate public application at `parks.preston.run`
- May be linked from preston.ai
- Does not inherit preston.ai authentication requirements

### 4.2 Authentication flow

```text
Request preston.run
  -> authenticated Supabase session?
      -> no: minimal preston.ai sign-in screen
      -> yes: verify owner allow-list
          -> allowed: full private portal
          -> denied: access denied / sign out
```

Google sign-in requests only identity scopes. Gmail access is connected separately from Settings with additional Gmail scopes.

Authorization must not rely on user-editable metadata. RLS policies must scope rows to the authenticated owning user.

### 4.3 Route structure

The authenticated homepage is `/`.

```text
/
├── Morning Digest
├── Coming Up
├── Needs Attention
├── Recent Changes
└── App links

/me/people
/me/birthdays
/me/trips
/me/trips/:id
/me/items
/me/items/:id
/me/tasks
/me/inbox
/me/notifications
/me/settings
```

## 5. Morning Digest

### 5.1 Ownership

preston.ai owns the unified Morning Digest experience. Dose & Scale supplies fitness/recovery information to it; Life Admin supplies personal admin information.

### 5.2 Morning flow

```text
Morning scheduled jobs
├── Garmin / Dose & Scale sync
├── Gmail Life Admin sweep
├── reminder evaluation
├── trip update processing
└── birthday / renewal evaluation
        ↓
Build preston.ai Morning Digest
        ↓
Send ONE PWA morning push
        ↓
Open authenticated preston.run homepage
```

The exact schedule is configurable in implementation; the existing preference for a morning sync can be used as the default when implemented.

### 5.3 Digest content

The authenticated homepage may show the full morning digest, including:

- recovery/sleep/training summary from Dose & Scale
- birthdays coming up
- Life Admin items needing action
- renewals due soon
- upcoming trips
- overnight trip changes
- Gmail items needing review
- overdue/urgent tasks

Life Admin rows deep-link into their secure detail pages. Fitness rows deep-link into Dose & Scale where useful.

### 5.4 Push behavior

Routine morning content produces one push such as:

> Morning Digest — 4 things to know

Standalone pushes remain available for material changes, cancellations, urgent actions, and configured imminent appointments.

## 6. Core data model

### 6.1 Profiles

`profiles`
- `id`
- `user_id`
- display/settings fields
- timezone
- timestamps

### 6.2 People

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

Birthday year is optional. Unknown years must not be represented with a fake full date.

### 6.3 Life Admin items

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

### 6.4 Tasks

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

Tasks are actions. Life Admin items are facts/events/obligations. They remain distinct.

### 6.5 Trips

`trips`
- `id`
- `user_id`
- `title`
- `start_at`
- `end_at`
- `status`
- `notes`
- manual-name metadata
- timestamps

### 6.6 Trip segments

`trip_segments`
- `id`
- `trip_id`
- `sequence`
- `title`
- `location`
- `starts_at`
- `ends_at`

Segments support multi-city or multi-region travel while preserving one overall trip.

### 6.7 Bookings

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

### 6.8 Gmail sources

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
- optional links to Life Admin item, booking, trip, or task
- structured `extracted_data`
- timestamps

Do not persist full email bodies as the Life Admin source of truth. Gmail remains the source; preston.ai stores message identifiers, provenance, and extracted structured values.

### 6.9 Field provenance / manual locks

Important fields support provenance and manual protection, either through a dedicated field-level table or equivalent metadata.

For each protected field, the system can determine:
- source
- source record/message
- last changed time
- whether the field is manually locked

Manual edits win over inferred metadata. Operational fields such as flight times may continue to auto-update unless explicitly locked.

### 6.10 Reminders

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

### 6.11 Push subscriptions

`push_subscriptions`
- `id`
- `user_id`
- endpoint
- PWA push key material
- device label
- active flag
- last-used timestamp

Multiple devices are supported.

### 6.12 Activity history

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

Activity history records meaningful automatic and manual changes.

## 7. Gmail ingestion and matching

### 7.1 Scope

Useful recurring Gmail signals include:
- renewals and expiries
- action-required notices
- bills and scheduled payments
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

### 7.2 Processing pipeline

```text
New Gmail message
  -> relevance filter
  -> classification
  -> structured extraction
  -> existing-record matching
  -> confidence decision
  -> auto-create / auto-update OR Needs Review
  -> reminder recalculation
  -> trip/itinerary recalculation where relevant
  -> activity-history entry
```

Initial classifications:
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

### 7.3 Confidence behavior

**High confidence**
- create/update automatically
- log the change
- recalculate dependent reminders/itinerary

**Medium confidence**
- create a review item with suggested action

**Low confidence**
- ignore unless clearly actionable enough to justify review

### 7.4 Matching priority for travel

1. exact booking reference
2. exact provider + identifiable route/property
3. same Gmail thread
4. strong date + destination overlap
5. existing trip date/location overlap

Multiple Gmail messages may point to the same booking. Later airline schedule-change messages update the existing booking instead of creating duplicates.

### 7.5 Cancellations and undo

Cancellations mark records cancelled rather than deleting them. Dependent reminders are cancelled or recalculated.

Automatic Gmail changes provide a practical undo path that restores prior structured values while preserving provenance and audit history.

## 8. Trips behavior

### 8.1 Automatic creation and grouping

A strong new travel booking may automatically create a trip when no existing trip fits.

Bookings attach automatically to an existing trip only when date/destination evidence is strong. Uncertain grouping goes to review.

### 8.2 Multi-city travel

Trips may contain ordered segments and may be manually merged or split.

Example:

```text
USA Trip
├── Sydney -> Los Angeles
├── Los Angeles -> Minneapolis
├── Minneapolis -> Chicago
└── Chicago -> Sydney
```

### 8.3 Editing

All trips, segments, bookings, dates, locations, titles, and itinerary items are editable.

Manual naming and manual field edits are respected by future automation.

### 8.4 Itinerary

Trip itinerary is intentionally lightweight:
- date/day grouping
- chronological bookings
- flight, accommodation, rental, activity, and other booking entries
- direct links to booking/source details

No automatic sightseeing/activity invention in the initial release.

## 9. Notifications and reminders

### 9.1 Delivery channel

PWA Web Push is the only outbound notification channel in scope. Do not build email notification delivery.

### 9.2 Notification classes

- scheduled reminder
- action-required alert
- material-change alert
- batched review-needed alert
- unified Morning Digest alert

### 9.3 Routine reminder defaults

Initial configurable defaults:

**Birthdays:** 30, 14, 7, and 1 day before  
**Renewals/expiries:** 60, 30, 14, 7, and 1 day before  
**Bills/deadlines:** 14, 7, 3 days before and due day  
**Appointments:** 24 hours and 2 hours before  
**Trips:** 14, 7, and 1 day before

Defaults can be overridden globally or per item.

### 9.4 Standalone push rules

Standalone push is appropriate for:
- flight or booking cancellation
- material time/date/location change
- materially changed renewal cost
- newly urgent action required
- imminent appointment where configured
- other explicitly high-priority events

Do not send standalone push for formatting-only or duplicate Gmail changes.

### 9.5 Review batching, snooze, and acknowledgement

Review items are batched rather than pushed individually.

Support snooze options:
- tomorrow
- 3 days
- 1 week
- custom date

Acknowledge and complete remain distinct concepts. Snoozing a reminder does not modify the underlying due date.

### 9.6 Quiet hours

Global quiet hours are configurable. Initial default proposal: 10:00 PM to 7:00 AM local time.

Ordinary reminders wait until quiet hours end. High-priority travel cancellation/material-change behavior is configurable.

### 9.7 Deep links

Pushes open the relevant authenticated route. The Morning Digest push opens `/`.

## 10. UI and navigation

### 10.1 Unauthenticated landing page

The unauthenticated `preston.run` response is intentionally minimal:
- `preston.ai` branding
- approved logo
- short personal-dashboard descriptor
- Google sign-in button

No weather, private counts, app status, admin links, dashboard markup, or personal data is delivered before authentication.

### 10.2 Authenticated homepage

The homepage is the morning cockpit and private portal home.

Primary sections:

**Morning Digest**
- full morning summary from connected sources

**Coming Up**
- birthdays
- upcoming trip
- renewals
- appointments

**Needs Attention**
- overdue/urgent tasks
- review items
- action-required Life Admin items

**Recent Changes**
- meaningful Gmail-derived updates
- trip updates
- important automatic changes

**Apps**
- Dose & Scale
- State Parks
- Archive
- future Preston apps

### 10.3 People

People list includes name, relationship, next birthday, days until birthday, and gift/task status where relevant.

Person detail includes birthday, notes, gift ideas, linked tasks, relevant Life Admin items, and activity history.

### 10.4 Trips

Trips page shows upcoming/completed trips with date range, locations, booking count, and attention/change state.

Trip detail sections:
- Overview
- Itinerary
- Bookings
- Tasks
- Activity

Users can edit, move, merge, and split trip content.

### 10.5 Life Admin

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

### 10.6 Gmail review inbox

Only uncertain items appear. Each review item explains why judgment is needed and offers focused actions such as:
- add to suggested trip
- create separate trip
- accept extracted Life Admin item
- keep existing value
- use new value
- ignore

### 10.7 Settings

Settings include:
- Google account/session
- Gmail connection
- push notifications
- devices
- quiet hours
- reminder defaults
- Morning Digest settings
- Gmail automation preferences

### 10.8 Mobile-first behavior

The private portal should favor one-column mobile layouts, large tap targets, clear status chips, simple forms, deep links, and no drag-and-drop dependency for core workflows.

## 11. Security requirements

- All exposed private Supabase tables have RLS enabled.
- Policies authorize ownership, not merely `TO authenticated`.
- Update policies use both `USING` and `WITH CHECK` ownership predicates.
- Do not use user-editable metadata for authorization.
- Supabase service-role/secret keys, Gmail refresh tokens, Web Push private keys, and other server credentials remain server-side only.
- Public caches must never cache authenticated dashboard responses.
- Authenticated/private data must not appear in OpenGraph metadata or unauthenticated HTML.
- Full passwords, banking credentials, full card data, TFNs, SSNs, recovery codes, and similar secrets are out of scope.
- Gmail message bodies are not persisted as the canonical Life Admin record.

## 12. Error handling and reliability

- Gmail processing is idempotent by message ID/thread provenance.
- Scheduled scans persist a successful checkpoint and must not repeatedly re-import the same message.
- Failed scans do not advance the successful checkpoint.
- Duplicate push prevention is first-class.
- Trip updates and Gmail changes are auditable and undoable.
- Morning Digest generation must tolerate one source being temporarily unavailable and clearly mark unavailable sections rather than failing the entire dashboard.

## 13. Testing strategy

Implementation must include automated tests for:
- authenticated vs unauthenticated homepage behavior
- owner allow-list enforcement
- RLS ownership isolation
- people/birthday date logic
- Life Admin status/due-date logic
- trip grouping and itinerary ordering
- Gmail idempotency and matching behavior
- manual field lock precedence
- cancellations and undo
- reminder deduplication/snoozing
- Morning Digest aggregation
- public State Parks boundary remains unaffected
- PWA manifest/icon references and private app naming

Each release must leave the deployed application working and testable.

## 14. Versioned delivery roadmap

The implementation plan may refine task boundaries, but the intended incremental releases are:

| Version | Deliverable |
|---|---|
| **v0.5.0** | preston.ai branding, approved logo/icon assets, Google sign-in, owner-only authentication, private-by-default homepage, PWA manifest/icon update |
| **v0.6.0** | Supabase private data foundation, People/Birthdays, authenticated Coming Up summary |
| **v0.7.0** | Life Admin items, tasks, renewals, secure detail/edit flows |
| **v0.8.0** | Trips, segments, bookings, manual merge/split/edit, lightweight itinerary |
| **v0.9.0** | PWA push infrastructure, reminder rules, notification history, snooze/acknowledge |
| **v0.10.0** | Gmail OAuth, manual scan, source provenance, safe structured extraction |
| **v0.11.0** | Gmail classification, matching, automatic high-confidence create/update, Needs Review inbox, undo/history |
| **v0.12.0** | Scheduled Gmail sweep, trip auto-grouping/update detection, batched/urgent pushes |
| **v0.13.0** | Unified preston.ai Morning Digest using Life Admin plus Dose & Scale summary data, one morning push |
| **v0.14.0+** | Smarter sender rules, maintenance/subscription refinements, advanced trip intelligence, additional Preston app summaries |

## 15. Out of scope for the initial roadmap

- generic calendar replacement
- full email client
- password/secrets vault
- bank aggregation or transaction tracking
- full budgeting
- giant contacts CRM
- generic notes system
- full itinerary/activity planner
- automatically invented travel activities
- email notification delivery

## 16. Final approved product boundary

`preston.ai` is a private personal portal at `preston.run` that answers:

> What do I need to know or deal with today, what is coming up, and what changed while I was not looking?

It aggregates the answer into one authenticated home screen, while detailed records remain editable and securely linked to their underlying sources.