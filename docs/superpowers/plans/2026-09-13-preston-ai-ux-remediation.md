# preston.ai UX Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the confirmed preston.ai UX defects, consolidate the duplicated page shells into one maintainable design system, and simplify the highest-friction workflows without touching production until UAT approval.

**Architecture:** Keep the existing server-rendered Node/Express architecture. Introduce a small shared presentation layer under `src/ui/` and migrate pages incrementally. Move long-running Gmail scans to a queued/status-based interaction and change Morning Digest output to structured insight objects rather than reverse-parsing prose.

**Tech Stack:** Node.js, Express, Supabase/Postgres, existing test suite, vanilla HTML/CSS/JS, Railway.

**Spec:** `docs/superpowers/plans/2026-09-13-ecosystem-ux-remediation.md`

## Global Constraints

- Work only from `uat/ux-remediation`.
- Deploy only to `preston-run-uat` until explicit production approval.
- Preserve all current route URLs unless this plan explicitly introduces a replacement route.
- Existing tests must remain green after every task.
- Add tests before implementation for every behavior change.

---

## File structure

Create:

```text
src/ui/tokens.js              shared design tokens
src/ui/shell.js               document shell/header/footer/meta
src/ui/components.js          buttons, cards, chips, empty states, flashes
src/ui/forms.js               labelled fields/selects/date controls
public/preston.css            shared stylesheet
public/gmail-status.js        scan-status polling/progressive enhancement
scripts/build-icons.js        deterministic icon raster generation
```

Modify incrementally:

```text
src/pages/home.js
src/pages/login.js
src/pages/people.js
src/pages/life-admin.js
src/pages/trips.js
src/pages/calendars.js
src/pages/calendar-view.js
src/pages/notifications.js
src/pages/gmail-settings.js
src/domain/morning-digest.js
src/routes/gmail.js
src/services/gmail-scan-runner.js
public/manifest.webmanifest
```

Tests:

```text
test/pages.test.js
test/people-pages.test.js
test/life-admin-pages.test.js
test/trips-pages.test.js
test/calendars-pages.test.js
test/calendar-view.test.js
test/notifications-pages.test.js
test/gmail-pages.test.js
test/gmail-routes.test.js
test/gmail-scan-runner.test.js
test/morning-digest.test.js
test/pwa.test.js
```

---

### Task 1: Add shared design tokens and shell

**Files:**
- Create: `src/ui/tokens.js`
- Create: `src/ui/shell.js`
- Create: `public/preston.css`
- Test: `test/pages.test.js`

**Interfaces:**
- Produces: `renderShell({title,body,activeNav,wide,headExtra,scripts})`
- Produces: one shared stylesheet served at `/preston.css`.

- [ ] **Step 1: Write failing shell tests**

Add assertions that rendered pages include:

```js
assert.match(html, /href="\/preston\.css"/)
assert.match(html, /class="site-header"/)
assert.match(html, /href="\/"[^>]*>.*preston\.ai/s)
assert.match(html, /class="site-footer"/)
```

- [ ] **Step 2: Run the focused test**

```bash
node --test test/pages.test.js
```

Expected: FAIL because the shared shell does not exist.

- [ ] **Step 3: Implement tokens and shell**

`tokens.js` must export semantic values for background, card, line, ink, muted, navy, blue, green, amber, red, radii, max widths, and breakpoints.

`renderShell()` must emit:

```html
<link rel="stylesheet" href="/preston.css">
<header class="site-header">...</header>
<main class="site-main ...">...</main>
<footer class="site-footer">preston.ai · v...</footer>
```

Include `manifest`, favicon, Apple touch icon, theme color, and `noindex,nofollow` once in the shell.

- [ ] **Step 4: Add visible focus states**

`public/preston.css` must contain:

```css
:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 2px;
}
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui public/preston.css test/pages.test.js
git commit -m "refactor: add shared preston.ai page shell"
```

---

### Task 2: Add reusable UI components and accessible fields

**Files:**
- Create: `src/ui/components.js`
- Create: `src/ui/forms.js`
- Test: `test/pages.test.js`

**Interfaces:**
- Produces: `buttonLink()`, `statusChip()`, `emptyState()`, `flashMessage()`, `card()`.
- Produces: `textField()`, `selectField()`, `dateField()`, `textareaField()` with associated labels.

- [ ] **Step 1: Write tests for associated labels**

Example assertion:

```js
assert.match(html, /<label for="title">Title<\/label>\s*<input[^>]*id="title"[^>]*name="title"/)
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
node --test test/pages.test.js
```

- [ ] **Step 3: Implement component helpers**

Every field helper must create a deterministic `id`, matching `label for`, and preserve current values/constraints.

- [ ] **Step 4: Run all tests**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/ui test/pages.test.js
git commit -m "refactor: add reusable preston.ai UI components"
```

---

### Task 3: Migrate People to the shared UI and fix birthday input

**Files:**
- Modify: `src/pages/people.js`
- Test: `test/people-pages.test.js`

**Interfaces:**
- Consumes: shared shell/components/forms from Tasks 1-2.

- [ ] **Step 1: Write tests for new behavior**

Assert:

```text
- button text is "Edit", not "Edit / deactivate"
- active people do not render an "Active" chip
- inactive people render an "Inactive" chip
- birthday month is a select
- birthday day is a numeric input with min=1 max=31
- birth year is numeric and optional
```

- [ ] **Step 2: Run test to verify failure**

```bash
node --test test/people-pages.test.js
```

- [ ] **Step 3: Migrate page**

Use the shared shell. Replace birthday month free text with month select. Keep current route and form field names so route handlers do not change.

- [ ] **Step 4: Run tests**

```bash
node --test test/people-pages.test.js
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/people.js test/people-pages.test.js
git commit -m "refactor: simplify People page and birthday entry"
```

---

### Task 4: Simplify Life Admin and make attention rows actionable

**Files:**
- Modify: `src/pages/life-admin.js`
- Test: `test/life-admin-pages.test.js`

**Interfaces:**
- Consumes: shared shell/components/forms.

- [ ] **Step 1: Write failing tests**

Cover:

```text
- Needs Attention rows link to the correct task/item URL.
- Primary filter set is Active, Needs attention, Upcoming, Completed.
- Category is represented by a secondary select/query control.
- Missing start/due values are omitted from detail rows rather than displaying "No date".
- Task cards carry a task-specific class/action affordance.
```

- [ ] **Step 2: Run tests**

```bash
node --test test/life-admin-pages.test.js
```

Expected: FAIL.

- [ ] **Step 3: Implement filter/query translation**

Preserve old filter query values where existing deep links depend on them, but render only the simplified primary filter set. Add category filtering as a secondary query parameter if route support does not already exist.

- [ ] **Step 4: Make attention rows clickable**

Use the same target logic already used by the home dashboard:

```js
const href = x.type === 'task'
  ? `/tasks/${encodeURIComponent(x.record.id)}/edit`
  : `/life-admin/${encodeURIComponent(x.record.id)}`
```

- [ ] **Step 5: Run tests**

```bash
node --test test/life-admin-pages.test.js
npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/life-admin.js test/life-admin-pages.test.js
git commit -m "refactor: simplify Life Admin workflows"
```

---

### Task 5: Reframe Trips around travel, not CRUD

**Files:**
- Modify: `src/pages/trips.js`
- Modify: `src/domain/trips.js` only if a helper is required
- Test: `test/trips-pages.test.js`
- Test: `test/trips-domain.test.js`

**Interfaces:**
- Produces: a `nextItineraryEntry()` helper if domain logic is needed.

- [ ] **Step 1: Write tests for trip hierarchy**

Assert trip detail renders in this order:

```text
1. trip heading/status/dates
2. Next section when a future itinerary item exists
3. Itinerary
4. Bookings
5. Linked Tasks
6. Manage itinerary / edit actions
```

Segments must no longer duplicate the primary itinerary list in normal reading mode.

- [ ] **Step 2: Write timezone-picker test**

Assert the form contains a `time_zone` control backed by a datalist/select of valid IANA zones rather than an unconstrained plain field alone.

- [ ] **Step 3: Run focused tests and confirm failure**

```bash
node --test test/trips-pages.test.js test/trips-domain.test.js
```

- [ ] **Step 4: Implement travel-first detail page**

Keep current edit/delete endpoints. Move destructive actions into a secondary Manage section/details element.

- [ ] **Step 5: Add timezone suggestions**

Provide common zones at minimum:

```text
Australia/Sydney
Australia/Adelaide
Australia/Darwin
Australia/Perth
Pacific/Auckland
America/Chicago
America/New_York
America/Los_Angeles
UTC
```

Allow valid IANA manual entry for uncommon zones.

- [ ] **Step 6: Run tests and commit**

```bash
npm test
git add src/pages/trips.js src/domain/trips.js test/trips-*.test.js
git commit -m "refactor: make Trips itinerary-first"
```

---

### Task 6: Add mobile Agenda view to Calendar and unify Calendar settings shell

**Files:**
- Modify: `src/pages/calendar-view.js`
- Modify: `src/pages/calendars.js`
- Test: `test/calendar-view.test.js`
- Test: `test/calendars-pages.test.js`

**Interfaces:**
- Calendar supports `view=agenda|month`; default `agenda` below mobile via progressive enhancement or server query default chosen intentionally.

- [ ] **Step 1: Write tests for Agenda markup and shared shell**

- [ ] **Step 2: Run focused tests and confirm failure**

```bash
node --test test/calendar-view.test.js test/calendars-pages.test.js
```

- [ ] **Step 3: Implement Agenda view**

Agenda output must omit empty dates and group events by date. Retain month view and previous/next navigation.

- [ ] **Step 4: Replace emoji-only location treatment**

Use text/icon CSS consistent with the shared design system; do not rely on the `📍` emoji as the only location affordance.

- [ ] **Step 5: Migrate calendar settings to shared shell**

Preserve connect/disconnect/sync endpoints.

- [ ] **Step 6: Run tests and commit**

```bash
npm test
git add src/pages/calendar-view.js src/pages/calendars.js test/calendar*.test.js
git commit -m "refactor: add agenda calendar and unify calendar UI"
```

---

### Task 7: Replace raw notification offsets with chip controls

**Files:**
- Modify: `src/pages/notifications.js`
- Modify: `public/notifications.js`
- Test: `test/notifications-pages.test.js`
- Test: `test/notifications-routes.test.js`

**Interfaces:**
- Server still receives comma-separated values for backward compatibility.
- Browser UI edits an array of offset chips and serializes it into hidden form inputs.

- [ ] **Step 1: Write page tests for chip editor containers and hidden inputs**

- [ ] **Step 2: Add client tests if the current project supports DOM tests; otherwise test serialization as a pure exported helper**

Example helper contract:

```js
serializeOffsets([30, 14, 7, 1]) === '30,14,7,1'
```

- [ ] **Step 3: Implement chip UI**

Prevent duplicates, non-integers, and negative values.

- [ ] **Step 4: Improve permission/device status copy**

Show `Enabled`, `Blocked by browser`, or `Not enabled` prominently.

- [ ] **Step 5: Run tests and commit**

```bash
npm test
git add src/pages/notifications.js public/notifications.js test/notifications-*.test.js
git commit -m "refactor: simplify notification settings"
```

---

### Task 8: Make Gmail scans asynchronous with status feedback

**Files:**
- Modify: `src/routes/gmail.js`
- Modify: `src/services/gmail-scan-runner.js`
- Modify: `src/pages/gmail-settings.js`
- Create: `public/gmail-status.js`
- Test: `test/gmail-routes.test.js`
- Test: `test/gmail-scan-runner.test.js`
- Test: `test/gmail-pages.test.js`

**Interfaces:**
- `POST /me/settings/gmail/scan-now` starts a scan and returns/redirects immediately.
- `GET /me/settings/gmail/scan-status` returns JSON `{status, startedAt, processedCount, relevantCount, ignoredCount, reviewItemsCreatedCount, errorSummary}`.
- Only one active manual scan per owner/account is allowed.

- [ ] **Step 1: Write route test proving POST does not await scan completion**

Stub the scan runner with a deferred promise and assert the HTTP handler completes before the promise resolves.

- [ ] **Step 2: Write duplicate-scan test**

Second start while status is `running` must not create another scan.

- [ ] **Step 3: Write status-endpoint tests**

Cover `idle`, `running`, `completed`, `failed`.

- [ ] **Step 4: Implement non-blocking scan dispatch**

Use an in-process guarded dispatch only if the current single-replica deployment guarantees it; otherwise persist a queued/running scan record and run through a dedicated worker/job. Do not acknowledge success until the scan record is created.

- [ ] **Step 5: Add progressive status UI**

`public/gmail-status.js` polls only while a scan is running and updates the Latest scan card. Disable the Scan button while running.

- [ ] **Step 6: Verify latency in UAT**

Expected:

```text
POST /me/settings/gmail/scan-now < 2 seconds
page immediately shows "Scanning…"
status eventually transitions to completed/failed
```

- [ ] **Step 7: Run tests and commit**

```bash
npm test
git add src/routes/gmail.js src/services/gmail-scan-runner.js src/pages/gmail-settings.js public/gmail-status.js test/gmail-*.test.js
git commit -m "fix: make Gmail scans asynchronous"
```

---

### Task 9: Make OAuth failures recoverable

**Files:**
- Modify: `src/routes/gmail.js`
- Modify: `src/pages/gmail-settings.js`
- Test: `test/gmail-routes.test.js`

**Interfaces:**
- Callback failures redirect to `/me/settings/gmail?error=<safe-code>`.

- [ ] **Step 1: Write callback failure tests**

Provider denial, invalid state, token exchange failure, and persistence failure must redirect to settings rather than returning raw 500 HTML.

- [ ] **Step 2: Implement safe error mapping**

Allowed user-facing codes:

```text
authorization_denied
session_expired
connection_failed
```

Log technical details server-side; never include tokens/provider payloads in the URL.

- [ ] **Step 3: Render recovery copy**

Example:

```text
Google connection failed. No Gmail access was added. Try connecting again.
```

- [ ] **Step 4: Run tests and commit**

```bash
npm test
git add src/routes/gmail.js src/pages/gmail-settings.js test/gmail-routes.test.js
git commit -m "fix: make Gmail OAuth failures recoverable"
```

---

### Task 10: Replace Morning Digest prose parsing with structured insights

**Files:**
- Modify: `src/domain/morning-digest.js`
- Modify: `src/pages/home.js`
- Test: `test/morning-digest.test.js`
- Test: `test/pages.test.js`

**Interfaces:**
- Digest exposes `insights: Array<{type,label,value,detail?,state?}>`.
- `bullets` may remain temporarily for backwards compatibility but the page must render `insights` first and contain no regex-based semantic parsing.

- [ ] **Step 1: Write domain tests for structured insights**

Example:

```js
assert.deepEqual(digest.insights.find(x => x.type === 'hrv_delta'), {
  type: 'hrv_delta',
  label: 'HRV',
  value: '−14% vs baseline',
  state: 'watch'
})
```

- [ ] **Step 2: Write page test proving arbitrary punctuation changes in narrative bullets do not alter cards**

- [ ] **Step 3: Move semantic formatting to domain output**

Delete `digestInsight()` regex parsing from `src/pages/home.js` after compatibility tests pass.

- [ ] **Step 4: Run tests and commit**

```bash
npm test
git add src/domain/morning-digest.js src/pages/home.js test/morning-digest.test.js test/pages.test.js
git commit -m "refactor: use structured morning digest insights"
```

---

### Task 11: Reorganize Home into Now / Coming Up / Apps & System

**Files:**
- Modify: `src/pages/home.js`
- Test: `test/pages.test.js`

**Interfaces:**
- Uses existing data; no persistence changes.

- [ ] **Step 1: Write ordering tests**

Assert page order:

```text
Morning Digest
Now
Coming Up
Apps & System
```

- [ ] **Step 2: Implement hierarchy**

`Now`: overdue/today/current calendar/training.

`Coming Up`: future calendar, trips, birthdays, Life Admin.

`Apps & System`: launcher, service status, admin/developer links.

- [ ] **Step 3: Preserve all existing destinations**

No launcher/admin link may be lost.

- [ ] **Step 4: Run tests and commit**

```bash
npm test
git add src/pages/home.js test/pages.test.js
git commit -m "refactor: clarify preston.ai dashboard hierarchy"
```

---

### Task 12: Generate correct icon sizes and clean duplicate assets

**Files:**
- Create: `scripts/build-icons.js`
- Modify: `public/icons/favicon-32.png`
- Modify: `public/icons/apple-touch-icon.png`
- Modify: `public/icons/icon-192.png`
- Modify: `public/icons/icon-512.png`
- Modify: `public/icons/icon-maskable-512.png`
- Modify: `public/manifest.webmanifest`
- Test: `test/pwa.test.js`

**Interfaces:**
- Source image remains the approved Preston app icon.

- [ ] **Step 1: Write tests for PNG dimensions and sensible file sizes**

Expected dimensions:

```text
favicon-32.png          32x32
apple-touch-icon.png   180x180
icon-192.png           192x192
icon-512.png           512x512
icon-maskable-512.png  512x512
```

Reject favicon payload above 100 KB.

- [ ] **Step 2: Implement deterministic icon build script**

Use an existing image dependency if present; otherwise add a minimal build-only image library and lock it.

- [ ] **Step 3: Generate icons and remove duplicate filename only after all references are updated**

- [ ] **Step 4: Run tests and commit**

```bash
npm test
git add scripts/build-icons.js public/icons public/manifest.webmanifest test/pwa.test.js
git commit -m "perf: generate correctly sized preston.ai icons"
```

---

### Task 13: Typography and final accessibility sweep

**Files:**
- Modify: `public/preston.css`
- Modify migrated pages only where semantics require it
- Test: all page tests

**Interfaces:**
- One deliberate font stack across preston.ai.

- [ ] **Step 1: Remove references to fonts that are not actually loaded**

Choose either the existing system stack or intentionally load a permitted web font. Do not leave `Instrument Serif`/`Inter` declarations that silently fall back.

- [ ] **Step 2: Add skip link and landmarks**

Shell must include a `Skip to content` link and one `<main id="main-content">`.

- [ ] **Step 3: Check keyboard navigation in UAT**

Tab through Login, Home, People edit, Life Admin, Trip edit, Notifications and Gmail without using a mouse.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add public/preston.css src/pages src/ui test
git commit -m "fix: complete preston.ai accessibility and typography sweep"
```

---

## UAT acceptance gate

Do not merge toward production until all are true:

- [ ] Gmail manual scan POST returns in under 2 seconds.
- [ ] Gmail scan status visibly updates through running → completed/failed.
- [ ] OAuth denial/failure returns to Gmail settings with recovery copy.
- [ ] People birthday editing works and saves unchanged field names.
- [ ] Life Admin Needs Attention rows open the correct records.
- [ ] Trips read like an itinerary; management controls remain available.
- [ ] Calendar works in Agenda and Month modes.
- [ ] Notification offsets can be added/removed without typing comma-separated strings.
- [ ] Morning Digest renders from structured insights.
- [ ] All pages share the same header/footer/button/form language.
- [ ] 1440px, 768px, and 390px screenshots show no clipping or horizontal scroll.
- [ ] Keyboard-only navigation is usable.
- [ ] `npm test` is green.

## Production promotion

After explicit approval:

```bash
git switch build/preston-ai-v0.11.0
git pull
git merge --no-ff uat/ux-remediation
git push origin build/preston-ai-v0.11.0
```

Then verify the production deployment and smoke-test `/`, `/people`, `/life-admin`, `/trips`, `/calendar`, `/notifications`, and `/me/settings/gmail`. If any critical smoke test fails, redeploy the previous known-good production commit.
