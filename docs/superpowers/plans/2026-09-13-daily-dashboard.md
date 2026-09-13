# preston.ai v0.11.0 Daily Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved v0.11.0 authenticated daily dashboard, read-only full calendar view, and icon-based app launcher treatment without changing reminder-engine behavior or provider OAuth scopes.

**Architecture:** Extend the existing server-rendered Node/CommonJS application. Add focused calendar dashboard/month-view domain helpers over the existing Supabase cache, keep `/settings/calendars` for connection management, add authenticated `/calendar` for the read-only month view, and keep weather/app health checks client-side. Reuse existing source/event metadata rather than making provider calls during page requests.

**Tech Stack:** Node.js 22+, CommonJS, Supabase, server-rendered HTML/CSS/vanilla JS, existing Node `assert` test harness, existing calendar sync/cache model.

**Spec:** `docs/superpowers/specs/2026-09-13-daily-dashboard-design.md`

## Global Constraints

- Feature version is exactly `v0.11.0`.
- Development branch is `build/preston-ai-v0.11.0`.
- No production merge/deploy without explicit release approval after UAT.
- Dashboard and `/calendar` must read only from normalized Supabase calendar cache during page requests.
- Do not broaden Google Calendar OAuth scopes.
- Do not create calendar events as preston.ai reminder rows.
- Noon/evening urgent reminder behavior remains unchanged.
- `ppodolske@gmail.com` and `Home` are flattened only on the dashboard Personal group.
- Dashboard calendar horizon is today + timed events through 09:00 tomorrow + all-day events tomorrow, using `Australia/Sydney`.
- `/calendar` is authenticated, read-only, month-based, and distinct from `/settings/calendars`.
- App launcher icons use maintained icon metadata; no runtime favicon scraping.
- Personal calendar, Life Admin, task, birthday, and trip data remain server-rendered/private.

---

## File structure

### New files

- `src/pages/calendar-view.js` — render authenticated read-only month calendar page.
- `test/calendar-dashboard.test.js` — dashboard calendar horizon/grouping behavior.
- `test/calendar-view.test.js` — month range/navigation/event projection behavior.
- `test/calendar-view-routes.test.js` — authenticated `/calendar` route behavior.

### Existing files to modify

- `src/domain/calendars.js` — add dashboard-window/grouping and month-view helpers.
- `src/data/calendars.js` — add a focused event/source read function for dashboard/full calendar consumption.
- `src/routes/site.js` — load dashboard calendar state and explicit Overdue/Today sets with independent failure isolation.
- `src/routes/calendars.js` — serve authenticated `GET /calendar` while preserving settings routes.
- `src/pages/home.js` — three-column dashboard, calendar card navigation, compact cards, icon launchers.
- `src/domain/life-admin.js` — expose deterministic Overdue/Today split and Coming Up dedupe if not already available through existing helpers.
- `src/branding.js` — bump version and add app icon metadata.
- `package.json` — bump package version to `0.11.0`.
- `test/pages.test.js` — update dashboard renderer contract.
- `test/calendars-routes.test.js` — protect existing settings behavior while adding `/calendar` expectations as appropriate.
- `test/life-admin-domain.test.js` — add split/deduplication coverage.
- `test/pwa.test.js` or static-asset tests — verify configured launcher assets are served/fallback behavior is safe.
- `test.js` — register new tests and update suite version output.

---

### Task 1: Calendar dashboard domain model

**Files:**
- Modify: `src/domain/calendars.js`
- Modify: `src/data/calendars.js`
- Create: `test/calendar-dashboard.test.js`
- Modify: `test/calendars-data.test.js`

**Interfaces:**
- Consumes: existing `calendar_events` rows and `calendar_sources` rows.
- Produces: `getDashboardCalendarWindow(now)`, `buildDashboardCalendar({events,sources,now})`, and `listCalendarDashboardData(supabase,userId)`.

- [ ] **Step 1: Write failing dashboard-window tests**

Add `test/calendar-dashboard.test.js` with fixed Sydney-time cases asserting:

```js
const assert=require('node:assert/strict');
const {getDashboardCalendarWindow,isDashboardCalendarEventEligible}=require('../src/domain/calendars');

const now=new Date('2026-09-12T22:00:00Z'); // 08:00 Sep 13 Sydney
const window=getDashboardCalendarWindow(now);
assert.equal(window.today,'2026-09-13');
assert.equal(window.tomorrow,'2026-09-14');

const base={status:'confirmed',owner_response:'accepted',all_day:false};
assert.equal(isDashboardCalendarEventEligible({...base,starts_at:'2026-09-13T10:00:00Z',ends_at:'2026-09-13T11:00:00Z'},window),true);
assert.equal(isDashboardCalendarEventEligible({...base,starts_at:'2026-09-13T22:59:00Z',ends_at:'2026-09-13T23:30:00Z'},window),true); // 08:59 tomorrow
assert.equal(isDashboardCalendarEventEligible({...base,starts_at:'2026-09-13T23:00:00Z',ends_at:'2026-09-13T23:30:00Z'},window),true); // 09:00 tomorrow
assert.equal(isDashboardCalendarEventEligible({...base,starts_at:'2026-09-13T23:01:00Z',ends_at:'2026-09-14T00:00:00Z'},window),false);
assert.equal(isDashboardCalendarEventEligible({status:'confirmed',owner_response:'unknown',all_day:true,start_date:'2026-09-14',end_date:'2026-09-15'},window),true);
assert.equal(isDashboardCalendarEventEligible({...base,starts_at:'2026-09-12T23:00:00Z',ends_at:'2026-09-13T01:00:00Z'},window),true);
```

- [ ] **Step 2: Run the new test and verify failure**

Run:

```bash
node test/calendar-dashboard.test.js
```

Expected: FAIL because the new dashboard helper exports do not exist.

- [ ] **Step 3: Implement dashboard window/eligibility helpers**

In `src/domain/calendars.js`, reuse `currentSydneyDate`, `shiftDateKey`, `localDateTimeToInstant`, and overlap semantics. Add:

```js
function getDashboardCalendarWindow(now=new Date()){
  const today=currentSydneyDate(now);
  const tomorrow=shiftDateKey(today,{days:1});
  return {
    today,
    tomorrow,
    startOfToday:localDateTimeToInstant(today).toISOString(),
    startOfTomorrow:localDateTimeToInstant(tomorrow).toISOString(),
    timedCutoff:localDateTimeToInstant(tomorrow,9,0,0).toISOString()
  };
}

function isDashboardCalendarEventEligible(event,window){
  if(!event||!window||event.status==='cancelled'||event.owner_response==='declined')return false;
  if(event.all_day)return allDayOverlapsDate(event,window.today)||allDayOverlapsDate(event,window.tomorrow);
  const start=new Date(event.starts_at).getTime();
  const end=new Date(event.ends_at).getTime();
  const visibleStart=new Date(window.startOfToday).getTime();
  const cutoff=new Date(window.timedCutoff).getTime();
  return Number.isFinite(start)&&Number.isFinite(end)&&end>visibleStart&&start<=cutoff;
}
```

Do not alter `getMorningCalendarWindow` or reminder-engine digest behavior in this task.

- [ ] **Step 4: Add failing grouping tests**

Extend `test/calendar-dashboard.test.js` with sources named `ppodolske@gmail.com`, `Home`, two holiday calendars, and `Reminders`. Assert `buildDashboardCalendar()` returns exactly `{personal,holidays,reminders}` in that semantic grouping, Personal merges its two sources, and cancelled/declined reminder rows are excluded.

Use source IDs in fixtures but assert the resulting dashboard event view model does not contain `provider_calendar_id` and does not expose the Personal source name.

- [ ] **Step 5: Implement `buildDashboardCalendar`**

Implement source lookup by `calendar_source_id`, select only chosen sources, classify by normalized `display_name`, filter with `isDashboardCalendarEventEligible`, and sort each group chronologically. The returned dashboard event view model should contain only display-safe fields needed by the renderer, such as:

```js
{
  id,
  title,
  allDay,
  startsAt,
  endsAt,
  startDate,
  endDate,
  location,
  externalUrl,
  day: 'today'|'tomorrow'
}
```

For Reminders, treat cancelled/declined rows as dismissed and rely on the existing sync deletion of unseen provider rows for reminders that disappear after completion. Do not add a schema migration unless a provider-level failing test demonstrates a completed reminder remains in the cache with a distinct state that current normalization loses.

- [ ] **Step 6: Add a single dashboard data read**

In `src/data/calendars.js`, add:

```js
async function listCalendarDashboardData(supabase,userId){
  requireUserId(userId);
  const [events,sources]=await Promise.all([
    supabase.from('calendar_events').select(EVENT_COLUMNS).eq('user_id',userId),
    supabase.from('calendar_sources').select(SOURCE_COLUMNS).eq('user_id',userId).eq('selected',true)
  ]);
  return {events:throwIf(events)||[],sources:throwIf(sources)||[]};
}
```

Export it and add data-layer tests asserting user scoping and selected-source scoping.

- [ ] **Step 7: Run focused tests**

Run:

```bash
node test/calendar-dashboard.test.js
node test/calendars-data.test.js
node test/calendars-domain.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/domain/calendars.js src/data/calendars.js test/calendar-dashboard.test.js test/calendars-data.test.js
git commit -m "feat: add dashboard calendar model"
```

---

### Task 2: Full calendar month model

**Files:**
- Modify: `src/domain/calendars.js`
- Modify: `src/data/calendars.js`
- Create: `test/calendar-view.test.js`

**Interfaces:**
- Consumes: normalized events/sources from Task 1.
- Produces: `getCalendarMonthWindow(monthKey)`, `buildCalendarMonth({events,sources,monthKey})`, `listCalendarViewData(supabase,userId)`.

- [ ] **Step 1: Write failing month-window tests**

Create tests for `2026-09` asserting Sydney boundaries, previous/next keys, Today/current-month key, and month overlap behavior for timed, all-day, and multi-day events.

```js
const window=getCalendarMonthWindow('2026-09');
assert.equal(window.monthKey,'2026-09');
assert.equal(window.firstDate,'2026-09-01');
assert.equal(window.lastDate,'2026-09-30');
assert.equal(window.previousMonth,'2026-08');
assert.equal(window.nextMonth,'2026-10');
```

- [ ] **Step 2: Verify failure**

Run `node test/calendar-view.test.js` and expect missing helper failures.

- [ ] **Step 3: Implement month parsing/window helpers**

Reject malformed month keys and normalize missing input to the current Sydney month. Return first/last date keys plus Sydney instants covering the visible month.

- [ ] **Step 4: Write failing month projection tests**

Fixtures must assert:

- a timed event in the month appears;
- an all-day event in the month appears;
- an event spanning month start appears;
- a multi-day event spanning month end appears;
- cancelled/declined items are absent;
- source `display_name` and `color` are available in the full-view item;
- `provider_calendar_id` is absent from the display model;
- `external_url` is preserved only as the event link.

- [ ] **Step 5: Implement `buildCalendarMonth`**

Return a month model with day buckets keyed by `YYYY-MM-DD`. Multi-day/all-day items should be assigned to every day they overlap inside the visible month; timed events should be assigned to their Sydney-local start date while preserving start/end instants for display.

- [ ] **Step 6: Add focused full-view data reader**

`listCalendarViewData` may reuse the same two-table read pattern as Task 1, but it must return selected sources only and all cached events for the authenticated user. Keep provider credentials and identifiers out of the returned display model.

- [ ] **Step 7: Run focused tests**

```bash
node test/calendar-view.test.js
node test/calendars-data.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/domain/calendars.js src/data/calendars.js test/calendar-view.test.js test/calendars-data.test.js
git commit -m "feat: add calendar month view model"
```

---

### Task 3: Split Needs Attention into Overdue and Today

**Files:**
- Modify: `src/domain/life-admin.js`
- Modify: `test/life-admin-domain.test.js`

**Interfaces:**
- Produces: `getAttentionBuckets({lifeItems,tasks,now})` returning `{overdue,today}` and a dedupe-ready ID/key set or helper usable by Coming Up.

- [ ] **Step 1: Write failing split tests**

Add fixtures for one overdue task, one due-today task, one upcoming Life Admin item, and one overdue Life Admin item. Assert no record appears in both buckets and ordering is priority, due time, then deterministic tie-breaker.

- [ ] **Step 2: Verify failure**

Run `node test/life-admin-domain.test.js` and expect missing helper failure.

- [ ] **Step 3: Implement minimal split helper**

Reuse existing due-date/priority semantics from the file. Do not duplicate date interpretation in `src/pages/home.js`.

- [ ] **Step 4: Add Coming Up dedupe test**

Assert an item already surfaced in Overdue or Today is filtered from the 90-day Coming Up Life Admin list.

- [ ] **Step 5: Implement dedupe helper or accepted-key parameter**

Keep the interface domain-level; renderer receives already-separated lists.

- [ ] **Step 6: Run focused tests and commit**

```bash
node test/life-admin-domain.test.js
git add src/domain/life-admin.js test/life-admin-domain.test.js
git commit -m "feat: split overdue and today attention"
```

---

### Task 4: Assemble dashboard data in the authenticated home route

**Files:**
- Modify: `src/routes/site.js`
- Modify: `test/routes.test.js`
- Modify: `test/pages.test.js`

**Interfaces:**
- Consumes: `listCalendarDashboardData`, `buildDashboardCalendar`, `getAttentionBuckets`, existing birthday/trip/life loaders.
- Produces: richer `renderHomePage` arguments: `calendar`, `calendarDataUnavailable`, `overdueItems`, `todayItems`, deduped `upcomingLifeItems`.

- [ ] **Step 1: Write a failing route test for independent calendar loading**

Inject/stub the calendar read so authenticated `GET /` renders Personal/Holidays/Reminders data when available.

- [ ] **Step 2: Write a failing route test for calendar failure isolation**

Make calendar loading throw while birthdays, Life Admin, and trips succeed. Assert status 200 and the page contains the calendar unavailable state plus the successful sections.

- [ ] **Step 3: Implement calendar loading in `handleSiteRoute`**

Add its own `try/catch`, independent of Life Admin/birthday/trip catches. Pass only display models to `renderHomePage`.

- [ ] **Step 4: Replace one `needsAttention` list with domain buckets**

Call `getAttentionBuckets` after loading life items/tasks and pass `overdueItems` and `todayItems` separately. Filter `upcomingLifeItems` against attention items before render.

- [ ] **Step 5: Run route/page tests**

```bash
node test/routes.test.js
node test/pages.test.js
```

Expected: PASS after renderer compatibility is minimally updated or temporary test fixture support is added.

- [ ] **Step 6: Commit**

```bash
git add src/routes/site.js test/routes.test.js test/pages.test.js
git commit -m "feat: assemble daily dashboard data"
```

---

### Task 5: Rebuild the home page as the three-column dashboard

**Files:**
- Modify: `src/pages/home.js`
- Modify: `src/branding.js`
- Modify: `test/pages.test.js`
- Modify: `test/pwa.test.js` if static icon-serving assertions belong there.

**Interfaces:**
- Consumes: dashboard view model from Task 4 and `APPS` icon metadata.
- Produces: approved responsive dashboard markup and app launchers.

- [ ] **Step 1: Add icon metadata to the app registry**

Change each `APPS` entry to include a maintained icon URL/path, for example:

```js
{key:'dose',name:'Dose & Scale',url:'https://dose.preston.run',icon:'https://dose.preston.run/icons/apple-touch-icon.png'}
```

Use the actual stable icon/favicon path verified for each deployed app. If an app does not expose a suitable icon path, add a local preston.ai fallback mapping rather than runtime favicon discovery.

- [ ] **Step 2: Write failing page contract assertions**

Update `test/pages.test.js` to require:

```js
for(const expected of [
  'Weather','Calendar','Personal','Holidays','Reminders',
  'Overdue','Today','Birthdays','Life Admin','Trips',
  'View calendar','href="/calendar"','app-launcher'
]) assert.ok(home.includes(expected));
```

Also assert the dashboard does not render `ppodolske@gmail.com` or `Home` as source labels inside Personal.

- [ ] **Step 3: Implement three-column desktop markup/CSS**

Use a top compact greeting/date, then CSS grid columns approximately `35% 40% 25%`. Left: Weather/Birthdays/Trips. Middle: clickable Calendar briefing. Right: Overdue/Today/Life Admin/App launchers. Website Admin is full-width below.

- [ ] **Step 4: Implement responsive breakpoints**

Tablet: calendar full-width and remaining sections in two-column flow. Mobile order exactly follows the spec. Avoid JS reordering; use CSS grid areas/order classes.

- [ ] **Step 5: Implement calendar card contents**

Render Personal, Holidays, Reminders with compact Today/Tomorrow cues. Make the title/card affordance link to `/calendar`. Do not link the dashboard card primarily to settings.

- [ ] **Step 6: Implement iPhone-style launchers**

Render icon as dominant rounded-square, name under/adjacent, status as a small dot/badge. Add `onerror` fallback to a local neutral app icon or CSS fallback element without hiding the app link.

- [ ] **Step 7: Preserve weather and app-status client scripts**

Keep Open-Meteo and `/api/status` behavior, adjusting selectors only as needed for new markup. Weather failure should render an unavailable label inside the Weather card.

- [ ] **Step 8: Run renderer/static tests**

```bash
node test/pages.test.js
node test/pwa.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/pages/home.js src/branding.js test/pages.test.js test/pwa.test.js
git commit -m "feat: redesign home as daily dashboard"
```

---

### Task 6: Add authenticated read-only `/calendar` month view

**Files:**
- Create: `src/pages/calendar-view.js`
- Modify: `src/routes/calendars.js`
- Create: `test/calendar-view-routes.test.js`
- Modify: `test/calendars-routes.test.js`
- Modify: `src/app.js` only if route registration needs separation; otherwise keep existing calendar route handler.

**Interfaces:**
- Consumes: `listCalendarViewData`, `buildCalendarMonth`, owner auth guard.
- Produces: authenticated `GET /calendar?month=YYYY-MM` page.

- [ ] **Step 1: Write failing route tests**

Test:

```js
GET /calendar                 -> authenticated owner receives 200
GET /calendar?month=2026-09   -> September 2026 view
unauthenticated GET /calendar -> follows existing owner/auth redirect behavior
```

Also stub provider/sync dependencies and assert neither `syncCalendars` nor Google/Apple provider calls occur.

- [ ] **Step 2: Verify failure**

Run `node test/calendar-view-routes.test.js`; expect `/calendar` unhandled/404.

- [ ] **Step 3: Add `/calendar` to calendar route matching**

Handle `GET /calendar` before POST-only settings actions. Parse `month` through `getCalendarMonthWindow`; invalid values should fall back to current Sydney month or return a safe 400 according to the chosen domain helper contract. Prefer fallback to current month for user-facing resilience.

- [ ] **Step 4: Build `renderCalendarViewPage`**

Render:

- page title `Calendar`;
- Back to dashboard link `/`;
- Calendar Settings link `/settings/calendars`;
- Today, previous, next controls;
- seven-column month grid on desktop;
- stacked/list-friendly day cells on narrow screens;
- all imported selected-source events;
- source color marker/name in event detail where useful;
- location and external provider event link when present;
- read-only presentation, no edit/complete controls.

- [ ] **Step 5: Add event detail behavior without a framework**

Prefer native `<details>`/`<summary>` or compact inline expansion so event metadata is accessible without adding a client framework. External event links use `target="_blank" rel="noopener noreferrer"`.

- [ ] **Step 6: Add failure-state test and implementation**

Make `listCalendarViewData` throw and assert the page still renders with `Calendar data is temporarily unavailable.` plus Calendar Settings link.

- [ ] **Step 7: Run focused calendar tests**

```bash
node test/calendar-view.test.js
node test/calendar-view-routes.test.js
node test/calendars-routes.test.js
node test/calendars-pages.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/calendar-view.js src/routes/calendars.js src/app.js test/calendar-view-routes.test.js test/calendars-routes.test.js
git commit -m "feat: add full imported calendar view"
```

---

### Task 7: Version bump and complete regression suite

**Files:**
- Modify: `src/branding.js`
- Modify: `package.json`
- Modify: `test.js`
- Modify tests that intentionally assert old version text.

**Interfaces:**
- Produces: application/package/test suite consistently report `0.11.0`.

- [ ] **Step 1: Write/update version assertions**

Change tests that expect `v0.10.0` to expect `v0.11.0`.

- [ ] **Step 2: Update versions**

Set:

```js
const VERSION='0.11.0';
```

and:

```json
"version": "0.11.0"
```

Update `test.js` final success line to `preston.ai v0.11.0 test suite passed` and register the three new test files.

- [ ] **Step 3: Run syntax checks**

```bash
node --check server.js
node --check src/pages/home.js
node --check src/pages/calendar-view.js
node --check src/routes/site.js
node --check src/routes/calendars.js
node --check src/domain/calendars.js
```

Expected: all exit 0.

- [ ] **Step 4: Run the full suite**

```bash
npm test
```

Expected: all tests pass and final output reports `preston.ai v0.11.0 test suite passed`.

- [ ] **Step 5: Verify reminder-engine isolation explicitly**

```bash
node test/reminder-engine.test.js
node test/reminder-job.test.js
node test/calendar-digest.test.js
```

Expected: PASS; noon/evening urgent checks still do not consume dashboard calendar logic.

- [ ] **Step 6: Commit**

```bash
git add src/branding.js package.json test.js test
git commit -m "chore: release preston.ai v0.11.0 candidate"
```

---

### Task 8: UAT deployment and acceptance verification

**Files:**
- No product-code changes unless a UAT defect is found and fixed through a new red-green test cycle.

**Interfaces:**
- Produces: verified v0.11.0 release candidate on UAT; production remains unchanged pending explicit approval.

- [ ] **Step 1: Verify branch is clean and identify candidate commit**

```bash
git status --short
git rev-parse HEAD
```

Expected: clean working tree and a single candidate SHA to deploy.

- [ ] **Step 2: Verify CI on the candidate SHA**

Require the repository CI workflow for the exact candidate commit to pass before UAT acceptance.

- [ ] **Step 3: Deploy only to `preston-run-uat`**

Deploy `build/preston-ai-v0.11.0` to the existing UAT service. Do not alter `preston-run-hub` production service or scheduled production workers.

- [ ] **Step 4: Dashboard UAT checklist**

Verify authenticated UAT manually:

- prominent Sydney weather;
- Personal combines `ppodolske@gmail.com` + `Home` without source labels;
- two holiday calendars appear in Holidays;
- outstanding calendar reminders appear in Reminders; completed/dismissed/cancelled ones do not;
- horizon includes today, tomorrow through 09:00, and tomorrow all-day only;
- Overdue and Today are separate and non-duplicative;
- Birthdays, Life Admin, Trips remain separate;
- app icons visually resemble launcher icons and links work;
- layout materially reduces scrolling on desktop;
- mobile ordering matches spec.

- [ ] **Step 5: Full calendar UAT checklist**

Verify:

- dashboard Calendar card opens `/calendar`;
- current month loads by default;
- previous/next/Today navigation works;
- imported timed/all-day/multi-day events appear;
- source color/name is available in full view;
- event location/provider link appears when available;
- page is read-only;
- Back to dashboard and Calendar Settings links work.

- [ ] **Step 6: Failure/isolation smoke checks**

Confirm no observed regression in Notifications, Calendar Settings, Life Admin, Trips, People, PWA install assets, or scheduled reminder/calendar-sync jobs.

- [ ] **Step 7: Stop at release gate**

Do not merge to `main` and do not deploy production. Present UAT results and exact candidate commit to the user and request explicit production release approval.
