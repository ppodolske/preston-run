# Gmail Life Admin Routing Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop Gmail from turning generic bookings into junk trips, route actionable non-travel messages into Life Admin, and make ambiguous Gmail items visible for review.

**Architecture:** Introduce a deterministic Gmail intent router ahead of the existing trip extractor. Strong travel signals continue through the trip pipeline; actionable non-travel signals produce Life Admin candidates; ambiguous booking/reservation messages become visible review items in Life Admin; everything else is ignored. Keep the existing Gmail source-record idempotency model and record all automatic actions in Gmail activity history.

**Tech Stack:** Node.js 22, CommonJS, Supabase/Postgres, existing server-rendered preston.ai UI, GitHub Actions test suite.

**Spec:** User-approved remediation in the 2026-09-14 Gmail scan incident conversation.

## Global Constraints

- Preserve genuine manually created trips and Life Admin records.
- Do not automatically create a trip from generic `booking`, `reservation`, `confirmation`, or `ticket` language alone.
- Strong trip routing requires explicit travel-domain evidence such as airline/flight, accommodation, car hire, ferry, cruise, train, or itinerary context.
- Actionable non-travel email categories map to existing Life Admin categories only.
- Ambiguous items must surface visibly in Life Admin with `status=needs_action`; do not silently log-and-drop them.
- Gmail-created Life Admin items must carry source metadata sufficient to trace them to the Gmail source record/message.
- Existing processed Gmail sources remain idempotent; do not replay side effects during ordinary scans.
- Scan UI must distinguish Trips, Life Admin, Needs review, and Ignored rather than presenting one misleading Relevant total.
- No schema migration unless existing columns cannot represent the approved behavior.

---

### Task 1: Gmail intent routing

**Files:**
- Create: `src/domain/gmail-intent.js`
- Create: `test/gmail-intent.test.js`
- Modify: `test.js`

**Interfaces:**
- Produces: `classifyGmailIntent(envelope) -> {intent:'trip'|'life_admin'|'review'|'ignore', category?, confidence, reason}`

- [ ] Write failing tests proving physiotherapy confirmations are Life Admin appointments; restaurant reservations are Life Admin events; airline itineraries, Hertz rentals, accommodation, and ferries are trips; generic marketing is ignored; generic ambiguous reservations are review.
- [ ] Run the focused test and confirm RED.
- [ ] Implement the minimal deterministic classifier using explicit positive and exclusion signals.
- [ ] Run the focused test and confirm GREEN.
- [ ] Commit.

### Task 2: Life Admin Gmail candidates and persistence

**Files:**
- Create: `src/domain/gmail-life-admin-extractor.js`
- Create: `src/services/gmail-life-admin-actions.js`
- Modify: `src/data/life-admin.js`
- Create: `test/gmail-life-admin-extractor.test.js`
- Create: `test/gmail-life-admin-actions.test.js`
- Modify: `test.js`

**Interfaces:**
- Produces: `extractLifeAdminCandidate(envelope, classification) -> {title,category,status,due_at,starts_at,priority,notes}`
- Produces: `buildGmailLifeAdminActions({supabase,userId,lifeAdminData,gmailData})` with `createLifeAdminItem` and `createReviewItem`.

- [ ] Write RED tests for category/title/date extraction and Gmail source metadata.
- [ ] Extend Life Admin persistence with a Gmail-specific create function that stores `source_metadata` instead of pretending the record is manual.
- [ ] Implement actions that create normal actionable items as `upcoming`/`needs_action` and ambiguous review items as `needs_action` category `other`.
- [ ] Record Gmail activity entries for both created Life Admin items and review items.
- [ ] Run focused tests GREEN.
- [ ] Commit.

### Task 3: Scanner routing and counters

**Files:**
- Modify: `src/services/gmail-scan-runner.js`
- Modify: `src/services/gmail-manual-scan.js`
- Modify: `src/data/gmail-scans.js`
- Modify: `test/gmail-scan-runner.test.js`
- Modify: `test/gmail-manual-scan.test.js`

**Interfaces:**
- Scanner counters: `tripCount`, `lifeAdminCount`, `reviewItemsCreatedCount`, `ignoredCount`, while retaining compatibility fields required by existing DB/UI.

- [ ] Add RED tests proving each message takes exactly one intent path and generic bookings never hit `create_trip`.
- [ ] Wire the intent classifier before trip extraction.
- [ ] Route Life Admin candidates and review candidates through the new actions.
- [ ] Continue marking successfully handled source rows `processed`.
- [ ] Update progress/final counters without breaking existing scan lifecycle persistence.
- [ ] Run focused tests GREEN.
- [ ] Commit.

### Task 4: Gmail settings status UX

**Files:**
- Modify: `src/pages/gmail-settings.js` or current Gmail settings page module discovered in repo
- Modify: `public/gmail-status.js`
- Modify: `test/gmail-pages.test.js`
- Modify: `test/gmail-routes.test.js` as needed

**Interfaces:**
- Status display labels: `Trips`, `Life Admin`, `Needs review`, `Ignored`, `Unreadable PDFs`.

- [ ] Write RED rendering/status tests that reject the generic `Relevant` label.
- [ ] Render actionable counters with compatibility fallback for historical scans.
- [ ] Keep active-scan polling behavior unchanged.
- [ ] Run focused tests GREEN.
- [ ] Commit.

### Task 5: Full verification and production promotion

**Files:**
- No new product files unless verification exposes a defect.

- [ ] Run the full `npm test` suite and syntax checks used by CI.
- [ ] Open a PR from `fix/gmail-life-admin-routing` to `build/preston-ai-v0.11.0` and verify CI is green.
- [ ] Review the diff for secret exposure, unintended schema changes, and unrelated modifications.
- [ ] Merge only the tested head and deploy the exact merge commit to `preston-run-hub` under the user’s explicit production approval.
- [ ] Verify startup logs and the running artifact.
- [ ] Do not automatically launch another Gmail scan during deployment verification.
