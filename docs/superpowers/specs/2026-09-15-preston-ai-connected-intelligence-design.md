# preston.ai Connected Intelligence Design

Date: 2026-09-15  
Status: Proposed for review — approved architecture with Amendment 1 applied  
Repository: `ppodolske/preston-run`  
Production branch: `build/preston-ai-v0.11.0`  
Scope: Umbrella architecture for the v0.15-v0.20 programme

## 1. Summary

This design evolves preston.ai from a collection of useful personal dashboards and domain-specific automations into a connected personal operating system.

The approved programme adds:

- Universal Personal Search;
- Personal Knowledge Graph / entity linking;
- Google Drive-backed Documents;
- whole-Drive discovery/backfill for user-owned My Drive content;
- Drive organisation intelligence and proposed reorganisation plans;
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
- one unified Today dashboard that includes recovery/training intelligence;
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

This is an umbrella design, not a single-release implementation specification. Each implementation phase must receive its own focused Superpowers design/spec, implementation plan, release gate and explicit merge/deploy decision.

## 2. Amendments incorporated

### 2.1 Amendment 1 — unified Today

The previous design kept Morning Digest visually separate from Today. That decision is superseded.

There will be one user-facing home dashboard: **Today**.

Existing Morning Digest fitness/recovery intelligence remains valuable but becomes the **Recovery & Training** section within Today. The separate Morning Digest dashboard/card experience is retired as a standalone morning destination.

Daily Pulse remains an internal intelligence/snapshot concept used to refresh Today throughout the day. It is not a separate page the user must check.

### 2.2 Amendment 1 — whole-Drive discovery

The previous design limited Drive access to `drive.file` and explicitly excluded whole-Drive crawling. That decision is superseded.

preston.ai will be designed to inventory and read the user's existing **user-owned My Drive** content for document backfill, search, relationship discovery and organisation recommendations.

The initial permission model is:

- `drive.readonly` for whole-Drive discovery/read access;
- `drive.file` for files created by preston.ai or explicitly selected/granted to preston.ai for write operations.

Broad Drive read access must not imply broad Drive write authority.

Whole-Drive reorganisation is **proposal-first**. preston.ai may analyse and recommend moves, renames, folder consolidation and duplicate handling, but must not silently reorganise the user's Drive.

## 3. Current-state principles to preserve

### 3.1 Existing domain objects remain authoritative

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

The intelligence layer points to these objects. It does not create parallel versions.

### 3.2 Manual authority remains protected

Where an automated source and a manually confirmed value conflict, the manual value remains authoritative unless the user explicitly changes it.

This applies to:

- entity links;
- document metadata;
- Drive organisation decisions;
- commitment state;
- project relationships;
- reminder choices;
- Agent-created or Agent-proposed changes.

### 3.3 Gmail remains read-only in the initial Agent programme

The current Gmail integration uses `gmail.readonly`.

This programme does not require Gmail sending, labelling, archiving or mailbox modification in its initial phases.

Future Gmail drafting/sending requires a separate permission expansion and explicit re-authorization.

### 3.4 One home surface

Today answers all three questions:

> How am I doing?

> What matters now?

> What has changed since I last looked?

Recovery/training, tasks, calendar, Life Admin, commitments, travel and system health are coordinated within that single surface.

## 4. Product goals

The completed system should allow the user to:

- find information across preston.ai from one search surface;
- understand how people, trips, projects, documents, email threads and records relate;
- capture goals and projects without creating a second task manager;
- use Google Drive as the canonical binary document store;
- understand and backfill useful information from existing user-owned Drive files;
- receive practical recommendations for simplifying and organising Drive without automatic broad mutation;
- detect commitments and follow-ups from Gmail at thread level;
- review uncertain automation in one shared place;
- use Today as the one dashboard for recovery, planning and action;
- have Today evolve meaningfully through the day as data changes;
- receive useful pre-trip readiness and briefing intelligence;
- keep a durable historical record of meaningful outcomes and evidence;
- allow an Agent to propose and eventually perform well-defined actions without unrestricted access to application internals;
- see where imported or inferred information came from;
- understand whether source integrations are current and healthy.

## 5. Architecture goals

The design must:

- reuse Supabase/Postgres and Railway;
- avoid unnecessary new infrastructure;
- preserve existing canonical tables;
- provide common primitives for relationships, provenance, search, review and actions;
- allow features to ship in independent phases;
- remain understandable and testable at module level;
- default to safe, reversible behaviour;
- make automation confidence, risk and authority explicit;
- avoid silent destructive actions;
- treat Drive crawling as bounded, resumable and checkpointed work rather than one unbounded job;
- remain appropriate for a single-user private system while preserving ownership/RLS patterns.

## 6. Non-goals

This programme will not initially add:

- Neo4j or another graph database;
- Elasticsearch or OpenSearch;
- Pinecone or another external vector database;
- Kafka or a separate event-stream platform;
- a separate document-storage server;
- autonomous Gmail sending;
- autonomous financial transactions or payments;
- unrestricted LLM database access;
- a general-purpose workflow builder;
- a replacement for Google Drive;
- a replacement for Gmail;
- a second task-management model inside Projects;
- automatic creation of Records for every minor event;
- automatic Trip archival without user approval;
- automatic broad Drive reorganisation;
- automatic deletion of Drive files;
- crawling Shared With Me or shared drives as part of the initial Drive backfill;
- Level-4 autonomous actions at launch.

## 7. Chosen architecture

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
Today
Review Inbox
Trip Readiness
Pre-Trip Briefings
Drive Organisation Review
Agent
Records
```

No canonical domain is replaced by the entity registry.

## 8. Entity Registry

`entity_registry` provides a generic identity for a canonical record.

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
- no business fields duplicated from canonical tables.

Initial entity types:

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

Entity creation may be eager or lazy by domain. Deletion/tombstone behaviour is resolved in the relevant phase spec.

## 9. Entity Links

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

Proposed schema:

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

Rules:

- manual links are immediately confirmed;
- deterministic source-explicit links may auto-confirm;
- inferred links follow confidence/review policy;
- rejected links must not silently reappear from identical evidence;
- confirmed manual corrections win over later inference;
- links are directional at storage level.

## 10. Provenance

Any imported, inferred or Agent-created object should be able to answer:

> Where did this come from?

Initial source types:

- `manual`
- `gmail`
- `google_drive`
- `calendar`
- `garmin`
- `system_inference`
- `agent_action`

Generic bridge:

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

Existing domain-specific provenance remains valid. The generic layer bridges to it instead of forcing immediate rewrites.

Field-level provenance is required only where automated extraction materially changes structured data.

## 11. Universal Personal Search

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

Proposed index:

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

Initial ranking:

1. exact title/reference matches;
2. full-text search;
3. fuzzy/trigram match;
4. date/context boosts.

Enable `pg_trgm` for fuzzy matching. Semantic embeddings are optional later; if added, use pgvector in Supabase rather than a new vector service.

Search indexing is derived, idempotent and rebuildable from canonical data.

## 12. Goals, Projects and Milestones

Definitions:

- **Goal** = desired longer-term outcome;
- **Project** = finite body of work toward an outcome;
- **Milestone** = meaningful project checkpoint;
- **Task** = next action;
- **Life Admin** = obligation/deadline/bill/appointment/administrative item.

Projects do not introduce a second task system.

### 12.1 Goals

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

Suggested statuses: `active`, `paused`, `completed`, `abandoned`.

### 12.2 Projects

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

Suggested statuses: `planned`, `active`, `waiting`, `completed`, `cancelled`.

### 12.3 Milestones

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

Tasks, Life Admin, Documents, People, Trips, Records and Communication Threads link to Projects through the entity-link layer unless an existing canonical FK is already clearly appropriate.

## 13. Documents and Google Drive

### 13.1 Storage split

- **Google Drive** = canonical binary file store;
- **Supabase** = document metadata, extracted text, relationships, processing state and search representation;
- **Railway** = ingestion/processing workers;
- **preston.ai** = UI, intelligence, review and actions.

Drive file IDs are authoritative references; folder paths are not.

### 13.2 OAuth permission model

The approved model intentionally uses two Drive capabilities:

- `drive.readonly` — inventory, read and download files across the authorised Drive corpus;
- `drive.file` — create/manage files preston.ai creates or files explicitly selected/shared for app write access.

`drive.readonly` is a Google restricted scope. The v0.17 phase must include a release gate covering the appropriate OAuth verification/security-assessment path before production whole-Drive crawling is enabled.

Drive OAuth tokens must be encrypted at rest using the same or stronger pattern as Gmail credentials.

Drive authorization remains application-layer isolated from Gmail even when both use the same Google account.

### 13.3 Initial crawl corpus

Initial Drive discovery includes:

- files and folders owned by the user in My Drive;
- Google-native files and ordinary uploaded files where readable;
- files regardless of whether they live inside a preston.ai-created folder.

Initial crawl excludes by default:

- Trash;
- hidden app data;
- Shared With Me content owned by other people;
- shared drives;
- content inaccessible under the authorised account.

Those exclusions may be expanded later through a separate design/configuration decision.

### 13.4 Drive inventory

The first pass is metadata-first and does not immediately send every file to extraction/AI processing.

Inventory captures where available:

```text
drive_file_id
name
mime_type
parents / folder structure
created_time
modified_time
size
ownership
shortcut state
trashed state
capabilities relevant to later actions
```

The inventory is resumable and checkpointed. It must not be implemented as one unbounded Railway job.

### 13.5 Content backfill

After inventory, eligible files are progressively processed for useful personal knowledge.

Priority may be based on:

- likely document type;
- recency;
- location/folder context;
- known entities such as Trips/Projects/People;
- filename signals;
- user-selected folders or batches.

Existing Drive files are not copied merely to make them preston.ai Documents. The Document record points to the existing Drive file ID.

### 13.6 Documents schema

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

- `discovered`
- `pending`
- `processing`
- `ready`
- `needs_review`
- `failed`
- `unavailable`
- `excluded`

### 13.7 Document processing

Processing may extract:

- title;
- document type;
- issuer/provider;
- important dates;
- reference/policy numbers;
- summary;
- searchable text;
- potential links to existing entities.

Digital text extraction is preferred before OCR. OCR/multimodal processing is used only when necessary.

Original Drive files remain unmodified during extraction.

### 13.8 File lifecycle

Two separate concepts remain required:

1. **Remove from preston.ai** — remove/archive preston.ai metadata/index relationships while leaving the Drive file intact;
2. **Delete Drive file** — destructive external action requiring explicit confirmation and not included in the initial Agent action set.

If a file moves, identity persists through the Drive file ID.

If a file disappears or access is revoked, preston.ai marks the Document unavailable rather than deleting history silently.

## 14. Drive Organisation Intelligence

### 14.1 Purpose

Drive Organisation Intelligence analyses the existing Drive structure and recommends ways to make the document library more coherent and efficient.

It may identify:

- duplicate or near-duplicate files;
- inconsistent naming conventions;
- files spread across redundant folders;
- overly deep folder hierarchies;
- root-folder clutter;
- empty or stale folders;
- outdated duplicate copies;
- documents that belong with an existing Project, Trip or Record;
- parallel categories such as `Travel`, `Trips`, `Holiday` that could be consolidated;
- folder structures that conflict with preston.ai's actual entity relationships.

### 14.2 Recommendation model

A Drive Organisation Review presents current structure, proposed structure and concrete proposed actions.

Example:

```text
Current
Travel/
Trips/
Holidays/
NZ/
Queenstown 2026/
Bookings/

Suggested
Travel/
  2026/
    Queenstown/
      Bookings/
      Insurance/
      Activities/

Proposed
- move 17 files
- rename 4 files
- merge 3 redundant folders
- flag 2 possible duplicates
- delete 0 files
```

### 14.3 Safety model

At initial launch:

- whole-Drive analysis is read-only;
- recommendations may be accepted/rejected individually or as a plan;
- accepting a recommendation does not automatically imply preston.ai has permission to execute it;
- files/folders are never deleted automatically;
- broad move/rename execution requires a separately designed write-authority path.

Where `drive.file` already provides write access to a specific app-managed file, preston.ai may eventually execute approved file-local actions through the Agent, but broad reorganisation across arbitrary existing files is out of scope until a later write-permission design is explicitly approved.

### 14.4 Folder hierarchy is not canonical truth

preston.ai entity links remain authoritative for semantic relationships.

Drive folders are useful for human organisation, but the system must not infer that a file stopped relating to a Project/Trip merely because the user moved it to another folder.

## 15. Gmail Attachment → Documents

Important Gmail attachments can become first-class Documents without manual download/re-upload.

Flow:

```text
Gmail attachment discovered
        ↓
Relevance classification
        ↓
Attachment fetched when needed
        ↓
Document extraction
        ↓
Potential entity links
        ↓
Confidence/review policy
        ↓
File created in Google Drive
        ↓
Document row + Gmail provenance
        ↓
Entity links
        ↓
Search index
```

The ingestion path is idempotent. Dedupe uses Gmail source/attachment identity, Drive file identity and checksum as supporting evidence.

Existing historical Gmail attachments are not copied into Drive en masse without a bounded backfill plan.

## 16. Communications Intelligence

Message-level facts are evidence. The thread is the canonical communication object.

The system aims to identify:

- requests for action;
- user commitments;
- commitments made by others;
- deadlines;
- expected follow-ups;
- waiting direction;
- resolution/cancellation;
- relevant People, Trips and Projects.

Proposed thread model:

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

Suggested thread statuses: `active`, `resolved`, `ignored`.

Suggested waiting direction: `none`, `waiting_on_me`, `waiting_on_other`, `unclear`.

Raw Gmail content is fetched when processing requires it. preston.ai stores structured facts, summaries, commitments, provenance and search-safe derived text rather than blindly duplicating the entire mailbox.

Later messages may fulfil, cancel or supersede older commitments and reverse waiting direction.

## 17. Commitment Detection

Proposed model:

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

Suggested statuses: `proposed`, `open`, `completed`, `cancelled`, `superseded`.

A detected commitment is not automatically a Task or Life Admin item. It may propose one when useful.

## 18. Shared Review Inbox

Review Inbox is shared across intelligent subsystems, not Gmail-only.

Initial proposal types:

- Gmail classification;
- commitment creation/update;
- document classification;
- document filing;
- document/entity linking;
- entity linking;
- Drive organisation recommendations;
- trip linking;
- project linking;
- Agent action proposals needing judgement.

Proposed model:

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

Suggested states: `pending`, `accepted`, `rejected`, `deferred`, `expired`.

Policy:

```text
High confidence + low-risk internal enrichment
→ may apply automatically where policy explicitly allows

High confidence + material change
→ prepare and ask

Low confidence
→ Review Inbox

Destructive or external action
→ explicit confirmation
```

## 19. Today — unified home dashboard

### 19.1 Product definition

Today is the one primary home dashboard.

There is no separate Morning Digest dashboard the user must check.

Today combines:

- Recovery & Training;
- tasks and Life Admin;
- open commitments and Waiting;
- calendar and appointments;
- Trips and travel readiness where relevant;
- Goals/Projects needing attention;
- Review Inbox items where important;
- system health when relevant;
- changes since the previous pulse.

### 19.2 Morning view

The morning Today view should include the existing Morning Digest intelligence inside a **Recovery & Training** section.

Representative structure:

```text
TODAY
Good morning

Recovery & Training
- sleep/recovery
- planned workout
- key fitness insight

Needs your attention
- tasks
- Life Admin
- commitments
- Waiting

Your day
- calendar
- trips
- important events

Projects & Goals
- relevant milestones / next actions

System health
- compact status only when useful
```

### 19.3 Daily Pulse

Daily Pulse is an internal mechanism that updates Today as source data changes.

Initial windows align with existing source-refresh cadence:

- **Morning** — after morning Gmail, Calendar and fitness refreshes;
- **Midday** — after midday source refresh;
- **Afternoon/evening** — after early-evening source refresh;
- **Late** — primarily to prepare tomorrow context.

Exact cron/service wiring is deferred to the v0.16 phase spec.

### 19.4 Time-of-day behaviour

Morning emphasises:

- recovery/training;
- today's plan;
- overnight changes;
- first priorities.

Midday emphasises:

- what changed since morning;
- what is complete;
- what still matters;
- new commitments/calendar changes.

Afternoon/evening emphasises:

- remaining actions;
- waiting/follow-ups;
- preparation for tomorrow;
- significant changes since midday.

Late view emphasises tomorrow only when useful rather than keeping stale morning content prominent.

### 19.5 Change awareness

Later pulses should explain meaningful deltas, for example:

- “Two things changed since this morning.”
- “Your 3pm appointment moved to 4pm.”
- “The Queenstown insurance document was found in Drive and linked to the Trip.”
- “You are still waiting on one reply.”

### 19.6 Notification restraint

Today may update frequently without producing a push notification each time.

Push notifications are reserved for meaningful, time-sensitive changes or items requiring attention.

Morning notification opens Today rather than a separate digest page.

## 20. Dashboard Quick Actions

Today cards expose context-appropriate actions such as:

- Complete;
- Snooze;
- Mark waiting;
- Review;
- Open;
- Add reminder;
- Archive Trip suggestion;
- confirm/reject proposed link.

Actions use canonical application services rather than dashboard-specific mutation logic.

## 21. Waiting as a first-class view

Waiting may aggregate:

- Life Admin in `waiting`;
- Projects in `waiting`;
- commitments with `waiting_on_other`;
- Agent proposals waiting on external conditions.

The UI distinguishes **waiting on me** from **waiting on someone/something else**.

## 22. Global and Context-Aware Quick Add

Global Quick Add may create:

- Task;
- Life Admin;
- Goal;
- Project;
- Milestone;
- Trip;
- Person;
- Document;
- Record.

When opened from a canonical entity page it pre-populates the relationship, but the user can change/remove the proposed context before saving.

## 23. Persistent product navigation

Target shell:

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

Search and Quick Add are global controls rather than low-priority nav items.

Goals may live within Projects. Review Inbox appears as a contextual/global inbox indicator when pending items exist.

## 24. Trip Readiness

Trip Readiness is the intelligence engine beneath Pre-Trip Briefings.

Initial checks may include:

- transport;
- accommodation where expected;
- critical Bookings;
- required/linked Documents;
- open Trip tasks;
- unresolved Trip Life Admin;
- calendar conflicts;
- unresolved travel review items;
- important missing dates/locations.

The system must not invent universal travel requirements.

Example derived states: `ready`, `attention`, `incomplete`, `insufficient_data`.

## 25. Pre-Trip Briefing

A Pre-Trip Briefing combines:

- Trip dates;
- next Booking/Stage;
- transport/accommodation summary;
- important Documents;
- outstanding Tasks/Life Admin;
- readiness issues;
- relevant calendar context;
- important recent communication changes;
- source freshness.

It clearly distinguishes confirmed information, missing information and suggestions.

## 26. Suggested Trip Archival

The system may suggest archival when the Trip is past, has no meaningful future itinerary and is not already archived.

The user must confirm.

No automatic Trip archival is introduced.

## 27. Contextual Reminder Presets

Defaults depend on object type, for example:

- birthday: 7 days / 1 day;
- document expiry: 90 / 30 / 7 days;
- Trip departure: 7 / 1 days;
- Life Admin deadline: category-aware presets;
- commitment: expected-response-aware presets;
- Project milestone: target-date-aware presets.

User-selected reminder timing remains authoritative.

## 28. Records

A **Document** is a file.

A **Record** is a durable historical account of something meaningful that happened.

Example:

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

Records may be created manually, suggested by the system, or prepared by the Agent for approval.

Do not automatically create Records for every completed task, email or Trip.

The product term is **Records**, not Archive, to avoid confusion with the separate story-archive product.

## 29. Agent architecture

The Agent does not receive unrestricted write access to the database or external APIs.

Flow:

```text
User request / system insight
        ↓
Agent reasoning
        ↓
Action proposal
        ↓
Action Registry
        ↓
Schema validation
        ↓
Risk + permission policy
        ↓
Preview / approval where required
        ↓
Deterministic executor
        ↓
Result
        ↓
Audit log
```

Initial candidate actions may include:

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

The initial v0.20 release may include a smaller subset.

No arbitrary SQL execution or arbitrary external API execution is allowed as a normal Agent action path.

## 30. Progressive Automation

Levels:

```text
Level 0 — Observe
Level 1 — Recommend
Level 2 — Prepare
Level 3 — Approve → Execute
Level 4 — Trusted automatic execution
```

No action launches at Level 4.

Read-only intelligence may Observe/Recommend. Low-risk internal changes may Prepare. Material changes use Approve → Execute. Destructive or external actions require explicit approval unless a later design intentionally changes that policy.

## 31. Action audit

Proposed model:

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

Actions must be traceable, attributable, previewable for material changes, idempotent where practical and testable without an LLM.

## 32. System Health

Today shows a compact overall state such as:

- `Systems current`
- `1 integration needs attention`
- `Drive backfill paused`
- `Gmail data is stale`

Detail may include:

- Gmail;
- Calendar;
- Garmin/fitness;
- Google Drive;
- Drive crawl/backfill;
- scheduled jobs;
- Daily Pulse generation.

Health is derived from last successful run, failure state, expected cadence, stale threshold and auth/connection state.

Do not build a separate monitoring platform solely for this feature.

## 33. Security and privacy

### 33.1 Ownership and RLS

All new persistent tables use `user_id` and RLS consistent with existing private preston.ai data.

### 33.2 Restricted Drive scope gate

Because whole-Drive reading requires `drive.readonly`, v0.17 must explicitly verify the Google restricted-scope requirements appropriate to the deployed OAuth application before production enablement.

If restricted-scope data is stored or transmitted server-side, the phase must account for Google's applicable verification/security-assessment requirements.

This is a release gate, not a reason to weaken the approved product design silently.

### 33.3 Data minimisation

Whole-Drive access does not justify copying every file body into Supabase.

Store what is necessary to support:

- canonical Document metadata;
- provenance;
- search;
- linking;
- review;
- Records;
- organisation analysis;
- user-requested historical context.

### 33.4 Sensitive Documents

Document sensitivity may include `standard`, `sensitive`, `highly_sensitive`.

Highly sensitive content must not be sent to external AI processing unless the relevant processing path explicitly permits it.

The v0.17 phase must make extraction-provider/data-handling rules explicit before enabling such processing.

### 33.5 Destructive actions

Destructive external actions require explicit confirmation.

The initial programme does not allow the Agent to delete arbitrary Drive files or broadly reorganise Drive automatically.

## 34. Error handling and reconciliation

External failures must not corrupt canonical data.

Drive scenarios include:

- inventory page succeeds but checkpoint write fails;
- extraction fails for one file;
- file disappears mid-backfill;
- access is revoked;
- OAuth token expires/revokes;
- preston.ai-created upload succeeds but Supabase write fails;
- Supabase Document exists but upload fails.

Required behaviour:

- persistent checkpoints;
- safe retries;
- idempotency keys where appropriate;
- no duplicate Drive files from retry;
- no duplicate Document records from crawl replay;
- individual-file failures do not abort the entire crawl;
- unresolved failures surface through System Health or Review Inbox;
- no fabricated success state.

Search indexing remains reconstructible and must not block canonical CRUD.

Agent failures record validated input, approval state, execution attempt, error and any partial mutation.

## 35. Background processing and scheduling

Reuse existing Railway patterns rather than creating one service per small feature.

Principles:

- batch processing where practical;
- trigger derived work after successful source sync;
- use a small number of scheduled workers;
- keep retry/idempotency logic inside domain services;
- avoid long-running unbounded jobs;
- advance checkpoints only after successful bounded work;
- give Drive crawling/backfill explicit batch/page limits and resumable cursors;
- allow pause/resume and progress reporting for Drive backfill.

Database work tables may provide queue-like behaviour without adding an external queue product initially.

## 36. Performance

Performance requirements:

- Today avoids per-card N+1 queries;
- Universal Search uses indexed Postgres queries;
- entity links are indexed in both directions;
- derived search/extraction work does not block core CRUD unnecessarily;
- Daily Pulse uses current canonical data and compact summaries rather than rereading raw corpora;
- Project/Trip pages fetch linked entity sets in bounded queries;
- Drive inventory uses pagination and bounded batches;
- content extraction is progressive rather than a single full-Drive burst;
- crawl status/progress is observable.

## 37. Migration and backfill

### 37.1 Entity registry

Backfill supported canonical records idempotently.

### 37.2 Existing relationships

Existing explicit FKs and source-link tables remain valid. Mirror only relationships needed by new shared features rather than speculatively converting every historical relationship.

### 37.3 Search

Universal Search launch includes a controlled rebuild of supported existing entities. Search documents are derived and rebuildable.

### 37.4 Gmail communications

Do not replay the entire mailbox blindly. The v0.18 phase chooses a bounded historical window and checkpoint/rate-limit policy.

### 37.5 Drive document backfill

Drive backfill intentionally differs from Gmail backfill: the approved product goal is to inventory user-owned My Drive comprehensively.

Backfill occurs in stages:

1. authenticate/verify corpus;
2. metadata inventory;
3. structural/folder analysis;
4. prioritise eligible content;
5. extract/classify in bounded batches;
6. create/update Document records;
7. propose entity links;
8. index searchable content;
9. generate Drive Organisation Review recommendations.

The crawl is resumable and repeatable. Re-running it updates changed files and must not duplicate unchanged Documents.

Historical Gmail attachments are not copied into Drive merely because similar files are discovered in Drive.

## 38. Testing strategy

Each phase follows TDD.

### 38.1 Unit tests

Examples:

- entity registry identity;
- entity-link authority;
- search document generation/ranking;
- document metadata normalisation;
- Drive ownership/corpus filters;
- Drive crawl cursor/checkpoint logic;
- Drive dedupe/change detection;
- organisation recommendation generation;
- commitment state transitions;
- confidence/review routing;
- reminder presets;
- Trip readiness rules;
- Agent action validation;
- automation-level policy;
- idempotency keys.

### 38.2 Integration tests

Examples:

- existing Drive file → inventory → Document row → Search;
- crawl interruption → resume without duplicates;
- Drive file move → same Document identity;
- Drive file deletion → unavailable state;
- organisation analysis → proposal only, no mutation;
- Gmail attachment → Drive upload → Document row;
- Document → Search indexing;
- new Gmail message → thread update → commitment supersession;
- Review acceptance → canonical mutation;
- Project aggregation across linked domains;
- Agent proposal → approval → executor → audit;
- Daily Pulse generation after source changes;
- Recovery & Training appears in Today without a separate Morning Digest destination.

### 38.3 End-to-end acceptance scenarios

1. Search `Queenstown` and see Trip + linked Documents + Project/communications where applicable.
2. Run Drive backfill, discover an existing travel-insurance file, classify it and propose the correct Trip link without copying the file.
3. Review a Drive organisation plan and confirm no files were moved merely by generating/accepting the review proposal.
4. Receive a new Gmail travel-insurance attachment, file it to Drive and make it searchable without duplication.
5. Detect an email commitment, process a later cancellation and ensure it no longer appears open.
6. Create Goal → Project → Milestones and link existing Tasks/Documents without duplication.
7. Open Today in the morning and see recovery/training plus action context on one page.
8. Process a midday source change and see Today emphasise the delta rather than creating a second dashboard.
9. Propose an Agent action, preview it, approve it, execute it once and see an audit record.

## 39. Release decomposition

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
- entity backfill is idempotent;
- search returns useful cross-domain results;
- provenance remains intact;
- no existing workflow regression.

### v0.16 — Goals & Today Intelligence

Primary scope:

- Goals;
- Projects;
- Milestones;
- Project relationships;
- unify Morning Digest intelligence into Today;
- Recovery & Training section;
- Daily Pulse/time-of-day evolution;
- dashboard quick actions;
- first-class Waiting;
- Global Quick Add;
- context-aware Quick Add;
- contextual reminder presets;
- compact System Health.

Exit criteria:

- there is one home dashboard, Today;
- existing fitness/recovery intelligence remains available within Today;
- no duplicate Morning Digest destination remains necessary;
- Projects do not duplicate Tasks;
- linked objects aggregate correctly;
- Today updates meaningfully during the day;
- quick actions use canonical services;
- Waiting semantics are clear.

### v0.17 — Drive Intelligence & Documents

Primary scope:

- Google Drive OAuth with `drive.readonly` + `drive.file`;
- restricted-scope production release gate;
- user-owned My Drive inventory;
- resumable metadata crawl;
- Documents model;
- progressive extraction/classification;
- Drive-to-entity linking;
- whole-Drive document backfill;
- Drive Organisation Review;
- reorganisation recommendations;
- Google Picker for explicit write-grant/file selection workflows where still useful;
- Gmail attachment filing;
- document provenance;
- Search expansion to Documents.

Exit criteria:

- restricted-scope requirements are resolved before production crawl enablement;
- My Drive crawl is bounded, resumable and observable;
- existing Drive files become Documents without unnecessary copying;
- duplicate crawl/attachment ingestion is prevented;
- missing/revoked Drive files are handled safely;
- Search includes backfilled Documents;
- organisation recommendations do not mutate arbitrary existing Drive content;
- sensitive-file processing rules are explicit.

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

- later messages can supersede earlier commitment state;
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
- deeper provenance presentation.

Exit criteria:

- readiness does not invent requirements;
- archival is suggestion-only;
- Records remain distinct from Documents and story Archive;
- briefings are source-grounded.

### v0.20 — Agent

Primary scope:

- Action Registry;
- Agent context builder;
- action proposals;
- schema/risk validation;
- approval flow;
- deterministic executors;
- action audit;
- progressive automation;
- conservative initial action set.

Exit criteria:

- no unrestricted SQL/API execution;
- material actions are previewable/audited;
- retries are safe;
- no Level-4 action launches by default;
- Gmail write permissions remain unchanged unless separately approved;
- broad Drive write/reorganisation authority is not introduced unless separately approved.

## 40. Release process

This umbrella design does not authorize implementation of all phases at once.

Each phase receives, in order:

1. a focused Superpowers phase design/spec refining only that phase;
2. user review/approval of that phase spec;
3. a detailed implementation plan;
4. an isolated implementation branch;
5. TDD coverage;
6. migration/integration verification;
7. UAT where applicable;
8. release gates;
9. explicit merge/deploy decision.

A phase may refine internal schemas when implementation evidence requires it, but must preserve this document's locked architectural decisions unless this umbrella design is explicitly amended.

## 41. Overall acceptance criteria

The programme is successful when:

1. the user can search across preston.ai without knowing which module owns the data;
2. cross-domain relationships use a common link model without replacing canonical domain tables;
3. important files remain in Google Drive while becoming intelligible/searchable in preston.ai;
4. existing user-owned My Drive content can be progressively backfilled into Documents;
5. Drive structure can be analysed and simplified through recommendations without silent broad mutation;
6. Gmail attachments can become Documents safely and idempotently;
7. communication commitments are thread-aware and can be resolved/superseded;
8. uncertain automation has one shared Review Inbox;
9. Goals, Projects and Milestones organise work without duplicating Tasks;
10. Today is the single home dashboard and includes recovery/training intelligence;
11. Today updates meaningfully throughout the day and emphasises changes;
12. Waiting is visible and understandable;
13. Trip readiness and briefings are useful without inventing requirements;
14. Records preserve meaningful historical context distinct from file storage;
15. imported/inferred/actionable items expose useful provenance;
16. the Agent operates only through registered, validated actions;
17. material Agent actions require appropriate approval and produce an audit trail;
18. no autonomous destructive or external action is introduced by default;
19. the system continues to run within the existing Railway + Supabase architecture.

## 42. Locked design decisions

The following are approved architectural constraints unless this design is amended:

- existing domain tables remain canonical;
- cross-domain intelligence uses Entity Registry + Entity Links;
- Supabase/Postgres remains the shared data/intelligence store;
- Railway remains the application/worker environment;
- Google Drive is the binary file store for Documents;
- whole-Drive discovery uses `drive.readonly` for user-owned My Drive;
- app-managed file writing uses `drive.file` initially;
- broad Drive read access does not imply broad Drive write authority;
- Drive backfill is bounded, resumable and checkpointed;
- Drive Organisation Intelligence is proposal-first;
- broad automatic Drive reorganisation/deletion is not allowed initially;
- Supabase stores document metadata/extracted intelligence, not canonical binary files;
- Documents and Records are distinct concepts;
- Gmail remains read-only through the initial Agent programme;
- Communications Intelligence is thread-aware;
- Review Inbox is shared across intelligent subsystems;
- Today is the sole primary home dashboard;
- Morning Digest is absorbed into Today's Recovery & Training intelligence;
- Daily Pulse is an internal Today-update mechanism, not a second dashboard;
- the Agent uses a fixed Action Registry and deterministic executors;
- no Level-4 automation launches by default;
- Trip archival remains user-confirmed;
- Universal Search starts with Postgres full-text/fuzzy search; semantic embeddings are optional later;
- no graph/search/vector/queue infrastructure product is required initially.

## 43. Open implementation details intentionally deferred

These are implementation-plan decisions, not unresolved architecture:

- exact UI layout/responsive treatment of Today and persistent nav;
- exact ranking weights for Universal Search;
- eager vs lazy entity registration per legacy domain;
- exact Daily Pulse worker/cron wiring;
- exact bounded Gmail backfill window for Communications Intelligence;
- exact Drive API crawl page/batch sizes and checkpoint schema;
- exact prioritisation rules for Drive content extraction;
- exact Drive organisation scoring/duplicate heuristics;
- exact Google restricted-scope verification/security path required for this private deployment;
- exact document extraction library/provider choices;
- exact first Agent action set in v0.20;
- which low-risk review proposals may auto-confirm after confidence thresholds are measured;
- exact sensitivity rules for external AI processing of highly sensitive Documents.

Those details must be resolved before implementation of the relevant phase and must not contradict the locked decisions above.
