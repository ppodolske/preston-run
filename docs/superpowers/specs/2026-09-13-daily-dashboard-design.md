# preston.ai v0.11.0 Daily Dashboard Design

## Goal

Turn the authenticated `preston.ai` landing page at `/` into an overview-first daily dashboard that shows the user's weather, near-term calendar, overdue/today actions, upcoming life items, birthdays, trips, app status, and admin links with substantially less scrolling than the current portal-style page.

## Design principles

- Overview first, not action first.
- Dense enough to minimize scrolling, but not cramped.
- Server-render private/personal data wherever practical.
- Continue using the existing authenticated `/` route rather than creating a parallel dashboard route.
- Each data domain must fail independently so one unavailable source never breaks the full page.
- Preserve the existing separation between calendar-imported reminders and preston.ai Life Admin/task reminders.
- No new external integrations are in scope for v0.11.0.

## Recommended architecture

Extend the existing server-rendered home-page flow.

The current `GET /` route already loads people, Life Admin items, tasks, and trips server-side before passing them to `renderHomePage`. v0.11.0 will add dashboard calendar data to that same route and rework `src/pages/home.js` into a three-column dashboard.

The dashboard and full calendar view must read from the existing normalized Supabase calendar cache. They must not contact Google Calendar or Apple CalDAV during page requests. Weather and app-status probing may remain browser-side because they are non-private and already work that way.

A separate dashboard API or client-side data-loading architecture is intentionally out of scope.

## Desktop layout

Use a three-column grid optimized for laptop/desktop use:

| Left (~35%) | Middle (~40%) | Right (~25%) |
| --- | --- | --- |
| Prominent Sydney Weather | Calendar briefing | Needs Attention — Overdue |
| Birthdays | Personal calendar | Needs Attention — Today |
| Trips | Holidays | Life Admin coming up |
|  | Reminders | App shortcuts/status |

Website Admin becomes a compact full-width strip below the three-column dashboard.

The layout should avoid large vertical section gaps and repeated page-level headings. Cards should use tighter padding and typography than the current page while remaining clearly separated.

## Responsive behavior

### Desktop

Use the three-column layout above.

### Tablet

Calendar becomes a full-width row. Weather and Needs Attention may sit in two columns below it, followed by Coming Up cards.

### Mobile

Collapse to this deliberate order:

1. Weather
2. Calendar
3. Overdue
4. Today
5. Life Admin
6. Birthdays
7. Trips
8. Apps
9. Website Admin

Do not blindly preserve desktop column order.

## Top briefing

The page remains overview-first. The greeting/date header stays compact at the top, followed immediately by the prominent weather and calendar briefing surfaces.

### Weather

Keep Sydney weather prominent, at roughly the current information level:

- current temperature
- current condition
- feels-like temperature
- rain chance
- daily high/low
- wind speed

The existing browser-side Open-Meteo call may remain. Weather failure must never prevent the rest of the dashboard from rendering.

## Calendar briefing

### Source of truth

Read from the existing `calendar_events` cache and associated `calendar_sources` metadata.

Do not call Google or Apple from the page request.

### Dashboard time window

Use `Australia/Sydney` for all dashboard boundary calculations.

Include:

- all qualifying events that overlap today;
- timed events tomorrow with a start time at or before 09:00 Sydney time;
- all-day events tomorrow regardless of time.

Exclude events later than that window from the top briefing.

Events spanning midnight should be included when they overlap the visible dashboard window; inclusion must not depend solely on the event's start time being inside the window.

### Calendar grouping

Render exactly three groups in this order:

#### 1. Personal

Combine the calendar sources named:

- `ppodolske@gmail.com`
- `Home`

Render them as one chronological list.

Do not display or otherwise distinguish which of those two source calendars an item came from.

#### 2. Holidays

Group the two holiday calendars into a Holidays section after Personal.

Holiday events should be visually quieter than personal events so they provide context without competing with scheduled plans.

The implementation should identify the intended holiday sources from the selected calendar-source metadata rather than hard-coding provider IDs.

#### 3. Reminders

Calendar-imported reminders stay inside the Calendar briefing as a third group.

This group is not the preston.ai reminder engine and must remain conceptually and technically separate from Life Admin/task reminders.

Hide completed or dismissed calendar reminders. Only outstanding calendar reminders belong in this group.

Before implementation, verify whether the normalized calendar cache currently retains enough provider state to distinguish completed/dismissed imported reminders. If it does not, treat that as a discovered schema/data-model gap and design the smallest compatible extension before coding; do not silently infer completion from title/status text.

### Calendar rendering

Within each group:

- chronological order;
- all-day items clearly marked as all-day;
- tomorrow items visually distinguished from today without creating a separate page-level section;
- compact presentation suitable for the middle column.

The Calendar briefing card itself must be an obvious interactive entry point to the full imported-calendar view at `/calendar`. Do not make individual dashboard event rows require separate navigation behavior; the primary card/title action should open the full view.

If a group has no qualifying items, show a compact empty state rather than hiding the group entirely unless doing so materially reduces clutter.

## Full calendar view

Add a new authenticated read-only route at `/calendar` for viewing everything currently imported into the normalized calendar cache.

This is distinct from `/settings/calendars`, which remains the connection/source-selection/sync settings page.

### Purpose

The full calendar view should let the user inspect all imported calendar events beyond the short dashboard horizon without opening Google Calendar or iCloud Calendar.

### Default presentation

- default to a conventional month calendar centered on the current Sydney month;
- provide previous-month, next-month, and Today navigation;
- show all imported events that overlap the visible month, including all-day and multi-day events;
- preserve source colors when useful in the full view, because source differentiation is valuable here even though `ppodolske@gmail.com` and `Home` are intentionally flattened on the dashboard;
- event detail may expose title, date/time, all-day state, location, source display name, and external provider URL when present;
- remain read-only in v0.11.0.

The page must query only the normalized Supabase cache and associated source metadata. It must not trigger provider sync or provider API calls as part of normal rendering.

### Calendar navigation relationship

- clicking/tapping the dashboard Calendar briefing card or its `View calendar` affordance opens `/calendar`;
- `/calendar` includes a clear path back to the dashboard;
- `/calendar` includes a secondary link to `/settings/calendars` for connection/source management;
- Calendar Settings does not become the primary destination from the dashboard.

### Full-view failure behavior

If calendar data is unavailable, `/calendar` still renders its authenticated page shell and a clear unavailable state with a link to Calendar Settings; it must not expose credentials or raw provider identifiers.

## Needs Attention

Split the current attention surface into two separate cards:

### Overdue

Show overdue Life Admin items and tasks only.

### Today

Show Life Admin items and tasks due today only.

An item must never appear in both cards.

Within each card, sort by:

1. priority;
2. due time when one exists;
3. due date / stable existing order as a final tie-breaker.

The implementation should continue using existing Life Admin/task domain semantics where possible instead of duplicating due/priority logic in the page renderer.

## Coming Up

Keep separate compact cards rather than merging all domains into one timeline.

### Birthdays

- retain the existing 90-day horizon;
- show a compact capped list;
- include a `View all` / manage-people link.

### Life Admin

- retain the existing 90-day horizon;
- exclude items already shown in Overdue or Today;
- show a compact capped list;
- include a `View all` link.

### Trips

- retain the existing 180-day horizon;
- show a compact capped list;
- include a `View all` link.

Cards should not expand indefinitely. Favor capped lists plus navigation links to minimize scrolling.

## App shortcuts/status

Retain the current application shortcuts and status checks for Dose & Scale, Parks, and Archive.

Present them as compact iPhone-style app launchers rather than generic cards:

- use each app's own maintained app icon/favicon asset;
- render the icon as the dominant square/rounded-square visual with the app name beneath or immediately adjacent;
- keep status as a small secondary indicator/badge so it does not overpower the launcher treatment;
- clicking the icon or label opens the app;
- do not fetch or scrape remote favicons dynamically during page load; define stable icon asset URLs/metadata in the app registry or another maintained configuration source;
- if an app icon cannot load, fall back gracefully to a neutral branded placeholder rather than breaking layout.

Compress these launchers for the right column and mobile launcher row/grid.

The existing `/api/status` probing behavior may remain unless implementation reveals a concrete performance/reliability issue.

## Website Admin

Retain Website Admin but demote it visually because it is not part of the daily briefing.

Render it as a compact full-width strip at the bottom containing the existing site/GitHub/Railway links.

## Failure behavior

Each domain must degrade independently:

- Calendar unavailable: Calendar card renders an unavailable state; all other dashboard sections still render.
- Life Admin/tasks unavailable: only Overdue, Today, and Life Admin Coming Up degrade.
- Birthday data unavailable: Birthday card degrades independently.
- Trip data unavailable: Trip card degrades independently.
- Weather unavailable: Weather card shows an unavailable state after client-side fetch failure.
- App-status probe unavailable: app status shows unavailable while app launchers/navigation remain usable.
- App icon unavailable: only that launcher uses its fallback icon.

The server must continue returning the authenticated home page whenever at least the core page renderer can run.

## Data and privacy boundaries

- Personal calendar, Life Admin, task, trip, and birthday data stays server-rendered and private.
- The full `/calendar` page is authenticated and private.
- Do not expose provider credentials or secret configuration in HTML or client-side APIs.
- Provider calendar identifiers must not be surfaced to the user; source display names/colors are allowed in the full calendar view.
- Do not broaden Google Calendar OAuth scopes.
- Do not create calendar events as preston.ai reminder rows.
- Noon/evening urgent reminder behavior remains unchanged.

## Versioning and release boundary

- Feature version: `v0.11.0`.
- Development branch: `build/preston-ai-v0.11.0`.
- No production merge/deploy without an explicit release approval after UAT.
- v0.11.0 does not require new third-party integrations.
- A database migration is not expected unless verification shows calendar-reminder completion/dismissal state is not represented in the current cache.

## Likely code boundaries

Expected areas of change:

- `src/routes/site.js` — load calendar dashboard data and pass richer dashboard state into the renderer.
- `src/pages/home.js` — replace portal-style layout with the approved three-column dashboard and icon-based app launchers.
- `src/routes/calendars.js` or a focused read-only calendar route module — serve authenticated `/calendar` separately from `/settings/calendars`.
- new/read-only calendar page renderer — render month navigation, event layout, event details, dashboard/settings navigation.
- `src/branding.js` or focused app-registry metadata — add maintained app icon asset URLs/paths.
- calendar data/domain helper(s) — derive Sydney dashboard window, source grouping, overlap behavior, reminder visibility, and visible-month event ranges.
- Life Admin domain helper(s) — expose explicit Overdue vs Today sets and prevent duplication in Coming Up.
- tests — dashboard calendar-window boundaries, grouping rules, reminder filtering, full-calendar month range/navigation, attention splitting/deduplication, app launcher rendering, independent failure states.
- version/branding files — bump to `0.11.0`.

If the calendar reminder-state verification requires a model extension, add only the smallest focused schema/data/provider changes needed to represent outstanding vs completed/dismissed reminders correctly.

## Test requirements

At minimum, tests must cover:

### Calendar window

- event today is included;
- timed event tomorrow at 08:59 is included;
- timed event tomorrow at 09:00 is included;
- timed event tomorrow after 09:00 is excluded;
- tomorrow all-day event is included;
- later all-day event is excluded;
- event spanning midnight and overlapping the visible window is included.

### Calendar grouping

- `ppodolske@gmail.com` and `Home` events merge into Personal;
- source identity between those two is not rendered on the dashboard;
- both holiday calendar sources map to Holidays;
- calendar reminders map to Reminders;
- completed/dismissed calendar reminders are excluded.

### Full calendar view

- `/calendar` requires authenticated owner access;
- current month is the default view;
- previous/next month navigation produces the expected Sydney month range;
- timed, all-day, and multi-day events overlapping the visible month are included;
- source display name/color may be shown without provider calendar IDs;
- external event URL is rendered only when present;
- full view reads cached data and does not trigger sync/provider calls;
- unavailable calendar data produces a page-level empty/unavailable state rather than a server crash.

### Needs Attention

- overdue item appears only in Overdue;
- due-today item appears only in Today;
- upcoming item appears in neither;
- items shown in Overdue/Today are not duplicated in Life Admin Coming Up;
- priority ordering is deterministic.

### App launchers

- each configured app renders its configured icon and app name;
- launcher links point to the configured app URL;
- status remains a secondary indicator;
- missing/broken icon metadata uses the fallback presentation.

### Failure isolation

- calendar-load failure still renders weather shell, Life Admin, birthdays, trips, and app navigation;
- Life Admin/task failure does not suppress calendar/birthday/trip sections;
- birthday or trip failure affects only its card.

### Responsive/rendering contract

Server-render tests should verify the expected semantic sections, calendar navigation, app launcher metadata, and links are present. Exact CSS-pixel layout should not be unit-tested.

## Out of scope

- editing calendar events from the dashboard or full calendar view;
- creating or completing calendar reminders from preston.ai;
- dragging/rescheduling events;
- Gmail/email integration;
- additional weather providers;
- new Life Admin categories or reminder-engine behavior;
- changing noon/evening urgent-check logic;
- replacing the existing authenticated landing route with a new SPA or client framework;
- redesigning the underlying Calendar Settings, People, Trips, or Life Admin pages.

## Success criteria

v0.11.0 is successful when the authenticated landing page functions as a compact daily operating view where, on a typical laptop screen, the user can see prominent weather, the near-term calendar, overdue/today actions, and most coming-up context with materially less scrolling than v0.10.x; app shortcuts feel like polished app launchers using each app's own icon; and the Calendar briefing provides one-click access to a private full month view of all imported calendar events, while preserving existing privacy and reminder boundaries.