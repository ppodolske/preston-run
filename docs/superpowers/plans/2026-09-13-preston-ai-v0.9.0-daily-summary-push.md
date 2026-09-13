# preston.ai v0.9.0 Daily Summary + Web Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add owner-only reminder rules, one 7:05 AM Sydney daily summary push, noon/6 PM urgent-only checks, multi-device Web Push enrollment, snooze/acknowledgement, and delivery history without calendar or Gmail integration.

**Architecture:** Keep reminder policy, occurrence generation, push transport, and UI as focused modules. The authenticated web service continues to use the existing request-scoped Supabase client; background Railway cron services use a server-only Supabase service-role credential so they can evaluate owner data without a browser session. The web service must never receive or expose that service-role secret. Three low-frequency cron services run at the two possible UTC hours for Sydney daylight/standard time and the application gates execution by Australia/Sydney local time, so DST is correct without continuous polling.

**Tech Stack:** Node.js 22 CommonJS, Supabase PostgreSQL/RLS, `@supabase/supabase-js` 2.109.0, `@supabase/ssr` 0.10.3, `web-push`, Railway, Web Push API, Service Worker API, existing hand-written Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-13-preston-ai-v0.9.0-daily-summary-push-design.md`

## Global Constraints

- Product name remains `preston.ai`; canonical URL remains `https://preston.run`.
- Target version is exactly `0.9.0`.
- Runtime remains Node `>=22`.
- Routine push is one daily summary at `07:05` in `Australia/Sydney`.
- Urgent-only evaluations occur at `12:00` and `18:00` in `Australia/Sydney` and normally send nothing.
- Default quiet hours remain `22:00` to `07:00` local time.
- No continuous reminder polling.
- No Google Calendar, Apple Calendar, work calendar, Gmail, SMS, or email notification integration in v0.9.0.
- PWA Web Push is the only outbound notification channel.
- Push permission is requested only after an explicit authenticated user action.
- All private tables require RLS, owner-scoped policies, authenticated CRUD-only grants, and no anon grants.
- Server data access uses explicit `user_id` filters in addition to RLS.
- The production web service must not receive a Supabase service-role key. Service-role access is permitted only in dedicated private cron runtimes.
- Private authenticated HTML remains `Cache-Control: private, no-store`.
- Tests must pass before any merge/deploy completion claim.

---

## File Structure

New focused modules:

- `src/domain/reminders.js` — defaults, override precedence, Sydney date/time helpers, eligibility, occurrence keys, urgent qualification.
- `src/data/reminders.js` — owner-scoped CRUD for reminder settings, overrides, occurrences, subscriptions, and delivery rows.
- `src/push/web-push.js` — push transport adapter and permanent/transient error classification.
- `src/services/reminder-engine.js` — morning/urgent evaluation orchestration and summary construction.
- `src/jobs/reminders.js` — CLI entry point used by Railway cron services; local-time gate only, no business logic.
- `src/pages/notifications.js` — authenticated notification settings/history/device UI.
- `src/routes/notifications.js` — authenticated settings, subscription, acknowledgement, snooze, and history routes.
- `public/sw.js` — service worker push and notification-click behavior.
- `public/notifications.js` — authenticated-page client helper that requests permission only after button click and submits PushSubscription data.
- `supabase/migrations/20260913xxxxxx_v090_reminders_push.sql` — tables, constraints, indexes, RLS.
- `supabase/migrations/20260913xxxxxx_v090_restrict_reminder_privileges.sql` — explicit grant hardening.

Existing modules modified:

- `src/config.js` — VAPID public configuration and optional cron-only service-role configuration parsing.
- `src/app.js` — wire notification routes.
- `src/pages/home.js` / `src/routes/site.js` — display reminder/notification entry point without exposing anything when signed out.
- `src/pages/life-admin.js`, `src/routes/life-admin.js`, `src/pages/people.js`, `src/routes/people.js`, `src/pages/trips.js`, `src/routes/trips.js` — add reminder inheritance/custom controls to supported entities.
- `src/branding.js`, `package.json`, `package-lock.json`, `test.js`, `.github/workflows/ci.yml` — release metadata/dependency/test coverage.

---

### Task 1: Database schema, RLS, and privilege hardening

**Files:**
- Create: `supabase/migrations/20260913xxxxxx_v090_reminders_push.sql`
- Create: `supabase/migrations/20260913xxxxxx_v090_restrict_reminder_privileges.sql`
- Create: `test/reminders-migration.test.js`
- Modify: `test.js`

**Interfaces:**
- Produces tables: `reminder_settings`, `reminder_overrides`, `reminders`, `push_subscriptions`, `notification_deliveries`.
- Produces owner-safe composite keys referenced by later data-layer code.

- [ ] **Step 1: Write the failing migration contract test**

Create `test/reminders-migration.test.js` using the same file-content assertions as `test/life-admin-migration.test.js` and `test/trips-migration.test.js`. Assert both v0.9 migration files exist and that the schema migration contains all five table names, RLS enablement, owner policies, occurrence uniqueness, and ownership-safe foreign keys. Assert the hardening migration revokes all privileges from `anon` and `authenticated` before granting only `select, insert, update, delete` to `authenticated`.

Required assertions must include these semantic fragments:

```js
for (const table of ['reminder_settings','reminder_overrides','reminders','push_subscriptions','notification_deliveries']) {
  assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
}
assert.match(schema, /unique\s*\(user_id,\s*occurrence_key\)/i);
assert.match(schema, /references public\.reminders\s*\(id,\s*user_id\)/i);
assert.match(schema, /references public\.push_subscriptions\s*\(id,\s*user_id\)/i);
assert.match(grants, /revoke all .* from anon/i);
assert.match(grants, /grant select, insert, update, delete .* to authenticated/i);
```

- [ ] **Step 2: Wire the new migration test into `test.js` and run it**

Run:

```bash
node test/reminders-migration.test.js
```

Expected: FAIL because the v0.9 migrations do not exist.

- [ ] **Step 3: Add the schema migration**

Create five owner-scoped tables with these minimum columns and constraints:

```sql
create table public.reminder_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  timezone text not null default 'Australia/Sydney',
  morning_summary_time time not null default '07:05',
  quiet_hours_start time not null default '22:00',
  quiet_hours_end time not null default '07:00',
  birthday_offsets jsonb not null default '[30,14,7,1]'::jsonb,
  renewal_offsets jsonb not null default '[60,30,14,7,1]'::jsonb,
  deadline_offsets jsonb not null default '[14,7,3,0]'::jsonb,
  appointment_offsets jsonb not null default '[7,1,0]'::jsonb,
  trip_offsets jsonb not null default '[14,7,1]'::jsonb,
  noon_urgent_check boolean not null default true,
  evening_urgent_check boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`reminder_overrides` must include `user_id`, `entity_type`, `entity_id`, `offsets jsonb`, `enabled boolean default true`, timestamps, and `unique(user_id, entity_type, entity_id)`.

`reminders` must include `user_id`, `entity_type`, `entity_id`, `reminder_class`, `occurrence_key`, `target_date date`, `effective_trigger_at timestamptz`, status constrained to `pending, sent, acknowledged, snoozed, cancelled`, `acknowledged_at`, `snoozed_until`, `first_sent_at`, `last_sent_at`, `deep_link`, timestamps, plus `unique(user_id, occurrence_key)` and `unique(id,user_id)`.

`push_subscriptions` must include `user_id`, unique endpoint per owner, `p256dh`, `auth_secret`, `device_label`, `active`, `last_used_at`, `failure_code`, `failure_at`, timestamps, plus `unique(id,user_id)`.

`notification_deliveries` must include `user_id`, `reminder_id`, `push_subscription_id`, `attempted_at`, `delivered_at`, status constrained to `pending, delivered, transient_failure, permanent_failure`, `error_category`, `retry_count`, timestamps, composite owner foreign keys to reminders/subscriptions, and a unique constraint preventing two successful delivery records for the same reminder/device attempt identity.

Enable RLS on all five tables. Create SELECT/INSERT/UPDATE/DELETE policies scoped with `(select auth.uid()) = user_id`.

- [ ] **Step 4: Add the privilege-hardening migration**

For all five tables:

```sql
revoke all on table public.<table> from anon;
revoke all on table public.<table> from authenticated;
grant select, insert, update, delete on table public.<table> to authenticated;
```

Do not grant TRUNCATE, REFERENCES, or TRIGGER.

- [ ] **Step 5: Run migration contract tests**

Run:

```bash
node test/reminders-migration.test.js
npm test
```

Expected: PASS.

- [ ] **Step 6: Apply migrations to connected Supabase and verify live security**

After applying both migrations, query `pg_tables`, `pg_policies`, `information_schema.role_table_grants`, and `pg_constraint`. Verify all five tables have RLS, owner CRUD policies exist, `anon` has no grants, authenticated has only CRUD, and composite ownership foreign keys exist.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations test/reminders-migration.test.js test.js
git commit -m "feat: add reminder and push data model"
```

---

### Task 2: Reminder domain rules and Sydney-time evaluation

**Files:**
- Create: `src/domain/reminders.js`
- Create: `test/reminders-domain.test.js`
- Modify: `test.js`

**Interfaces:**
- Produces `DEFAULT_REMINDER_OFFSETS`.
- Produces `validateReminderSettings(input)`.
- Produces `validateReminderOverride(input)`.
- Produces `resolveOffsets(reminderClass, settings, override)`.
- Produces `buildOccurrenceKey({entityType, entityId, reminderClass, offsetDays, targetDate})`.
- Produces `shouldIncludeOnDate({targetDate, today, offsetDays})`.
- Produces `isUrgentEntity(entity)`.
- Produces `getSydneyLocalParts(now)` and `shouldRunScheduledMode(mode, now)`.

- [ ] **Step 1: Write failing domain tests**

Cover exact defaults:

```js
assert.deepEqual(DEFAULT_REMINDER_OFFSETS.birthday, [30,14,7,1]);
assert.deepEqual(DEFAULT_REMINDER_OFFSETS.renewal, [60,30,14,7,1]);
assert.deepEqual(DEFAULT_REMINDER_OFFSETS.deadline, [14,7,3,0]);
assert.deepEqual(DEFAULT_REMINDER_OFFSETS.appointment, [7,1,0]);
assert.deepEqual(DEFAULT_REMINDER_OFFSETS.trip, [14,7,1]);
```

Also cover inherited-vs-custom precedence, stable occurrence keys, due-day inclusion, invalid negative/duplicate offsets, Sydney DST conversion around both daylight-saving transitions, and schedule gates for `morning=07:05`, `noon=12:00`, `evening=18:00`.

Urgent qualification must explicitly prove a normal-priority overdue task returns false and an explicitly urgent actionable item returns true.

- [ ] **Step 2: Run tests and confirm RED**

```bash
node test/reminders-domain.test.js
```

Expected: FAIL with missing `src/domain/reminders`.

- [ ] **Step 3: Implement pure reminder-domain functions**

Use `Intl.DateTimeFormat` with `timeZone: 'Australia/Sydney'`; do not add a date library. Validate offsets as unique integers `>= 0`, sorted descending for display but treated set-wise for matching. `resolveOffsets` returns override offsets only when an enabled override exists; otherwise it maps the reminder class to the settings/default schedule.

`shouldRunScheduledMode` must return true only when the Sydney local hour/minute exactly matches the approved mode time. This is the DST safety gate used by cron jobs.

- [ ] **Step 4: Run domain tests and full suite**

```bash
node test/reminders-domain.test.js
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/reminders.js test/reminders-domain.test.js test.js
git commit -m "feat: add reminder evaluation rules"
```

---

### Task 3: Owner-scoped reminder data layer and recalculation semantics

**Files:**
- Create: `src/data/reminders.js`
- Create: `test/reminders-data.test.js`
- Modify: `test.js`

**Interfaces:**
- Consumes domain validation from `src/domain/reminders.js`.
- Produces `getReminderSettings(supabase,userId)`.
- Produces `upsertReminderSettings(supabase,userId,input)`.
- Produces `getReminderOverride(supabase,userId,entityType,entityId)`.
- Produces `upsertReminderOverride(...)` and `deleteReminderOverride(...)`.
- Produces `upsertReminderOccurrence(...)`, `listDueReminderOccurrences(...)`.
- Produces `acknowledgeReminder(...)`, `snoozeReminder(...)`.
- Produces `listPushSubscriptions(...)`, `upsertPushSubscription(...)`, `setPushSubscriptionActive(...)`.
- Produces `recordNotificationDelivery(...)`, `listNotificationHistory(...)`.
- Produces `cancelFutureInheritedOccurrences(...)` used before recalculation when a global default changes.

- [ ] **Step 1: Write owner-filter contract tests**

Use the existing fake Supabase query-builder style from `test/life-admin-data.test.js` and `test/trips-data.test.js`. Every read/update/delete assertion must prove an explicit `.eq('user_id', userId)` is issued. Create operations must inject `user_id` server-side and ignore any client-supplied owner ID.

Add tests proving `cancelFutureInheritedOccurrences` touches only `pending` future reminders and does not alter `sent`, `acknowledged`, or `snoozed` rows.

- [ ] **Step 2: Run and confirm RED**

```bash
node test/reminders-data.test.js
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement data functions**

Follow existing data-module patterns: explicit column lists, explicit owner filters, throw on Supabase errors, and return `null` for owner-scoped not-found lookups where existing modules do so.

Do not store full push payload text in `notification_deliveries`; store references/status metadata only.

- [ ] **Step 4: Run data tests and full suite**

```bash
node test/reminders-data.test.js
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/reminders.js test/reminders-data.test.js test.js
git commit -m "feat: add reminder persistence layer"
```

---

### Task 4: Web Push transport, service worker, and explicit device enrollment

**Files:**
- Create: `src/push/web-push.js`
- Create: `public/sw.js`
- Create: `public/notifications.js`
- Create: `test/push.test.js`
- Modify: `src/config.js`
- Modify: `src/http/static.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `test/pwa.test.js`
- Modify: `test.js`

**Interfaces:**
- Produces `createPushTransport({publicKey,privateKey,subject})` returning `send(subscription,payload)`.
- Produces `classifyPushError(error)` returning `permanent` for 404/410 subscription failures and `transient` otherwise.
- Browser script exposes no automatic permission request; it binds only to an explicit enable button.

- [ ] **Step 1: Add failing push tests**

Assert config requires `VAPID_PUBLIC_KEY` on web pages that expose enrollment but never serializes `VAPID_PRIVATE_KEY`. Assert permanent classification for HTTP 404/410 and transient classification for 429/5xx/network errors.

Update PWA tests to require `/sw.js` and `/notifications.js` in the static allowlist and to assert the service worker handles `push` and `notificationclick`.

- [ ] **Step 2: Run tests and confirm RED**

```bash
node test/push.test.js
node test/pwa.test.js
```

- [ ] **Step 3: Add `web-push` dependency and transport adapter**

Install a pinned current `web-push` version compatible with Node 22. Configure VAPID once per transport instance:

```js
webpush.setVapidDetails(subject, publicKey, privateKey);
```

`send()` accepts the stored endpoint/p256dh/auth values and JSON payload; it must not log subscription keys.

- [ ] **Step 4: Add service worker behavior**

`public/sw.js` parses push JSON with fields `{title, body, url, tag}` and calls `self.registration.showNotification`. `notificationclick` closes the notification and focuses an existing same-origin client when possible; otherwise it opens `url`.

- [ ] **Step 5: Add explicit enrollment client script**

`public/notifications.js` must request `Notification.requestPermission()` only inside the click handler for `[data-enable-notifications]`. It registers `/sw.js`, calls `pushManager.subscribe({userVisibleOnly:true, applicationServerKey:<VAPID public key>})`, then POSTs the subscription JSON to an authenticated route. Do not execute permission prompts at module load.

- [ ] **Step 6: Run targeted/full tests**

```bash
node test/push.test.js
node test/pwa.test.js
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/config.js src/push public/sw.js public/notifications.js src/http/static.js test/push.test.js test/pwa.test.js test.js
git commit -m "feat: add web push transport and service worker"
```

---

### Task 5: Notification settings, devices, history, acknowledgement, and snooze UI

**Files:**
- Create: `src/pages/notifications.js`
- Create: `src/routes/notifications.js`
- Create: `test/notifications-pages.test.js`
- Create: `test/notifications-routes.test.js`
- Modify: `src/app.js`
- Modify: `src/pages/home.js`
- Modify: `test/pages.test.js`
- Modify: `test.js`

**Interfaces:**
- Consumes reminder data-layer functions and existing auth/same-origin helpers.
- Produces authenticated routes under `/notifications`.

- [ ] **Step 1: Write failing page tests**

Require the authenticated settings page to show:
- `Enable notifications on this device`
- editable global offsets for birthday/renewal/deadline/appointment/trip
- `07:05`, `12:00`, `18:00`, `Australia/Sydney`
- quiet hours `22:00`–`07:00`
- device labels and enabled state
- delivery history without endpoint key material

Update signed-out page assertions so `Notifications`, device labels, reminder counts, and subscription data never appear.

- [ ] **Step 2: Write failing route tests**

Cover:
- owner auth required for all notification routes
- same-origin enforcement on every POST
- subscription create/update uses authenticated `user.id`
- disabling one device does not change others
- acknowledge updates one logical reminder
- snooze supports tomorrow, 3 days, 1 week, custom date
- global setting changes call the future-inherited recalculation path
- invalid offsets/custom dates return 400 without mutation

- [ ] **Step 3: Run and confirm RED**

```bash
node test/notifications-pages.test.js
node test/notifications-routes.test.js
```

- [ ] **Step 4: Implement pages/routes and wire `src/app.js`**

Use private/no-store responses and existing form/same-origin conventions. Add a simple authenticated home link to `/notifications`; do not add notification data to anonymous HTML.

POST endpoints:

```text
POST /notifications/settings
POST /notifications/subscriptions
POST /notifications/subscriptions/:id/toggle
POST /notifications/reminders/:id/acknowledge
POST /notifications/reminders/:id/snooze
```

GET `/notifications` renders settings/devices/history.

- [ ] **Step 5: Run targeted/full tests**

```bash
node test/notifications-pages.test.js
node test/notifications-routes.test.js
npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/notifications.js src/routes/notifications.js src/app.js src/pages/home.js test/notifications-pages.test.js test/notifications-routes.test.js test/pages.test.js test.js
git commit -m "feat: add notification settings and device management"
```

---

### Task 6: Per-item reminder inheritance and custom overrides

**Files:**
- Modify: `src/pages/people.js`
- Modify: `src/routes/people.js`
- Modify: `src/pages/life-admin.js`
- Modify: `src/routes/life-admin.js`
- Modify: `src/pages/trips.js`
- Modify: `src/routes/trips.js`
- Modify: `test/people-pages.test.js`
- Modify: `test/people-routes.test.js`
- Modify: `test/life-admin-pages.test.js`
- Modify: `test/life-admin-routes.test.js`
- Modify: `test/trips-pages.test.js`
- Modify: `test/trips-routes.test.js`

**Interfaces:**
- Consumes `getReminderOverride`, `upsertReminderOverride`, `deleteReminderOverride`, and global settings.
- Supports birthdays, Life Admin reminder-capable items, and trips.

- [ ] **Step 1: Add failing form/render tests**

For each supported record type, assert edit/detail UI shows:
- current mode `Use global defaults` or `Custom reminders`
- inherited offsets when no override exists
- custom offset inputs when selected
- `Restore defaults` action when an override exists

- [ ] **Step 2: Add failing mutation tests**

Prove custom offsets are validated and saved owner-scoped; restoring defaults deletes only the matching owner/entity override. A malicious linked entity ID from another owner must not be accepted.

- [ ] **Step 3: Run and confirm RED**

Run the six affected page/route test files.

- [ ] **Step 4: Implement reminder sections using existing form patterns**

Do not duplicate reminder logic into each route. Add small shared helpers in `src/domain/reminders.js` for parsing offset form values if needed, then call the data-layer override functions from each route.

- [ ] **Step 5: Run affected/full suite**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/people.js src/routes/people.js src/pages/life-admin.js src/routes/life-admin.js src/pages/trips.js src/routes/trips.js src/domain/reminders.js test
git commit -m "feat: add per-item reminder overrides"
```

---

### Task 7: Morning summary and urgent-only reminder engine

**Files:**
- Create: `src/services/reminder-engine.js`
- Create: `test/reminder-engine.test.js`
- Modify: `test.js`

**Interfaces:**
- Consumes existing people/life-admin/tasks/trips data modules plus reminder settings/overrides.
- Consumes `createPushTransport` through dependency injection.
- Produces `runMorningSummary({supabase,userId,now,pushTransport})`.
- Produces `runUrgentCheck({supabase,userId,now,pushTransport,mode})`.

- [ ] **Step 1: Write failing morning-summary tests**

Use fake data providers and push transport. Cover birthdays, renewals, deadlines, appointments/events stored in Preston, tasks, and trips. Assert all eligible routine content is combined into **one logical morning summary**, not one push per item.

Assert no push is sent when nothing qualifies.

Assert a record appears only on configured offset dates and that per-item custom offsets override global defaults.

- [ ] **Step 2: Write failing urgent-check tests**

Assert noon/18:00 checks:
- send nothing for normal-priority overdue tasks
- send for explicitly urgent actionable items
- deduplicate an already-successfully-delivered urgent occurrence
- do not resend acknowledged occurrences

- [ ] **Step 3: Write failing multi-device delivery tests**

For two enabled subscriptions, assert one logical reminder produces two delivery attempts. Acknowledge/snooze changes the logical reminder row, not separate device state.

Assert 410 on one device deactivates only that subscription while the other delivery succeeds. Assert transient failure records `transient_failure` and keeps the subscription active.

- [ ] **Step 4: Run and confirm RED**

```bash
node test/reminder-engine.test.js
```

- [ ] **Step 5: Implement engine orchestration**

Construct concise push payloads. Morning payload should use a stable tag such as `preston-daily-YYYY-MM-DD` and deep-link `/`. Urgent payloads deep-link to the most relevant authenticated detail page.

Do not include secret subscription data in logs or payloads.

- [ ] **Step 6: Run targeted/full suite**

```bash
node test/reminder-engine.test.js
npm test
```

- [ ] **Step 7: Commit**

```bash
git add src/services/reminder-engine.js test/reminder-engine.test.js test.js
git commit -m "feat: add daily summary reminder engine"
```

---

### Task 8: DST-safe Railway cron entry point and server-only background credentials

**Files:**
- Create: `src/jobs/reminders.js`
- Create: `src/auth/background-supabase.js`
- Create: `test/reminder-job.test.js`
- Modify: `src/config.js`
- Modify: `package.json`
- Modify: `test.js`

**Interfaces:**
- Produces CLI usage: `node src/jobs/reminders.js morning|noon|evening`.
- `background-supabase.js` consumes `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` only in cron runtime.
- Web service config must start without `SUPABASE_SERVICE_ROLE_KEY` and never require it.

- [ ] **Step 1: Write failing job tests**

Inject `now` and engine functions. Assert a `morning` invocation exits without calling the engine when Sydney local time is not 07:05, and calls exactly once at 07:05 across both AEST and AEDT fixtures. Repeat for noon and evening.

Assert missing service-role configuration fails closed in the cron job with a clear startup error, while ordinary web config tests remain green without that variable.

- [ ] **Step 2: Run and confirm RED**

```bash
node test/reminder-job.test.js
```

- [ ] **Step 3: Implement background Supabase client**

Use `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}})` only in `src/auth/background-supabase.js`. Never import this module from `src/app.js` or browser-facing routes.

- [ ] **Step 4: Implement CLI mode gate**

The job must:
1. validate mode
2. evaluate `shouldRunScheduledMode(mode, now)`
3. exit `0` silently if this UTC cron firing is the inactive DST twin
4. create background Supabase client only for a real local-time firing
5. resolve the owner user/profile
6. invoke morning or urgent engine exactly once
7. exit nonzero on execution failure without printing secrets

- [ ] **Step 5: Add npm scripts**

```json
{
  "job:reminders:morning": "node src/jobs/reminders.js morning",
  "job:reminders:noon": "node src/jobs/reminders.js noon",
  "job:reminders:evening": "node src/jobs/reminders.js evening"
}
```

- [ ] **Step 6: Run targeted/full tests**

```bash
node test/reminder-job.test.js
npm test
```

- [ ] **Step 7: Commit**

```bash
git add src/jobs/reminders.js src/auth/background-supabase.js src/config.js package.json package-lock.json test/reminder-job.test.js test.js
git commit -m "feat: add scheduled reminder jobs"
```

---

### Task 9: Release metadata, CI, and security regression coverage

**Files:**
- Modify: `src/branding.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `test.js`
- Modify: `test/pages.test.js`
- Modify: `test/smoke.test.js`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces exact release marker `0.9.0` everywhere.

- [ ] **Step 1: Add failing version/privacy assertions**

Require package version, lockfile root version, branding version, smoke output, and test-runner completion string to be `0.9.0`.

Signed-out HTML must continue to exclude `Notifications`, `Reminder`, `device`, `/notifications`, subscription endpoints, VAPID private material, and all personal data labels.

- [ ] **Step 2: Run and confirm RED**

```bash
npm test
```

- [ ] **Step 3: Update release metadata and CI branch trigger**

Set `package.json` and lockfile root to `0.9.0`, keep Node `>=22`, set `src/branding.js` version to `0.9.0`, update `test.js` completion text, and ensure CI includes `build/preston-ai-v0.9.0` plus `main`.

- [ ] **Step 4: Run complete local verification**

```bash
npm ci --no-audit --no-fund
npm test
node --check server.js
node --check src/jobs/reminders.js
```

Expected: all commands PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/branding.js test.js test/pages.test.js test/smoke.test.js .github/workflows/ci.yml
git commit -m "chore: prepare preston.ai v0.9.0"
```

---

### Task 10: Railway cron services, UAT, and final release verification

**Files:**
- No required application file changes unless UAT identifies a defect.

**Interfaces:**
- Consumes the three npm job scripts from Task 8.
- Produces three Railway cron services scoped to the production/UAT environment as appropriate.

- [ ] **Step 1: Generate VAPID key pair and configure secrets**

Configure the web service with only `VAPID_PUBLIC_KEY` if the server needs it for authenticated enrollment rendering. Keep `VAPID_PRIVATE_KEY` and `SUPABASE_SERVICE_ROLE_KEY` off the public web service unless transport execution is deliberately server-side there; preferred configuration is cron-only private services for both secrets. Configure `VAPID_SUBJECT` to an owner-controlled `mailto:` address.

- [ ] **Step 2: Create three Railway cron services from the same GitHub repo/branch for UAT**

Use these commands:

```text
npm run job:reminders:morning
npm run job:reminders:noon
npm run job:reminders:evening
```

Use UTC cron expressions that cover both Sydney offsets, with the application local-time gate discarding the inactive twin:

```text
Morning: 5 20,21 * * *
Noon:    0 1,2 * * *
Evening: 0 7,8 * * *
```

This yields at most six lightweight cron starts per day, not continuous polling; exactly three pass the Sydney local-time gate.

- [ ] **Step 3: Configure cron-only secrets**

Each cron service receives:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OWNER_GOOGLE_EMAIL`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

Do not expose service-role/private VAPID keys through web responses, logs, static JS, or the production web-service variable set.

- [ ] **Step 4: Verify CI on exact branch head**

Require green GitHub Actions for the exact v0.9 branch SHA before UAT approval.

- [ ] **Step 5: Perform UAT**

Verify manually in the installed/browser PWA:
1. sign in as owner
2. open Notifications
3. click `Enable notifications on this device`
4. browser permission appears only then
5. label device
6. edit global reminder defaults
7. set a per-item override and restore defaults
8. trigger a controlled morning-job execution in UAT and receive one summary push
9. acknowledge/snooze and verify shared state
10. disable the device and verify no further push delivery
11. confirm signed-out homepage remains minimal

- [ ] **Step 6: Re-run Supabase live security verification**

Verify RLS, policies, grants, foreign keys, and security advisor findings. Record any advisor warning accurately rather than claiming a clean result when warnings remain.

- [ ] **Step 7: Final exact-head verification**

Require:

```text
npm ci --no-audit --no-fund  -> success
npm test                     -> success
node --check server.js       -> success
node --check src/jobs/reminders.js -> success
GitHub CI exact head         -> success
```

Do not merge to `main` or deploy production until the user explicitly approves the verified v0.9 UAT release.

---

## Plan Self-Review

### Spec coverage

- 07:05 routine summary: Tasks 2, 7, 8, 10.
- 12:00/18:00 urgent-only checks: Tasks 2, 7, 8, 10.
- Global defaults and per-item overrides: Tasks 2, 3, 5, 6.
- Recalculation semantics: Task 3 and notification settings route tests in Task 5.
- Quiet hours/timezone: Tasks 2 and 5.
- Explicit push permission/device management: Tasks 4 and 5.
- Multi-device fan-out/shared acknowledge-snooze state: Tasks 3, 5, 7.
- Delivery history/failure handling: Tasks 3, 4, 5, 7.
- Deduplication: Tasks 1, 2, 7.
- Security/RLS/no anonymous leakage: Tasks 1, 5, 9, 10.
- No calendars/Gmail/continuous polling: Global constraints and Task 10 scheduling.
- v0.9.0 metadata/testing: Task 9.

### Placeholder scan

No TBD/TODO implementation placeholders remain. Migration timestamps use the execution-time `20260913xxxxxx` naming slot because Supabase migration tooling assigns the exact unique second when created; both files must receive concrete timestamps before Task 1 is committed.

### Type/interface consistency

The plan consistently uses one logical `reminders` row across devices, owner-scoped data functions, three scheduler modes (`morning`, `noon`, `evening`), and one push transport adapter injected into the reminder engine.
