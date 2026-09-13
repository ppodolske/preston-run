# preston.ai v0.10.0 Personal Calendars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read-only personal Google Calendar and Apple/iCloud Calendar connections, explicit calendar opt-in, a rolling normalized event cache, a 06:55 Australia/Sydney sync, and calendar context in the existing 07:05 Morning Summary.

**Architecture:** Add a dedicated calendar subsystem beside reminders. Google and Apple are isolated provider adapters behind one normalized event contract. Provider credentials are encrypted before database persistence. One shared sync service powers both manual and scheduled refreshes. The 07:05 reminder job reads only normalized Supabase calendar rows; it never calls external providers directly. Calendar events remain external-source data and never become reminder records or urgent noon/18:00 alerts.

**Tech Stack:** Node.js 22 CommonJS, built-in `fetch`/`crypto`, Supabase PostgreSQL/RLS, `@supabase/supabase-js` 2.109.0, `@supabase/ssr` 0.10.3, Google OAuth 2.0 + Calendar REST API, Apple iCloud CalDAV, `fast-xml-parser`, `ical.js`, Railway cron, existing hand-written Node assert test runner.

**Spec:** `docs/superpowers/specs/2026-09-13-preston-ai-v0.10.0-personal-calendars-design.md`

## Global Constraints

- Product name remains `preston.ai`; canonical URL remains `https://preston.run`.
- Target version is exactly `0.10.0`.
- Runtime remains Node `>=22`.
- Support exactly one Google Calendar connection and one Apple/iCloud Calendar connection per owner in this release.
- Calendar authorization is separate from Preston Google login authorization.
- Google access is read-only. The allowed OAuth scopes are exactly `https://www.googleapis.com/auth/calendar.calendarlist.readonly` and `https://www.googleapis.com/auth/calendar.events.readonly`; no Calendar write scope or Google profile scope is permitted.
- Apple access uses the Apple ID email plus an app-specific password over CalDAV; Preston never asks for the normal Apple Account password.
- Every discovered calendar defaults unselected. Only explicit owner opt-in makes a calendar eligible for sync/digest use.
- Work calendars are never inferred or automatically selected.
- Retained calendar cache window is 30 days back through 12 months forward.
- Stored event data is minimal: identifiers/provenance, title, timing/all-day semantics, location, status/response, recurrence identity, external link, and sync/version metadata. Do not store attendee lists or full descriptions/notes.
- Calendar events appear only in the 07:05 Morning Summary in v0.10.0. Do not add them to the home dashboard or noon/18:00 urgent paths.
- Digest timed-event inclusion is any event overlapping the interval from Sydney start-of-today through a start-time boundary of exactly 09:00:00 tomorrow: an event is eligible when it has not ended before today starts and its start is at or before the cutoff. This retains overnight/in-progress events and includes events starting exactly at 09:00. Tomorrow's all-day events are also included.
- Cancelled and reliably owner-declined events are excluded. Tentative events remain and are labelled tentative.
- Scheduled sync runs once at 06:55 Australia/Sydney using dual UTC cron slots plus an exact local-time gate. No continuous polling.
- Manual `Sync calendars` invokes the exact same sync orchestration used by the scheduled worker.
- Calendar provider failures are isolated. One provider failure does not prevent the other provider from syncing or the Morning Summary from running.
- Calendar source data older than 24 hours since its connection's last successful sync is stale and must not be presented as current; show `Calendar sync needs attention` when stale cached data would otherwise contribute to the digest.
- Provider credentials are encrypted before persistence with a separate server-only `CALENDAR_CREDENTIAL_KEY`. Database access alone must not reveal usable provider credentials.
- The production/UAT web service may receive calendar-specific OAuth/credential-encryption secrets required for connection flows, but must never receive `SUPABASE_SERVICE_ROLE_KEY` or `VAPID_PRIVATE_KEY`.
- The private calendar-sync worker may receive service-role access and calendar secrets required for background sync.
- All private calendar tables require RLS, owner-scoped policies, CRUD-only authenticated grants, no anon grants, and explicit application-level `user_id` filters.
- Private authenticated responses remain `Cache-Control: private, no-store`.
- Do not merge or deploy v0.10 to production until real-account UAT passes and the user explicitly approves release.

---

## Planned File Structure

New focused modules:

- `src/domain/calendars.js` — Sydney sync/digest windows, normalized-event validation/order, 06:55 schedule gate.
- `src/security/credential-crypto.js` — versioned AES-256-GCM credential envelope.
- `src/data/calendars.js` — owner-scoped connections, sources, events, sync-state persistence, cleanup.
- `src/calendar/providers/google.js` — Google OAuth/token refresh, calendar discovery, read-only event occurrence retrieval.
- `src/calendar/providers/apple-caldav.js` — iCloud CalDAV discovery and expanded occurrence retrieval.
- `src/services/calendar-sync.js` — provider-independent manual/scheduled sync orchestration.
- `src/services/calendar-digest.js` — query/filter/order/format normalized calendar rows for the morning digest.
- `src/jobs/calendar-sync.js` — Railway CLI job with 06:55 Sydney gate.
- `src/pages/calendars.js` — Settings → Calendars owner UI.
- `src/routes/calendars.js` — Google OAuth, Apple connection, selection, manual sync, disconnect routes.
- `supabase/migrations/20260913050000_v0100_calendars.sql` — calendar tables, constraints, indexes, RLS.
- `supabase/migrations/20260913050100_v0100_restrict_calendar_privileges.sql` — explicit privilege hardening.

Existing modules modified:

- `src/config.js` — calendar OAuth/encryption configuration required by authenticated web connection flows.
- `src/app.js` — calendar route wiring.
- `src/pages/home.js` — authenticated navigation link to Calendars only; no event display.
- `src/services/reminder-engine.js` — combine existing reminder items with normalized Calendar digest content in morning only.
- `src/branding.js`, `package.json`, `package-lock.json`, `test.js`, `.github/workflows/ci.yml` — dependencies, version, scripts, test coverage.

---

### Task 1: Calendar schema, RLS, and privilege hardening

**Files:**
- Create: `test/calendars-migration.test.js`
- Create: `supabase/migrations/20260913050000_v0100_calendars.sql`
- Create: `supabase/migrations/20260913050100_v0100_restrict_calendar_privileges.sql`
- Modify: `test.js`

**Required schema:**

`calendar_connections`
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `provider text not null check (provider in ('google','apple'))`
- `account_external_id text`
- `account_label text`
- `credential_ciphertext text not null`
- `status text not null default 'connected' check (status in ('connected','attention'))`
- `last_attempt_at timestamptz`
- `last_success_at timestamptz`
- `last_error text`
- timestamps
- `unique(user_id,provider)` and `unique(id,user_id)`

`calendar_sources`
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `connection_id uuid not null`
- `provider_calendar_id text not null`
- `display_name text not null`
- optional `color text`
- `selected boolean not null default false`
- `read_only boolean not null default true`
- timestamps
- `unique(user_id,connection_id,provider_calendar_id)` and `unique(id,user_id)`
- composite FK `(connection_id,user_id)` → `calendar_connections(id,user_id)` on delete cascade

`calendar_events`
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `connection_id uuid not null`
- `calendar_source_id uuid not null`
- `provider_event_id text not null`
- `occurrence_key text not null`
- optional `series_id text`
- `title text not null`
- `all_day boolean not null default false`
- timed representation: nullable `starts_at timestamptz`, `ends_at timestamptz`
- all-day representation: nullable `start_date date`, `end_date date` where `end_date` is provider-exclusive
- optional `time_zone`, `location`, `external_url`, `provider_updated_at`
- normalized `status` constrained to `confirmed|tentative|cancelled`
- normalized `owner_response` constrained to `accepted|tentative|declined|needs_action|unknown`
- `sync_seen_at timestamptz not null`
- timestamps
- `unique(user_id,calendar_source_id,occurrence_key)`
- composite FK `(connection_id,user_id)` → connections and `(calendar_source_id,user_id)` → sources
- checks requiring `start_date/end_date` and null timestamps for all-day rows, and `starts_at/ends_at` with null date fields for timed rows

- [ ] **Step 1: Write the failing migration contract test.** Assert all three tables, RLS enablement, owner policies, uniqueness, composite owner foreign keys, default-off source selection, event timing checks, and the separate hardening migration.
- [ ] **Step 2: Add `test/calendars-migration.test.js` to `test.js` and run `node test/calendars-migration.test.js`.** Expected: RED because migrations do not exist.
- [ ] **Step 3: Create the schema migration.** Add indexes for `(user_id,provider)`, `(user_id,connection_id,selected)`, timed event lookup by `(user_id,calendar_source_id,starts_at,ends_at)`, and all-day lookup by `(user_id,calendar_source_id,start_date,end_date)`. Use `(select auth.uid()) = user_id` SELECT/INSERT/UPDATE/DELETE policies on all three tables.
- [ ] **Step 4: Create privilege hardening.** Revoke all from `anon` and `authenticated`, then grant only SELECT/INSERT/UPDATE/DELETE to `authenticated` for the three calendar tables.
- [ ] **Step 5: Run `node test/calendars-migration.test.js && npm test`.** Expected: GREEN.
- [ ] **Step 6: Apply migrations to connected Supabase and verify live RLS, policies, grants, indexes, constraints, and absence of anon grants.** Preserve the existing unrelated leaked-password advisor note rather than claiming the advisor is fully clean.
- [ ] **Step 7: Commit:** `feat: add calendar data model`.

---

### Task 2: Credential encryption primitive

**Files:**
- Create: `src/security/credential-crypto.js`
- Create: `test/credential-crypto.test.js`
- Modify: `test.js`

**Interface:**
- `decodeCredentialKey(encoded)` accepts one base64url string that decodes to exactly 32 bytes.
- `encryptCredential(payload,key)` returns a versioned string envelope `v1.<iv>.<tag>.<ciphertext>`.
- `decryptCredential(envelope,key)` returns the original JSON-safe object.

- [ ] **Step 1: Write failing tests** for round-trip encryption, randomized ciphertext/IV, malformed key length, wrong key, corrupted tag/ciphertext, unknown envelope version, and proof that plaintext secrets do not appear in ciphertext.
- [ ] **Step 2: Run `node test/credential-crypto.test.js`.** Expected: RED with missing module.
- [ ] **Step 3: Implement with Node `crypto` AES-256-GCM**, 12-byte random IV, authenticated tag, base64url segments, strict envelope parsing, and generic decryption failures that never echo ciphertext or credential values.
- [ ] **Step 4: Run the focused test and full `npm test`.** Expected: GREEN.
- [ ] **Step 5: Commit:** `feat: encrypt calendar credentials`.

---

### Task 3: Calendar domain rules and Sydney-time windows

**Files:**
- Create: `src/domain/calendars.js`
- Create: `test/calendars-domain.test.js`
- Modify: `test.js`

**Interfaces:**
- `getCalendarSyncWindow(now)` → 30-day-back/12-month-forward bounded provider query window.
- `getMorningCalendarWindow(now)` → Sydney start-of-today, inclusive next-day 09:00 timed start cutoff, current/next local date keys for all-day overlap.
- `shouldRunCalendarSync(now)` → true only at 06:55 Australia/Sydney.
- `normalizeCalendarEvent(input)` → validated provider-independent occurrence shape.
- `isCalendarEventDigestEligible(event,window)`.
- `sortCalendarDigestEvents(events,window)`.
- `isConnectionStale(connection,now)` using strictly greater than 24 hours since `last_success_at`.

**Timed overlap rule:** a non-cancelled/non-declined event is in the digest when `ends_at > startOfToday` (or equivalent instantaneous boundary handling) and `starts_at <= tomorrow09`. This includes an event that began yesterday but remains in progress today and an event starting exactly at 09:00 tomorrow. An event starting after 09:00 tomorrow is excluded even if it otherwise overlaps later.

**All-day overlap rule:** include an all-day event for today when `start_date <= today < end_date`, and include it for tomorrow when `start_date <= tomorrow < end_date`. `end_date` remains provider-exclusive.

- [ ] **Step 1: Write RED domain tests** covering AEST/AEDT 06:55 gates and inactive cron twins; 30-day/12-month range; non-Sydney event timezones; events crossing midnight; already-in-progress-at-midnight events; exact 09:00 tomorrow inclusion; 09:00:01 exclusion; today/tomorrow/multi-day all-day semantics; cancelled/declined exclusion; tentative retention; stable ordering (today all-day → today timed → tomorrow all-day → tomorrow timed); and 24-hour stale boundary.
- [ ] **Step 2: Run `node test/calendars-domain.test.js`.** Expected: RED.
- [ ] **Step 3: Implement using `Intl.DateTimeFormat` and explicit date-only handling.** Never convert an all-day provider date into midnight UTC as its canonical representation.
- [ ] **Step 4: Run focused and full suite.** Expected: GREEN.
- [ ] **Step 5: Commit:** `feat: add calendar domain rules`.

---

### Task 4: Owner-scoped calendar data layer and cleanup semantics

**Files:**
- Create: `src/data/calendars.js`
- Create: `test/calendars-data.test.js`
- Modify: `test.js`

**Interfaces:**
- Connections: `getCalendarConnection`, `getCalendarConnectionWithCredential`, `listCalendarConnections`, `upsertCalendarConnection`, `updateCalendarSyncState`, `deleteCalendarConnection`.
- Sources: `listCalendarSources`, `replaceDiscoveredCalendarSources`, `setCalendarSourceSelected`, `listSelectedCalendarSources`.
- Events: `upsertCalendarEvents`, `listCalendarEventsForDigest`, `deleteEventsForSource`, `deleteUnseenEventsForSource`, `deleteEventsOutsideWindow`.
- Disconnect/deselection cleanup remains owner scoped.

- [ ] **Step 1: Write fake-Supabase RED tests** proving every read/update/delete includes explicit `.eq('user_id', userId)`, creates inject owner IDs server-side, connection uniqueness is used correctly, discovered sources default selected=false, source rediscovery preserves an existing selected flag, event upsert uniqueness uses occurrence identity, and cleanup cannot cross connection/source ownership.
- [ ] **Step 2: Test serialization boundaries.** `getCalendarConnection`/`listCalendarConnections` select metadata fields explicitly and never return `credential_ciphertext`; only `getCalendarConnectionWithCredential` may select it for an internal service call.
- [ ] **Step 3: Define unseen cleanup deterministically.** A source sync captures a single ISO `syncMarker`; every row upserted in that source gets `sync_seen_at=syncMarker`; after successful source retrieval, delete owner/source rows inside the active cache window with `sync_seen_at < syncMarker`. Do not run unseen deletion after a failed/incomplete provider page sequence.
- [ ] **Step 4: Run focused test and confirm RED.**
- [ ] **Step 5: Implement the minimal data functions**, following existing explicit owner-filter conventions from `src/data/reminders.js` and `src/data/trips.js`.
- [ ] **Step 6: Run focused and full suite.** Expected: GREEN.
- [ ] **Step 7: Commit:** `feat: add calendar persistence layer`.

---

### Task 5: Google Calendar read-only provider adapter

**Files:**
- Create: `src/calendar/providers/google.js`
- Create: `test/google-calendar-provider.test.js`
- Modify: `test.js`

**Provider contract:**
- `buildAuthorizationUrl({clientId,redirectUri,state})`
- `exchangeAuthorizationCode(...)`
- `refreshAccessToken(...)`
- `getAccountIdentity(...)`
- `listCalendars(...)`
- `listEventOccurrences({calendarId,start,end,...})`

**OAuth rules:**
- Scopes are exactly `calendar.calendarlist.readonly` and `calendar.events.readonly` full Google scope URLs from Global Constraints.
- Request `access_type=offline` and `prompt=consent` so a reconnect reliably yields refresh credentials.
- No login/session OAuth behavior is reused or broadened.
- Authorization callback URI is `${SITE_URL}/settings/calendars/google/callback`.
- Derive the connected account label/external identity from primary Calendar metadata (for example the primary calendar ID) so no Google profile/userinfo scope is needed.

- [ ] **Step 1: Write deterministic RED tests with injected `fetch`.** Verify authorization URL exact scopes/state/redirect/offline consent, token exchange and refresh form bodies, calendar-list pagination, event pagination, `singleEvents=true` occurrence expansion, bounded `timeMin/timeMax`, and normalization of timed/all-day/tentative/cancelled/owner-response fields.
- [ ] **Step 2: Add tests that error messages are sanitized** and tokens/Authorization headers are not included in thrown/loggable messages.
- [ ] **Step 3: Run focused test and confirm RED.**
- [ ] **Step 4: Implement direct REST calls with built-in `fetch`; do not add the large `googleapis` SDK.** Keep raw provider parsing inside this module.
- [ ] **Step 5: Run focused and full suite.** Expected: GREEN.
- [ ] **Step 6: Commit:** `feat: add Google Calendar provider`.

---

### Task 6: Apple/iCloud CalDAV provider adapter

**Files:**
- Create: `src/calendar/providers/apple-caldav.js`
- Create: `test/apple-calendar-provider.test.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `test.js`

**Dependencies:** add `fast-xml-parser` for DAV XML and `ical.js` for iCalendar parsing. Let `package-lock.json` pin the installed versions.

**Provider contract:**
- `validateAppleCredentials({email,appSpecificPassword})`
- `listCalendars(credentials)`
- `listEventOccurrences({calendarHref,start,end,credentials})`

**CalDAV behavior:**
- Start from `https://caldav.icloud.com/` and follow DAV current-user-principal/calendar-home-set discovery rather than hard-coding a per-user host/path.
- Use HTTP Basic auth only server-side.
- Request calendar-query `REPORT` with the bounded time range and `calendar-data` expansion for that same range so the provider remains authoritative for recurring occurrences/exceptions.
- Parse returned VEVENTs through `ical.js`, including `RECURRENCE-ID`, all-day values, STATUS, URL/location, and attendee participation only long enough to derive the owner's response; never return/persist attendee lists.
- If iCloud rejects or fails to provide bounded recurrence expansion for a recurring series, surface a sanitized provider capability/sync error for that source in v0.10 rather than silently inventing a local recurrence approximation.

- [ ] **Step 1: Write fixture-driven RED tests** for principal discovery, calendar-home discovery, multiple calendar listing, auth rejection, REPORT construction, multi-status XML, expanded recurring occurrences/exceptions, all-day dates, cancellation, tentative state, and declined owner participation.
- [ ] **Step 2: Assert credentials and Authorization headers never appear in errors.** Assert discovered/report URLs remain HTTPS and under trusted iCloud hosts before sending credentials.
- [ ] **Step 3: Install parsing dependencies and run the focused test.** It remains RED until adapter implementation exists.
- [ ] **Step 4: Implement the adapter with injected `fetch` and isolated XML/iCalendar parsers.** Resolve relative DAV hrefs against the trusted iCloud origin; reject credential-bearing redirects/discovery to untrusted hosts.
- [ ] **Step 5: Run focused and full suite.** Expected: GREEN.
- [ ] **Step 6: Commit:** `feat: add Apple Calendar provider`.

---

### Task 7: Shared calendar sync service

**Files:**
- Create: `src/services/calendar-sync.js`
- Create: `test/calendar-sync.test.js`
- Modify: `test.js`

**Interface:**
- `syncCalendars({supabase,userId,now,credentialKey,googleConfig,providers,deps})`
- `syncCalendarConnection(...)` internal/exported-for-test helper used by both manual and scheduled orchestration.

- [ ] **Step 1: Write RED orchestration tests** proving Google and Apple are processed independently; one failure does not block the other; only selected sources fetch events; discovered source metadata can refresh without auto-selecting new calendars; credentials are decrypted only inside the service; each successful source uses one `syncMarker`, upserts normalized rows and deletes unseen/out-of-window rows; deselected source rows are cleaned; and per-connection attempt/success/error states are updated.
- [ ] **Step 2: Add failure classification tests.** Credential/auth failures set connection `attention`; transient provider/network failures retain the connection but store a sanitized error. No raw token/password/provider response body is persisted as `last_error`.
- [ ] **Step 3: Run focused test and confirm RED.**
- [ ] **Step 4: Implement orchestration with dependency injection.** Provider adapter selection is by stored `provider`; no provider-specific parsing belongs in this service.
- [ ] **Step 5: Run focused and full suite.** Expected: GREEN.
- [ ] **Step 6: Commit:** `feat: add calendar sync engine`.

---

### Task 8: Settings → Calendars page and authenticated connection routes

**Files:**
- Create: `src/pages/calendars.js`
- Create: `src/routes/calendars.js`
- Create: `test/calendars-pages.test.js`
- Create: `test/calendars-routes.test.js`
- Modify: `src/app.js`
- Modify: `src/pages/home.js`
- Modify: `src/config.js`
- Modify: `test/config.test.js`
- Modify: `test/pages.test.js`
- Modify: `test/routes.test.js`
- Modify: `test/smoke.test.js`
- Modify: `test.js`

**Authenticated routes:**
- `GET /settings/calendars`
- `GET /settings/calendars/google/connect`
- `GET /settings/calendars/google/callback`
- `POST /settings/calendars/apple/connect`
- `POST /settings/calendars/sources/:id/toggle`
- `POST /settings/calendars/sync`
- `POST /settings/calendars/google/disconnect`
- `POST /settings/calendars/apple/disconnect`

**Configuration:**
- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `CALENDAR_CREDENTIAL_KEY`
- redirect URI is derived from `SITE_URL`; do not add a second independent redirect env var.

**Google OAuth state:**
- Generate at least 32 random bytes.
- Store a short-lived state value in an HttpOnly, Secure-in-production, SameSite=Lax cookie.
- Callback requires both a valid owner session and matching state, then clears the state cookie.
- Exchange code, encrypt the provider credential payload before persistence, discover calendars default-off, redirect to Settings.

**Apple connect:**
- POST-only, same-origin protected form.
- Accept Apple ID email + app-specific password once; validate server-side; encrypt credential payload before persistence; discover calendars default-off.
- Never repopulate or echo the password in rendered HTML.

- [ ] **Step 1: Write page RED tests** for provider cards, connected/disconnected states, account labels, last sync/error status, explicit default-off toggles, manual sync, disconnect controls, and Apple app-specific-password guidance. Assert credential ciphertext/password/tokens never render.
- [ ] **Step 2: Write route RED tests** for owner auth, same-origin POST enforcement, Google state mismatch/missing state, exact separate Calendar OAuth scopes, encrypted credential persistence, Apple validation, source ownership on toggles, manual sync invoking the shared service once, and provider disconnect deleting local connection/source/event data only.
- [ ] **Step 3: Extend anonymous privacy regressions.** Login HTML must not expose Calendar settings, provider account labels, calendar names, OAuth client details, Apple identifiers, or `/settings/calendars` navigation.
- [ ] **Step 4: Update `src/config.js` and tests.** Calendar secrets may exist only in server config; assert service-role and VAPID private key remain absent. Never embed Google client secret or credential key into HTML. Tests must fail fast when calendar connection routes are enabled without their required server config.
- [ ] **Step 5: Implement page/routes and wire `handleCalendarsRoute` before `handleSiteRoute`.** Add an authenticated `Calendars`/Settings link on home but no calendar events.
- [ ] **Step 6: Run focused route/page/config/privacy tests and full suite.** Expected: GREEN.
- [ ] **Step 7: Commit:** `feat: add calendar settings and connections`.

---

### Task 9: 06:55 Sydney calendar-sync background job

**Files:**
- Create: `src/jobs/calendar-sync.js`
- Create: `test/calendar-sync-job.test.js`
- Modify: `package.json`
- Modify: `test.js`

**Script:** `job:calendars:sync` → `node src/jobs/calendar-sync.js`

**Background env:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OWNER_GOOGLE_EMAIL`
- `CALENDAR_CREDENTIAL_KEY`
- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`

- [ ] **Step 1: Write RED job tests** for exact 06:55 AEST/AEDT execution and inactive twin exits before creating a privileged Supabase client or loading provider credentials.
- [ ] **Step 2: Assert background config requires only needed calendar variables** and never requires VAPID private credentials.
- [ ] **Step 3: Implement job using existing `createBackgroundSupabaseClient` / `resolveOwnerUserId` and `syncCalendars`.** CLI logs only sanitized provider/result counts, never account secrets.
- [ ] **Step 4: Run `node test/calendar-sync-job.test.js && npm test`.** Expected: GREEN.
- [ ] **Step 5: Commit:** `feat: add scheduled calendar sync job`.

---

### Task 10: Calendar digest reader and Morning Summary integration

**Files:**
- Create: `src/services/calendar-digest.js`
- Create: `test/calendar-digest.test.js`
- Modify: `src/services/reminder-engine.js`
- Modify: `test/reminder-engine.test.js`
- Modify: `test.js`

**Calendar digest contract:**
- Read selected-source normalized events plus connection freshness from Supabase using explicit owner filters.
- Do not call Google or Apple.
- Return `{events, attentionNeeded}` in approved display order.
- Fresh connection: include eligible events.
- Stale connection: exclude stale cached events from current content; set `attentionNeeded` only when stale selected-source cached rows overlap the approved digest window and otherwise would have been shown.

**Morning behavior:**
- Existing Life Admin/birthday/task/trip items continue unchanged.
- Add a distinct `Calendar` portion to the push body.
- Send the daily summary when either existing reminder items, eligible calendar events, or a calendar-sync attention message exists.
- Continue using the single logical `daily-summary:<Sydney date>` reminder occurrence for delivery dedupe. Calendar events themselves must never create reminder rows.
- Noon/evening urgent code remains functionally unchanged and must not load calendar data.

- [ ] **Step 1: Write RED digest tests** for today overlap through exact tomorrow 09:00, overnight/in-progress events, tomorrow all-day, cancelled/declined exclusion, tentative labeling, ordering, multiple selected calendars/providers, stale-source exclusion/attention, and empty state.
- [ ] **Step 2: Extend reminder-engine tests** to prove calendar-only mornings send one logical summary, mixed reminder+calendar content sends one summary, stale warning can send, empty everything sends nothing, and noon/evening invoke no calendar dependency.
- [ ] **Step 3: Implement `calendar-digest.js` and minimally compose it into `runMorningSummary`.** Keep provider logic out of the reminder engine.
- [ ] **Step 4: Run focused tests and full suite.** Expected: GREEN.
- [ ] **Step 5: Commit:** `feat: add calendars to morning summary`.

---

### Task 11: v0.10 release metadata, CI, and static security regression

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/branding.js`
- Modify: `test.js`
- Modify: `test/smoke.test.js`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Update version assertions first and run smoke test RED.** Require package, lockfile, and visible `VERSION` to equal `0.10.0`.
- [ ] **Step 2: Bump package/lockfile/branding to exactly `0.10.0`.** Keep manifest product name unchanged.
- [ ] **Step 3: Ensure every new v0.10 test is in `test.js` and update final suite message to v0.10.0.**
- [ ] **Step 4: Add `build/preston-ai-v0.10.0` to CI branch triggers.** Add syntax checks for `src/jobs/calendar-sync.js` as well as existing server/reminder job checks.
- [ ] **Step 5: Strengthen smoke/privacy assertions** to require new focused calendar modules and prohibit calendar credentials/tokens/passwords from anonymous HTML/static assets.
- [ ] **Step 6: Run `npm ci --no-audit --no-fund`, `npm test`, `node --check server.js`, `node --check src/jobs/reminders.js`, and `node --check src/jobs/calendar-sync.js`.** Expected: all GREEN.
- [ ] **Step 7: Commit:** `release: prepare preston.ai v0.10.0`.

---

### Task 12: UAT infrastructure, real-account verification, and release gate

**Railway/Supabase scope:** UAT first. Production remains on released v0.9 until explicit v0.10 approval.

- [ ] **Step 1: Verify exact branch-head CI is GREEN before infrastructure UAT.** Do not rely on an earlier commit's run.
- [ ] **Step 2: Configure UAT web calendar secrets.** Add `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, and `CALENDAR_CREDENTIAL_KEY` to `preston-run-uat`; keep `SUPABASE_SERVICE_ROLE_KEY` and VAPID private key absent from the web service.
- [ ] **Step 3: Configure Google OAuth UAT redirect** for the exact UAT callback URL and confirm it is distinct from existing Preston login/Supabase callback configuration.
- [ ] **Step 4: Create one private Railway calendar-sync UAT worker** sourced from `build/preston-ai-v0.10.0`, start command `npm run job:calendars:sync`, restart NEVER, no public domain, cron `55 19,20 * * *`. Use references for Supabase URL, owner email, calendar OAuth config/key, and shared service-role secret. Do not give the worker VAPID private credentials.
- [ ] **Step 5: Verify Railway source binding and exact commit SHA** for UAT web and calendar worker after deploy. Confirm no staged changes are accidentally left pending.
- [ ] **Step 6: Perform Google real-account UAT.** Connect the one personal Google account; verify separate read-only consent; discover calendars all OFF; select approved calendars only; manual sync; inspect normalized rows; verify excluded calendars contribute no digest events.
- [ ] **Step 7: Perform Apple real-account UAT.** Create/use an Apple app-specific password; connect; discover calendars all OFF; select approved calendars only; manual sync; inspect normalized rows; verify excluded calendars contribute no digest events. Never paste or log the app-specific password into chat/repo/log output.
- [ ] **Step 8: Exercise calendar content edge cases in UAT** where practical: timed event, overnight event, all-day event, tentative event, cancelled/declined exclusion, next-day event at/before 09:00, next-day all-day event.
- [ ] **Step 9: Verify provider isolation and stale-state behavior** with a controlled non-destructive failure, then restore/reconnect without exposing secret values.
- [ ] **Step 10: Confirm a scheduled 06:55 Sydney worker execution** and the following 07:05 UAT Morning Summary use freshly normalized data. If a controlled one-shot invocation is used for faster diagnosis, it does not replace verification of the real cron configuration and local-time gate before release.
- [ ] **Step 11: Disconnect/reconnect Google and Apple once each** and confirm local credential/source/event cleanup with no mutation of source calendars.
- [ ] **Step 12: Final security verification.** Live Supabase RLS/policies/grants/FKs; web-service variable names; worker-only service role; no plaintext credentials in DB responses/logs; anonymous page remains minimal; no calendar event on home/noon/evening paths.
- [ ] **Step 13: Final exact-head CI and UAT service health verification.** Record branch SHA, CI run, UAT web deployment, calendar worker deployment, and the known non-blocking leaked-password advisor warning if it remains.
- [ ] **Step 14: Stop and request explicit user release approval.** Do not merge `build/preston-ai-v0.10.0` to `main`, change production Google OAuth callbacks, or create production calendar worker wiring until the user approves v0.10 release.
- [ ] **Step 15: After explicit approval only:** create release PR to `main`, require PR CI GREEN, squash merge exact approved head, verify post-merge CI, add the calendar configuration to production web, create/rebind the production calendar-sync worker to `main`, verify `preston-run-hub` health/version and all production reminder/calendar workers, and confirm web services still lack service-role/VAPID-private credentials.

---

## Plan Self-Review Checklist

- Every approved v0.10 product decision is represented: one account per provider, explicit opt-in, 30-day/12-month cache, minimal event storage, 06:55 sync, morning-only use, today→09:00 tomorrow plus next-day all-day, cancelled/declined exclusion, tentative inclusion, 24-hour stale rule.
- Google Calendar authorization is separate from Preston login and requests only the two exact read-only Calendar scopes.
- Apple app-specific password handling is server-side, encrypted at rest, and never echoed.
- Provider adapters remain isolated from sync and digest formatting.
- Recurrence expansion remains provider-authoritative: Google uses `singleEvents`; Apple requests bounded CalDAV expansion and fails safely rather than creating a Preston recurrence engine.
- All-day dates use date semantics rather than midnight-UTC coercion.
- Timed events use interval-overlap semantics so overnight/in-progress events are not silently dropped.
- Every private data operation is owner scoped in both RLS and application filters.
- Browser/web services never receive Supabase service-role or VAPID private credentials.
- Calendar credentials are never present in unauthenticated HTML/static output/logs.
- Morning Summary reads normalized Supabase data only; no provider calls at 07:05.
- Calendar data never enters the noon/18:00 urgent path and never creates per-event reminder records.
- Production remains v0.9 until UAT and explicit release approval.
