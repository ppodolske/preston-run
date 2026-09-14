# preston.ai Connected Intelligence Design

Date: 2026-09-15  
Status: Proposed for review  
Repository: `ppodolske/preston-run`  
Production branch: `build/preston-ai-v0.11.0`  
Scope: Umbrella architecture for the v0.15-v0.20 programme

## 1. Summary

This design evolves preston.ai from a collection of useful personal dashboards and domain-specific automations into a connected personal operating system.

The programme adds the following approved capabilities:

- Universal Personal Search;
- Personal Knowledge Graph / entity linking;
- Google Drive-backed Documents;
- Gmail attachment filing into Documents;
- automatic document extraction and linking;
- communications intelligence;
- thread-aware commitment detection;
- a shared Review Inbox;
- Goals, Projects and Milestones;
- a cross-domain personal Agent;
- explicit action approval, audit and progressive automation;
- Trip Readiness and Pre-Trip Briefings;
- suggested Trip archival;
- a more action-oriented Today page;
- Daily Pulse updates throughout the day;
- dashboard quick actions;
- Global and context-aware Quick Add;
- persistent product navigation;
- first-class Waiting views;
- source provenance throughout the product;
- contextual reminder presets;
- unified system health;
- Records as a long-term historical knowledge layer.

The central architectural decision is that existing domain tables remain canonical. Trips remain Trips, Bookings remain Bookings, Life Admin remains Life Admin, People remain People, and so on. The new architecture adds a shared intelligence layer beneath those domains rather than replacing them with a generic object model.

The shared layer consists of five concepts:

1. **Entities** — stable references to canonical domain records;
2. **Links** — relationships between entities;
3. **Sources / provenance** — where information came from;
4. **Search** — a common searchable representation of entities;
5. **Actions** — validated, permissioned operations the Agent may propose or execute.

The result should feel like one coherent system rather than a set of disconnected features.

This is an umbrella design, not a single-release implementation specification. Each major phase will receive its own detailed implementation plan and release gate before code is merged or deployed.

## 2. Current-state principles to preserve

The existing architecture already contains useful canonical boundaries that this programme must preserve.

### 2.1 Existing domain objects remain authoritative

The current Trip / Booking / Booking Leg / Life Admin / Gmail-source split established in v0.13-v0.14 remains valid.

Examples:

- **Trip** = travel container;
- **Booking** = canonical reservation;
- **Booking Leg** = transport child leg;
- **Trip Stage** = optional user-defined stage;
- **Life Admin** = obligation, deadline, bill, appointment or related administrative item;
- **Task** = action;
- **Person** = canonical person record;
- **Gmail source** = provenance/evidence rather than the canonical business object.

The new intelligence layer must point to these objects. It must not create parallel versions of them.

### 2.2 Manual authority remains protected

Where an automated source and a manual value conflict, a manually confirmed value remains authoritative unless the user explicitly changes that rule.

The same principle will apply to:

- entity links;
- document metadata;
- commitment state;
- project relationships;
- reminder choices;
- Agent-created or Agent-proposed changes.

### 2.3 Gmail remains read-only in the initial Agent programme

The current Gmail integration uses `gmail.readonly`.

This programme does not require Gmail sending, labelling, archiving or mailbox modification in its initial phases.

If future Agent work adds email drafting or sending, that must be a separate permission expansion with its own design and explicit re-authorization.

### 2.4 Morning Digest remains distinct from Today

Morning Digest answers primarily:

> How am I doing?

It focuses on fitness, recovery and related context.

Today answers:

> What matters now and what do I need to do?

The Daily Pulse evolves Today. It does not replace or absorb Morning Digest.

## 3. Goals

### 3.1 Product goals

The completed system should allow the user to:

- find information across preston.ai from one search surface;
- understand how people, trips, projects, documents, email threads and records relate;
- capture goals and projects without creating a second task manager;
- store important files in the user’s own Google Drive while preston.ai understands and indexes them;
- detect commitments and follow-ups from Gmail at thread level;
- review uncertain automation in one shared place;
- use Today as an action centre that changes meaningfully throughout the day;
- receive useful pre-trip readiness and briefing intelligence;
- keep a durable historical record of meaningful outcomes and evidence;
- allow an Agent to propose and eventually perform well-defined actions without unrestricted access to application internals;
- see where every imported or inferred item came from;
- understand whether source integrations are current and healthy.

### 3.2 Architecture goals

The design must:

- reuse Supabase/Postgres and Railway;
- avoid unnecessary new infrastructure;
- preserve existing canonical tables;
- provide common primitives for relationships, provenance, search, review and actions;
- allow features to be implemented in phases;
- remain understandable and testable at the module level;
- default to safe, reversible behaviour;
- make automation confidence and authority explicit;
- avoid silent destructive actions;
- remain appropriate for a single-user private system while preserving proper ownership/RLS patterns.

### 3.3 User-experience goals

The system should feel increasingly connected without becoming cluttered.

Examples:

- a Queenstown Trip can show linked bookings, documents, tasks, projects and readiness;
- a PR Project can show documents, Gmail correspondence, Life Admin and milestones;
- Universal Search can surface all of those without the user needing to know which table they came from;
- Today can show an actionable summary and explain what changed since the morning;
- uncertain classification or linking appears in Review Inbox rather than being silently accepted;
- provenance can be inspected without overwhelming every screen.

## 4. Non-goals

This programme will not initially add:

- a graph database such as Neo4j;
- Elasticsearch or OpenSearch;
- Pinecone or another external vector database;
- Kafka or a separate event-stream platform;
- a separate document-storage server;
- whole-Drive crawling;
- autonomous Gmail sending;
- autonomous financial transactions or payments;
- unrestricted LLM database access;
- a general-purpose workflow builder;
- a replacement for Google Drive;
- a replacement for Gmail;
- a second task-management model inside Projects;
- automatic creation of historical Records for every minor event;
- automatic Trip archival without user approval;
- Level-4 autonomous actions at launch.

## 5. Chosen architecture

### 5.1 Overview

The architecture is:

```text
Existing canonical domains
────────────────────────────────────
People
Trips / Bookings / Stages
Life Admin
Tasks
Calendar-derived records
Goals
Projects
Milestones
Documents
Records
Communication Threads
        │
        ▼
Shared intelligence layer
────────────────────────────────────
Entity Registry
Entity Links
Source / Provenance Links
Search Index
Review Queue
Action Registry
Action Audit
        │
        ▼
User-facing intelligence
────────────────────────────────────
Universal Search
Today / Daily Pulse
Review Inbox
Trip Readiness
Pre-Trip Briefings
Agent
Records
```

No canonical domain is replaced by the entity registry. The entity registry is a stable indirection layer used by cross-domain systems.

### 5.2 Why this approach

The selected features share the same dependency pattern:

- Search needs stable entity identity;
- Projects need links to Tasks, Documents, People and Trips;
- Documents need links and provenance;
- Communications need links and review;
- the Agent needs links, provenance, actions and audit;
- Records need links to historical evidence;
- Today needs a common way to aggregate actionable items.

Building those independently would duplicate relationship and provenance logic.

## 6. Entity Registry

### 6.1 Purpose

`entity_registry` provides a generic identity for a canonical record.

It answers:

> Which preston.ai object is this?

It does not store the object’s business data.

### 6.2 Proposed schema

```text
entity_registry
- id uuid primary key
- user_id uuid not null
- entity_type text not null
- source_record_id text not null
- created_at timestamptz not null
- updated_at timestamptz not null
```

Constraints:

- unique `(user_id, entity_type, source_record_id)`;
- RLS by `user_id`;
- no nullable ownership;
- no business fields duplicated from the canonical table.

Initial supported `entity_type` values:

- `person`
- `trip`
- `booking`
- `life_admin`
- `task`
- `goal`
- `project`
- `milestone`
- `document`
- `record`
- `communication_thread`

Additional types may be added only when they have a stable canonical identity.

### 6.3 Registry lifecycle

A registry row may be created:

- at canonical object creation time; or
- lazily when the object first participates in a shared feature.

Deleting a canonical object must not leave a live entity reference that pretends the object still exists. The implementation phase must define either cascading cleanup or tombstone behaviour per domain.

For historical integrity, Records and audit logs may retain textual snapshots even if a referenced entity later disappears.

## 7. Entity Links

### 7.1 Purpose

`entity_links` stores cross-domain relationships.

Examples:

```text
Project      ─part_of──────→ Goal
Task         ─belongs_to───→ Project
Document     ─evidence_for─→ Project
Document     ─about────────→ Trip
Thread       ─about────────→ Project
Person       ─participant──→ Trip
Record       ─supported_by─→ Document
Milestone    ─belongs_to───→ Project
```

### 7.2 Proposed schema

```text
entity_links
- id uuid primary key
- user_id uuid not null
- from_entity_id uuid not null
- to_entity_id uuid not null
- relationship_type text not null
- authority text not null
- confidence numeric null
- status text not null
- created_by text not null
- created_at timestamptz not null
- updated_at timestamptz not null
```

Suggested values:

`authority`:

- `manual`
- `source`
- `inferred`

`status`:

- `proposed`
- `confirmed`
- `rejected`

`created_by`:

- `user`
- `gmail`
- `document_processor`
- `system`
- `agent`

### 7.3 Link authority

Rules:

- manual links are immediately confirmed;
- source-explicit links may auto-confirm when deterministic;
- inferred links follow confidence/review policy;
- rejected links must not silently reappear from identical evidence;
- a confirmed manual correction wins over later inference.

### 7.4 No forced symmetry

Links are directional at storage level.

The presentation layer may display natural inverse wording, but the database must not create duplicate inverse rows unless a specific use case requires them.

## 8. Provenance

### 8.1 Principle

Any imported, inferred or Agent-created object should be able to answer:

> Where did this come from?

### 8.2 Provenance sources

Initial source types include:

- `manual`
- `gmail`
- `google_drive`
- `calendar`
- `garmin`
- `system_inference`
- `agent_action`

### 8.3 Proposed generic provenance table

```text
entity_sources
- id uuid primary key
- user_id uuid not null
- entity_id uuid not null
- source_type text not null
- source_record_id text null
- source_url text null
- source_metadata jsonb not null default '{}'
- first_seen_at timestamptz not null
- last_seen_at timestamptz not null
```

Existing domain-specific provenance tables remain valid and authoritative during migration.

The generic layer should bridge to them rather than forcing an immediate rewrite of all existing Gmail source relationships.

### 8.4 Field-level provenance

Field-level provenance is required only where automated extraction materially changes structured data.

New intelligence-heavy entities such as Documents and Communications may store a compact `field_provenance` JSON structure.

Existing domain tables should not be retrofitted wholesale unless implementation reveals a specific need.

### 8.5 User interface

Common surfaces should support a compact source indicator such as:

- Gmail;
- Drive;
- Manual;
- Calendar;
- Agent.

Detailed source evidence is available on demand rather than occupying primary card space.

## 9. Universal Personal Search

### 9.1 Scope

Universal Search covers canonical preston.ai entities, not arbitrary external systems.

Initial domains:

- People;
- Trips;
- Bookings;
- Life Admin;
- Tasks;
- Goals;
- Projects;
- Milestones;
- Documents;
- Records;
- Communication Threads.

### 9.2 Search index

Proposed table:

```text
search_documents
- id uuid primary key
- user_id uuid not null
- entity_id uuid not null
- entity_type text not null
- title text not null
- searchable_text text not null
- keywords text[] not null default '{}'
- occurred_at timestamptz null
- source_summary text null
- search_vector tsvector
- indexed_at timestamptz not null
- source_updated_at timestamptz null
```

Constraints:

- one active search document per entity unless an implementation phase proves chunking is necessary;
- RLS by `user_id`;
- index `search_vector`;
- enable `pg_trgm` for fuzzy matching.

### 9.3 Ranking strategy

Initial search is deterministic:

1. exact title / reference matches;
2. full-text search;
3. fuzzy/trigram match;
4. date/context boosts where relevant.

Semantic embeddings are a later enhancement, not an initial dependency.

If semantic search is later added, enable pgvector in Supabase and keep embeddings inside Postgres rather than introducing a separate vector service.

### 9.4 Search result presentation

Results display:

- entity type;
- title;
- concise matching context;
- relevant date;
- relationship context where helpful;
- source/provenance indicator.

Search results link to canonical object pages.

### 9.5 Search indexing

Search indexing must be idempotent.

Canonical domain mutations enqueue or trigger re-indexing of the affected entity.

A repair/rebuild command must be available so the search index can be regenerated from canonical data rather than treated as authoritative storage.

## 10. Goals, Projects and Milestones

### 10.1 Definitions

**Goal** = a desired longer-term outcome.

**Project** = a finite body of work undertaken to achieve an outcome.

**Milestone** = a meaningful checkpoint within a Project.

**Task** = a next action.

**Life Admin** = an obligation, deadline, bill, appointment or administrative item.

Projects do not introduce a second task system.

### 10.2 Proposed Goals schema

```text
goals
- id uuid primary key
- user_id uuid not null
- title text not null
- description text null
- status text not null
- target_date date null
- completed_at timestamptz null
- archived_at timestamptz null
- created_at timestamptz not null
- updated_at timestamptz not null
```

Suggested statuses:

- `active`
- `paused`
- `completed`
- `abandoned`

### 10.3 Proposed Projects schema

```text
projects
- id uuid primary key
- user_id uuid not null
- goal_id uuid null
- title text not null
- description text null
- status text not null
- start_date date null
- target_date date null
- completed_at timestamptz null
- archived_at timestamptz null
- created_at timestamptz not null
- updated_at timestamptz not null
```

Suggested statuses:

- `planned`
- `active`
- `waiting`
- `completed`
- `cancelled`

### 10.4 Proposed Milestones schema

```text
project_milestones
- id uuid primary key
- user_id uuid not null
- project_id uuid not null
- title text not null
- description text null
- target_date date null
- completed_at timestamptz null
- position integer not null
- created_at timestamptz not null
- updated_at timestamptz not null
```

### 10.5 Project relationships

Tasks, Life Admin, Documents, People, Trips, Records and Communication Threads link to Projects through the entity-link layer unless an existing canonical foreign key is already clearly appropriate.

Do not add a new bespoke `project_id` column to every table by default.

### 10.6 Project pages

A Project page should show:

- status and target date;
- Goal if any;
- milestones;
- open Tasks;
- Life Admin;
- linked Documents;
- linked Communication Threads/commitments;
- linked Trips/People where relevant;
- activity/provenance summary.

## 11. Documents and Google Drive

### 11.1 Storage split

Google Drive is the canonical binary file store.

Supabase is the canonical store for document metadata, extracted text, relationships, processing state and search representation.

Railway runs ingestion and processing.

### 11.2 Google Drive permission model

Initial Drive authorization uses the narrow `drive.file` scope.

preston.ai may access:

- files it creates; and
- files the user explicitly selects for the app.

The system does not crawl or index the user’s entire Drive.

A future whole-Drive permission expansion would require a separate design and explicit approval.

### 11.3 Drive folder

preston.ai creates or uses a visible top-level folder such as:

```text
preston.ai Documents/
```

Optional broad category folders may include:

- Identity;
- Immigration;
- Insurance;
- Travel;
- Financial;
- Home & Assets;
- Health;
- Other.

The Drive folder hierarchy is not authoritative metadata.

A file may move between folders without changing its preston.ai identity because the stable Drive file ID is authoritative.

### 11.4 Google Picker

The user may add an existing Drive file through Google Picker.

Selecting a file grants preston.ai access to that file under the narrow permission model and starts normal document processing.

### 11.5 Proposed Documents schema

```text
documents
- id uuid primary key
- user_id uuid not null
- storage_provider text not null default 'google_drive'
- drive_file_id text not null
- name text not null
- mime_type text null
- size_bytes bigint null
- checksum_sha256 text null
- document_type text null
- issuer text null
- effective_date date null
- expiry_date date null
- summary text null
- extracted_text text null
- processing_status text not null
- source_type text not null
- source_record_id text null
- sensitivity text null
- field_provenance jsonb not null default '{}'
- created_at timestamptz not null
- updated_at timestamptz not null
```

Suggested processing statuses:

- `pending`
- `processing`
- `ready`
- `needs_review`
- `failed`
- `unavailable`

### 11.6 Document processing

Processing attempts to extract:

- title;
- document type;
- issuer/provider;
- important dates;
- reference/policy numbers where useful;
- summary;
- searchable text;
- potential links to existing entities.

Digital PDFs should use text extraction before OCR.

OCR or multimodal extraction is used only when necessary.

The extraction pipeline must preserve the original Drive file unmodified.

### 11.7 Document deletion semantics

Two distinct user actions are required:

1. **Remove from preston.ai** — removes or archives preston.ai metadata/index relationships while leaving the Drive file intact;
2. **Delete Drive file** — a separate destructive action requiring explicit confirmation.

The Agent must not delete Drive files in the initial Agent release.

If a Drive file is moved, normal operation continues through its file ID.

If a file is deleted externally or access is revoked, preston.ai marks the Document `unavailable` rather than deleting historical metadata silently.

## 12. Gmail Attachment → Documents

### 12.1 Purpose

Important Gmail attachments can become first-class Documents without manual download/re-upload.

### 12.2 Flow

```text
Gmail attachment discovered
        ↓
Relevance classification
        ↓
Attachment content fetched when needed
        ↓
Document extraction
        ↓
Potential entity links identified
        ↓
Confidence policy
  high-confidence safe proposal / review
        ↓
File created in Google Drive
        ↓
Document row created
        ↓
Provenance linked to Gmail attachment
        ↓
Entity links confirmed/proposed
        ↓
Search index updated
```

### 12.3 Idempotency

The system must not create duplicate Documents when the same Gmail attachment is processed repeatedly.

Primary dedupe signals:

- Gmail attachment/source record identity;
- Drive file identity after creation;
- checksum as a supporting signal.

### 12.4 Review behaviour

Examples likely to require little user intervention:

- clearly identified travel insurance certificate linked to an existing Trip;
- booking receipt already linked to a canonical Booking;
- explicit government letter linked to an existing Project.

Ambiguous attachments go to Review Inbox before filing/linking decisions are treated as authoritative.

## 13. Communications Intelligence

### 13.1 Scope

Communications Intelligence extends Gmail processing beyond travel and Life Admin extraction.

It aims to identify:

- requests for action;
- user commitments;
- commitments made by others;
- deadlines;
- expected follow-ups;
- waiting-on direction;
- resolution/cancellation;
- relevant People, Trips and Projects.

### 13.2 Thread-level model

Message-level facts are evidence. The thread is the canonical communication object.

Proposed schema:

```text
communication_threads
- id uuid primary key
- user_id uuid not null
- provider text not null
- provider_thread_id text not null
- subject text null
- summary text null
- participants jsonb not null default '[]'
- thread_status text not null
- waiting_direction text not null
- last_message_at timestamptz null
- last_processed_at timestamptz null
- field_provenance jsonb not null default '{}'
- created_at timestamptz not null
- updated_at timestamptz not null
```

Suggested `thread_status` values:

- `active`
- `resolved`
- `ignored`

Suggested `waiting_direction` values:

- `none`
- `waiting_on_me`
- `waiting_on_other`
- `unclear`

### 13.3 Raw Gmail content strategy

The system will use a hybrid approach.

Raw message content is fetched from Gmail when processing requires it.

preston.ai stores:

- source metadata;
- structured extracted facts;
- summaries;
- commitments;
- provenance;
- search-safe derived text where needed.

It does not blindly persist a full duplicate of the entire Gmail mailbox.

### 13.4 Thread updates

A new message causes the thread intelligence to be recomputed or incrementally updated.

Later messages may:

- fulfil a commitment;
- cancel a commitment;
- change a deadline;
- reverse waiting direction;
- resolve the thread.

The system must not treat an old message-level commitment as current when later thread evidence clearly supersedes it.

## 14. Commitment Detection

### 14.1 Proposed schema

```text
communication_commitments
- id uuid primary key
- user_id uuid not null
- thread_id uuid not null
- description text not null
- owner_kind text not null
- owner_entity_id uuid null
- due_at timestamptz null
- status text not null
- waiting_direction text not null
- source_message_id text null
- confidence numeric null
- authority text not null
- created_at timestamptz not null
- updated_at timestamptz not null
- resolved_at timestamptz null
```

Suggested statuses:

- `proposed`
- `open`
- `completed`
- `cancelled`
- `superseded`

### 14.2 Behaviour

Examples:

> “I’ll send you the signed form Friday.”

may produce:

- commitment owner = user;
- due date = Friday when resolvable;
- waiting direction = waiting on me.

> “We have submitted your application. You should hear back within five business days.”

may produce:

- commitment/expectation = external party;
- waiting direction = waiting on other;
- expected response window;
- suggested follow-up if overdue.

### 14.3 Relationship to Tasks and Life Admin

A detected commitment is not automatically a Task or Life Admin item.

It may propose one when that representation is useful.

This avoids duplicating every conversational promise into the task system.

## 15. Shared Review Inbox

### 15.1 Purpose

Review Inbox is a single place for uncertain automation across domains.

It is not Gmail-only.

### 15.2 Reviewable proposal types

Initial types include:

- Gmail classification;
- commitment creation/update;
- document classification;
- document filing;
- document/entity linking;
- entity linking;
- trip linking;
- project linking;
- Agent action proposals where additional user judgement is required.

### 15.3 Proposed schema

```text
review_items
- id uuid primary key
- user_id uuid not null
- review_type text not null
- title text not null
- explanation text null
- confidence numeric null
- proposed_change jsonb not null
- target_entity_ids uuid[] not null default '{}'
- source_refs jsonb not null default '[]'
- state text not null
- created_at timestamptz not null
- resolved_at timestamptz null
- resolution jsonb null
```

Suggested states:

- `pending`
- `accepted`
- `rejected`
- `deferred`
- `expired`

### 15.4 Confidence policy

Confidence is not the only factor. Risk matters too.

Policy concept:

```text
High confidence + low-risk internal enrichment
→ may apply automatically where policy allows

High confidence + material change
→ prepare and ask

Low confidence
→ Review Inbox

Destructive or external action
→ explicit confirmation
```

Manual review outcomes become authoritative context for future identical evidence.

## 16. Today and Daily Pulse

### 16.1 Today purpose

Today becomes the primary action-oriented home surface.

It answers:

> What matters now?

Morning Digest remains a separate recovery/fitness component.

### 16.2 Daily Pulse

Today should meaningfully refresh throughout the day.

Initial pulse windows align with existing source-refresh cadence:

- **Morning** — after Gmail, Calendar and fitness morning refreshes;
- **Midday** — after the midday Gmail refresh;
- **Evening** — after the early-evening Gmail refresh;
- **Late** — after the late Gmail refresh, primarily to prepare tomorrow context.

The exact cron/service mechanism is an implementation detail, but the product behaviour is fixed: Today reflects new information during the day rather than remaining a static morning digest.

### 16.3 Pulse content

A pulse may include:

- due/overdue items;
- open commitments;
- Waiting items;
- calendar changes;
- Trip readiness changes;
- newly important Gmail-derived information;
- upcoming reminders;
- system/integration health only when relevant;
- tomorrow preview in evening/late windows.

### 16.4 Change awareness

Later pulses should emphasize what changed since the previous pulse.

Examples:

- “Two things changed since this morning.”
- “Your 3pm appointment moved to 4pm.”
- “The Queenstown insurance document was filed and Trip readiness is now complete.”
- “You are still waiting on one reply.”

### 16.5 Notification restraint

The Today page may refresh frequently without sending a push notification every time.

Push notifications are reserved for meaningful changes or items requiring timely attention.

## 17. Dashboard Quick Actions

Today cards should expose context-appropriate direct actions.

Examples:

- Complete;
- Snooze;
- Mark waiting;
- Review;
- Open;
- Add reminder;
- Archive Trip suggestion;
- confirm/reject proposed link.

Actions must use the same validated application services used elsewhere, not custom dashboard-only mutations.

## 18. Waiting as a first-class view

The existing Life Admin `waiting` status becomes first-class in navigation/filtering.

Over time, Waiting may aggregate:

- Life Admin in `waiting`;
- Projects in `waiting`;
- communication commitments where `waiting_on_other`;
- Agent proposals awaiting external conditions.

The UI should distinguish:

- **waiting on me**;
- **waiting on someone/something else**.

The underlying domain state remains authoritative.

## 19. Global and Context-Aware Quick Add

### 19.1 Global Quick Add

A persistent `+` control may create:

- Task;
- Life Admin;
- Goal;
- Project;
- Milestone;
- Trip;
- Person;
- Document;
- Record.

### 19.2 Context-aware behaviour

When opened from a canonical entity page, Quick Add pre-populates that relationship.

Examples:

- `+ Task` on a Project page links the Task to the Project;
- `+ Document` on a Trip page proposes/creates the Trip link;
- `+ Life Admin` on a Person page carries the Person relationship;
- `+ Milestone` on a Project page automatically sets the Project.

The user can remove/change the proposed context before saving.

## 20. Persistent product navigation

The application shell should move toward a stable structure such as:

```text
Today
Life Admin
Trips
Projects
People
Calendar
Documents
Records
```

Universal Search and Quick Add are global controls rather than ordinary low-priority nav items.

Goals may live within Projects rather than requiring a permanent top-level nav destination.

Review Inbox appears as a contextual/global inbox indicator when pending items exist.

Lower-frequency administration remains under Settings/More.

## 21. Trip Readiness

### 21.1 Purpose

Trip Readiness determines whether an upcoming Trip appears complete enough to proceed.

It is the intelligence engine beneath Pre-Trip Briefings.

### 21.2 Readiness categories

Initial checks may include:

- transport;
- accommodation where expected;
- critical Bookings;
- required/linked Documents;
- open Trip tasks;
- unresolved Trip Life Admin;
- calendar conflicts;
- unresolved travel-related review items;
- important missing dates/locations.

The system must not invent universal requirements.

Readiness rules should be conservative and based on known Trip context.

### 21.3 Readiness states

Example:

- `ready`
- `attention`
- `incomplete`
- `insufficient_data`

Readiness is derived and should normally not be persisted as authoritative business data unless caching becomes useful.

## 22. Pre-Trip Briefing

A Pre-Trip Briefing combines:

- Trip dates;
- next Booking/Stage;
- transport/accommodation summary;
- important documents;
- outstanding tasks/Life Admin;
- readiness issues;
- relevant calendar context;
- important recent communication changes;
- source freshness.

The briefing is generated from canonical structured data and source-grounded intelligence.

It must clearly distinguish:

- confirmed information;
- missing information;
- suggestions.

## 23. Suggested Trip Archival

Trip archival remains reversible and independent from travel lifecycle, as established in v0.14.

This programme may suggest archival when:

- Trip end date is in the past;
- there are no current/future itinerary items;
- the Trip is not already archived;
- no high-priority unresolved travel item makes the suggestion inappropriate.

The user must confirm.

No automatic Trip archival is introduced.

## 24. Contextual Reminder Presets

Reminder defaults should depend on the object being reminded about.

Examples:

- birthday: 7 days / 1 day;
- document expiry: 90 / 30 / 7 days;
- Trip departure: 7 / 1 days;
- Life Admin deadline: category-aware presets;
- follow-up commitment: expected-response-aware presets;
- Project milestone: target-date-aware presets.

Presets are convenience defaults, not immutable rules.

User-selected reminder timing remains authoritative.

## 25. Records

### 25.1 Definition

A **Document** is a file.

A **Record** is a durable historical account of something meaningful that happened.

Records therefore remain distinct from Documents.

### 25.2 Examples

```text
Record: Australian PR Granted
Occurred: 12 Mar 2027

Linked:
- Goal: Obtain Australian PR
- Project: PR Application
- Document: Grant Notice.pdf
- relevant Gmail thread
- Life Admin history
```

Other possible Records:

- major purchase;
- completed major project;
- significant travel outcome;
- race result;
- move;
- important administrative outcome.

### 25.3 Proposed schema

```text
records
- id uuid primary key
- user_id uuid not null
- title text not null
- record_type text not null
- occurred_at timestamptz null
- ended_at timestamptz null
- summary text null
- source_type text not null
- created_at timestamptz not null
- updated_at timestamptz not null
```

Relationships and evidence are stored through `entity_links` and `entity_sources`.

### 25.4 Creation policy

Records may be:

- created manually;
- suggested by the system;
- prepared by the Agent for approval.

The system should not automatically create a Record for every completed task, email or Trip.

### 25.5 Naming

The product term is **Records**, not Archive, to avoid confusion with the separate story-archive product.

## 26. Agent architecture

### 26.1 Core principle

The Agent does not receive unrestricted write access to the database or external APIs.

It proposes actions from a fixed registry.

### 26.2 Flow

```text
User request / system insight
        ↓
Agent reasoning
        ↓
Action proposal
        ↓
Action Registry lookup
        ↓
Schema validation
        ↓
Risk + permission policy
        ↓
Preview / approval when required
        ↓
Deterministic executor
        ↓
Result
        ↓
Audit log
```

### 26.3 Action Registry

Initial candidate actions:

```text
task.create
task.complete
life_admin.create
life_admin.update
project.create
project.update
milestone.create
milestone.complete
document.link
record.create
trip.update
calendar.create_event
reminder.create
entity_link.create
```

The actual first Agent release may include a smaller subset.

Each action definition specifies:

- action name;
- description;
- JSON/schema-validated inputs;
- required permissions;
- risk level;
- reversibility;
- default automation level;
- executor;
- preview formatter;
- audit formatter.

### 26.4 No arbitrary SQL/tool execution

The Agent must not generate and execute arbitrary SQL as a normal user-facing action path.

The Agent must not directly call external APIs outside registered actions.

### 26.5 Context assembly

Agent reasoning may retrieve relevant canonical records, search results, entity links and provenance.

The context builder must prefer structured data over large raw dumps.

Sensitive source content should be included only when required for the requested reasoning.

## 27. Progressive Automation

### 27.1 Levels

The system supports these conceptual automation levels:

```text
Level 0 — Observe
Level 1 — Recommend
Level 2 — Prepare
Level 3 — Approve → Execute
Level 4 — Trusted automatic execution
```

### 27.2 Launch policy

No action launches at Level 4.

Initial behaviour:

- read-only intelligence may Observe/Recommend;
- low-risk internal changes may Prepare;
- material changes use Approve → Execute;
- destructive or external actions always require explicit approval unless a later design intentionally changes that policy.

### 27.3 Future trust policies

If Level 4 is later enabled, it must be configured per action type.

Example:

- `task.complete` may eventually become trusted in narrow conditions;
- `document.delete` should remain confirmation-only;
- external communication should remain separately governed.

## 28. Action audit

### 28.1 Proposed schema

```text
action_runs
- id uuid primary key
- user_id uuid not null
- action_name text not null
- proposed_by text not null
- input jsonb not null
- preview jsonb null
- risk_level text not null
- automation_level integer not null
- approval_state text not null
- approved_at timestamptz null
- executed_at timestamptz null
- result jsonb null
- error jsonb null
- idempotency_key text not null
- created_at timestamptz not null
```

### 28.2 Required properties

Action execution must be:

- idempotent where practical;
- traceable;
- attributable;
- previewable for material changes;
- testable without invoking an LLM.

An Agent explanation is not a substitute for an execution audit record.

## 29. System Health

### 29.1 User-facing behaviour

Today shows a compact overall state:

- `Systems current`
- `1 integration needs attention`
- `Gmail data is stale`

Opening the health view shows details for sources such as:

- Gmail;
- Calendar;
- Garmin/fitness;
- Google Drive;
- scheduled jobs;
- Daily Pulse generation.

### 29.2 Implementation principle

Reuse existing job/source run data wherever possible.

Do not build a separate monitoring platform solely for this feature.

Health should be derived from:

- last successful run;
- current failure state;
- expected cadence;
- stale threshold;
- connection/auth status.

## 30. Security and privacy

### 30.1 Ownership

All new persistent tables use `user_id` and RLS consistent with existing private preston.ai data.

### 30.2 OAuth tokens

Drive OAuth tokens must be encrypted at rest using the same or stronger pattern as existing Gmail credentials.

Drive integration should remain application-layer isolated from Gmail even if both use the same Google account.

The initial Drive scope is `drive.file`.

### 30.3 Sensitive Documents

Document metadata may include a sensitivity classification such as:

- standard;
- sensitive;
- highly_sensitive.

Highly sensitive content should not be sent to external AI processing unless the relevant processing path explicitly permits it.

The implementation phase must make the extraction-provider/data-handling decision explicit before enabling such processing.

### 30.4 Source minimization

Do not persist raw content solely because it is available.

Store what is necessary to support:

- canonical data;
- provenance;
- search;
- review;
- audit;
- user-requested historical context.

### 30.5 Destructive actions

Destructive actions require explicit confirmation in the initial programme.

This includes:

- deleting Drive files;
- destructive record deletion where history would be lost;
- any future external-send operation.

## 31. Error handling and reconciliation

### 31.1 General rule

External-source failures must not corrupt canonical data.

### 31.2 Google Drive failures

Examples:

- upload succeeds but Supabase write fails;
- Supabase Document is created but upload fails;
- file is deleted outside preston.ai;
- permission is revoked;
- OAuth token expires or is revoked.

Required behaviour:

- maintain processing state;
- use idempotency keys;
- make retry safe;
- avoid duplicate Drive files;
- surface unresolved failure in System Health or Review Inbox as appropriate;
- never silently fabricate a successful Document.

### 31.3 Search indexing failures

Search indexing is reconstructible.

An indexing failure must not block the canonical object mutation.

The system records stale/unindexed state and supports repair/rebuild.

### 31.4 Agent execution failures

An action failure must record:

- validated input;
- approval state;
- execution attempt;
- error;
- whether any partial change occurred.

Executors must define compensation or safe retry behaviour when partial external work is possible.

## 32. Background processing and scheduling

The programme should reuse existing Railway patterns rather than creating one service per small feature.

Preferred principles:

- batch source processing where practical;
- trigger derived work after successful source sync rather than polling unnecessarily;
- use a small number of scheduled workers for Daily Pulse / maintenance;
- keep retry/idempotency logic inside domain services;
- avoid long-running unbounded jobs;
- advance checkpoints only after successful processing, consistent with current Gmail design.

Document extraction, communication intelligence and search indexing may use queue-like database work tables if required, but a new external queue product is not a prerequisite.

## 33. Performance

This is a single-user system, so correctness and coherence matter more than premature distributed architecture.

Performance requirements:

- Today should not execute per-card N+1 queries;
- Universal Search should use indexed Postgres queries;
- entity-link lookup should be indexed by both `from_entity_id` and `to_entity_id`;
- search and extraction are derived workloads and should not block core CRUD unnecessarily;
- Daily Pulse generation should work from current canonical data and compact summaries rather than rereading full raw source corpora;
- Project/Trip pages should fetch linked entity sets in bounded queries.

## 34. Migration and backfill

### 34.1 Entity registry backfill

When the shared layer launches, backfill entity rows for supported existing canonical records.

The backfill must be idempotent.

### 34.2 Existing relationships

Existing explicit foreign keys and source-link tables remain valid.

Only relationships needed by new shared features should be mirrored into `entity_links` initially.

Do not perform a broad speculative migration of every relationship in the database.

### 34.3 Search backfill

Universal Search launch includes a controlled rebuild of searchable entities.

Search documents are derived and may be safely rebuilt from canonical data.

### 34.4 Gmail communication backfill

Communications Intelligence should not replay the entire mailbox blindly.

Initial backfill should use a bounded window and/or known existing source records.

The implementation plan must define the chosen window, checkpoint behaviour and rate limits before execution.

### 34.5 Document history

Existing Gmail attachments are not automatically copied into Drive en masse.

Document ingestion begins with new relevant attachments plus selected historical backfill approved in the implementation phase.

## 35. Testing strategy

Each implementation phase follows TDD and adds tests at the appropriate level.

### 35.1 Unit tests

Examples:

- entity registry identity;
- entity-link authority rules;
- search document generation;
- search ranking;
- document metadata extraction normalization;
- commitment state transitions;
- confidence/review routing;
- reminder presets;
- Trip readiness rules;
- Agent action validation;
- automation-level policy;
- idempotency keys.

### 35.2 Service/integration tests

Examples:

- Gmail attachment → Drive upload → Document row;
- Drive failure recovery;
- Document → Search indexing;
- new Gmail message → thread update → commitment supersession;
- Review acceptance → canonical mutation;
- Project aggregation across linked domains;
- Agent proposal → approval → executor → audit;
- Daily Pulse generation after source changes.

### 35.3 Migration tests

Every new migration must verify:

- constraints;
- ownership;
- RLS;
- idempotent backfill behaviour;
- rollback/forward safety where appropriate.

### 35.4 End-to-end acceptance tests

Representative scenarios:

1. Search for `Queenstown` and see Trip + linked Documents + Project/communications where applicable.
2. Receive a travel-insurance attachment, review/file it, then see it linked to the Trip and searchable.
3. Detect an email commitment, later process a cancelling message, and confirm the commitment is no longer shown as open.
4. Create Goal → Project → Milestones and attach existing Tasks/Documents without duplication.
5. View Today morning, process a midday source change, and see the later Daily Pulse emphasize the change.
6. Propose an Agent action, preview it, approve it, execute it once, and see an audit record.

## 36. Release decomposition

This umbrella design should be implemented as multiple independently releasable phases.

### v0.15 — Intelligence Foundation

Primary scope:

- Entity Registry;
- Entity Links;
- generic provenance bridge;
- Universal Search foundation;
- initial indexing of existing domains;
- persistent product navigation.

Exit criteria:

- existing domains remain canonical;
- entity backfill succeeds idempotently;
- search returns useful cross-domain results;
- provenance remains intact;
- no existing workflow regression.

### v0.16 — Goals & Daily Pulse

Primary scope:

- Goals;
- Projects;
- Milestones;
- Project relationships;
- Today evolution;
- Daily Pulse;
- dashboard quick actions;
- first-class Waiting;
- Global Quick Add;
- context-aware Quick Add;
- contextual reminder presets;
- compact System Health.

Exit criteria:

- Projects do not duplicate Tasks;
- linked objects aggregate correctly;
- Today can update throughout the day;
- quick actions use canonical services;
- Waiting semantics are clear.

### v0.17 — Documents & Search Expansion

Primary scope:

- Google Drive OAuth with `drive.file`;
- `preston.ai Documents` Drive folder;
- Google Picker;
- Documents model;
- extraction pipeline;
- entity linking;
- Gmail attachment filing;
- document provenance;
- document search indexing.

Exit criteria:

- files live in Drive, not Railway/Supabase binary storage;
- duplicate attachment ingestion is prevented;
- missing/revoked Drive files are handled safely;
- Search includes Documents;
- sensitive-file handling is explicit.

### v0.18 — Communications Intelligence

Primary scope:

- communication threads;
- thread summaries;
- commitment detection;
- waiting direction;
- commitment supersession/resolution;
- shared Review Inbox;
- confidence policy.

Exit criteria:

- later messages can correctly supersede earlier commitment state;
- uncertain changes route to review;
- Gmail remains read-only;
- full-mail duplication is not introduced.

### v0.19 — Context & Records

Primary scope:

- Trip Readiness;
- Pre-Trip Briefings;
- suggested Trip archival;
- Records;
- Record/entity/document linking;
- deeper source/provenance presentation.

Exit criteria:

- readiness does not invent requirements;
- archival is suggestion-only;
- Records remain distinct from Documents and story Archive;
- Pre-Trip Briefings are source-grounded.

### v0.20 — Agent

Primary scope:

- Action Registry;
- Agent context builder;
- action proposals;
- schema/risk validation;
- approval flow;
- deterministic executors;
- action audit;
- progressive automation levels;
- a conservative initial action set.

Exit criteria:

- no unrestricted SQL/API execution;
- all material actions are previewable/audited;
- retries are safe;
- no Level-4 automatic actions launch by default;
- Gmail write permissions remain unchanged unless separately approved.

## 37. Release process

Each phase receives:

1. a detailed implementation plan;
2. an isolated implementation branch;
3. TDD coverage;
4. migration verification;
5. UAT where applicable;
6. release gates;
7. explicit merge/deploy decision.

This umbrella design does not authorize implementation of all phases at once.

A later phase may refine internal schemas when implementation evidence requires it, but it must preserve the architectural principles in this document unless the design is explicitly amended.

## 38. Acceptance criteria for the overall programme

The programme is successful when:

1. a user can search across preston.ai without knowing which module owns the data;
2. cross-domain relationships are represented through a common link model without replacing canonical domain tables;
3. important files live in the user’s Google Drive and remain intelligible/searchable in preston.ai;
4. Gmail attachments can become Documents safely and idempotently;
5. communication commitments are thread-aware and can be resolved/superseded correctly;
6. uncertain automation has one shared Review Inbox;
7. Goals, Projects and Milestones organize work without duplicating Tasks;
8. Today updates meaningfully throughout the day and emphasizes changes;
9. Waiting is visible and understandable;
10. Trip readiness and briefings are useful without inventing missing requirements;
11. Records preserve meaningful historical context distinct from file storage;
12. every imported/inferred/actionable item can expose useful provenance;
13. the Agent operates only through registered, validated actions;
14. material Agent actions require appropriate approval and produce an audit trail;
15. no autonomous destructive or external action is introduced by default;
16. the system continues to run comfortably within the existing Railway + Supabase architecture.

## 39. Design decisions locked by this spec

The following decisions are considered approved architectural constraints unless this design is amended:

- existing domain tables remain canonical;
- cross-domain intelligence uses Entity Registry + Entity Links;
- Supabase/Postgres remains the shared data/intelligence store;
- Railway remains the application/worker environment;
- Google Drive is the binary file store for Documents;
- Drive authorization begins with `drive.file`, not whole-Drive read access;
- Supabase stores document metadata/extracted intelligence, not the canonical binary file;
- Documents and Records are distinct concepts;
- Gmail remains read-only through the initial Agent programme;
- Communications Intelligence is thread-aware;
- Review Inbox is shared across intelligent subsystems;
- Today/Daily Pulse remains distinct from Morning Digest;
- the Agent uses a fixed Action Registry and deterministic executors;
- no Level-4 automation launches by default;
- Trip archival remains user-confirmed;
- Universal Search starts with Postgres full-text/fuzzy search; semantic embeddings are optional later;
- no graph/search/vector/queue infrastructure product is required initially.

## 40. Open implementation details intentionally deferred

The following are not architectural ambiguities; they are implementation-plan decisions to be made in the relevant phase:

- exact UI layout and responsive treatment of the persistent nav;
- exact ranking weights for Universal Search;
- whether entity registration is eager or lazy per legacy domain;
- exact Daily Pulse worker/cron wiring;
- exact bounded Gmail backfill window for Communications Intelligence;
- exact document extraction library/provider choices;
- exact list of first Agent actions in v0.20;
- which low-risk review proposals may auto-confirm after confidence thresholds are measured;
- exact sensitivity rules for external AI processing of highly sensitive Documents.

Those decisions must be resolved before implementation of the relevant phase and must not contradict the locked design decisions above.
