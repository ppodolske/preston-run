# preston.ai v0.11.0 Daily Dashboard Design

## Goal

Make authenticated `preston.ai` at `/` the user's daily operating surface rather than only a portal. It should combine a preston.ai-owned Morning Digest, Sydney weather, near-term calendar context, planned workouts from Dose & Scale, overdue/today actions, upcoming Life Admin, birthdays, trips, app launchers, and useful website administration links while remaining compact and resilient.

This revision incorporates UAT feedback from the first v0.11.0 candidate and supersedes earlier layout/integration decisions in this document where they conflict.

## Product ownership

`preston.ai` owns the daily briefing and Morning Digest.

Dose & Scale remains the detailed health, recovery, weight, training, and workout-planning application. It supplies a constrained read-only fitness context to preston.ai, but it no longer owns or renders the Morning Digest after migration is complete.

Google Calendar and Apple/iCloud remain imported read-only calendar providers. Planned workouts are not written back to Google or Apple.

## Design principles

- Overview first, not action first.
- `preston.ai` is the aggregation/presentation layer; source apps remain authoritative for their own data.
- Server-render private/personal data wherever practical.
- No live Google or Apple provider calls from dashboard or calendar page requests.
- Avoid making normal dashboard rendering depend on Dose & Scale being live; use a local preston.ai cache and show freshness.
- Each data domain fails independently.
- Preserve the technical and conceptual separation between calendar-imported reminders and preston.ai Life Admin/task reminders.
- Use `preston.ai` exactly, all lowercase, in user-facing product references. Do not use `Preston` as the product name in explanatory UI copy.
- Do not add content merely to fill space.

## Architecture overview

### preston.ai

Continue extending the existing authenticated server-rendered home flow. The home route assembles:

- birthdays;
- Life Admin/tasks;
- trips;
- imported calendar data from the existing normalized Supabase cache;
- cached Dose & Scale daily context;
- preston.ai-generated Morning Digest;
- planned workouts derived from the cached Dose & Scale context.

The dashboard renderer receives already-normalized view models. Provider credentials, Dose & Scale service credentials, and raw provider identifiers never reach the browser.

### Dose & Scale service-to-service feed

Add a small authenticated, read-only endpoint to Dose & Scale specifically for preston.ai, for example `GET /api/preston/daily-context`.

This endpoint is server-to-server only and is protected by a dedicated shared bearer/service token separate from the user's Dose & Scale browser Basic Auth credentials.

It should return only the minimum context required by preston.ai, not the full Dose & Scale application state. The contract should include normalized values for:

- source/generated timestamp;
- latest Garmin import/sync timestamp;
- current-day recovery metrics required by the existing digest logic;
- recent recovery baseline values required by that logic;
- recent weight trend inputs or pre-normalized trend values;
- recent training summary inputs;
- active training phase;
- recent intervention/context used by the existing digest;
- planned workouts sufficient to render the relevant current/future calendar horizon;
- enough actual-training information to identify whether today's planned workout appears completed when that match can be determined reliably.

The endpoint is read-only. preston.ai must never mutate Dose & Scale state through this integration.

### preston.ai fitness-context cache

Normal page rendering must read a local preston.ai cache rather than directly calling Dose & Scale.

Use the smallest suitable Supabase-backed model to store the latest successful Dose & Scale context snapshot plus fetch timestamps. A scheduled Railway job should refresh the snapshot after the normal morning Dose & Scale/Garmin sync window. The implementation plan should choose a Sydney-local schedule that does not disturb the existing 06:55 calendar sync or 07:05 preston.ai Morning Summary behavior.

A manual refresh action on preston.ai may trigger a server-side refresh of this context if practical, but the dashboard must always be able to fall back to the last successful snapshot.

A failed Dose & Scale refresh must not erase the last good snapshot.

## Morning Digest

### Ownership and migration

Move Morning Digest generation from Dose & Scale to preston.ai.

The first preston.ai implementation should preserve the substantive logic and interpretation of the existing Dose & Scale Morning Digest before adding broader cross-domain recommendations. This avoids silently changing health/training guidance while changing ownership.

After parity is established:

- remove the Morning Digest panel/generation behavior from the Dose & Scale UI;
- retain Dose & Scale as the source of the underlying recovery/training/weight data;
- make preston.ai the only canonical Morning Digest UI and generation/storage owner.

### Persistence

Persist the preston.ai Morning Digest by Sydney date, including:

- date;
- generation timestamp;
- source Dose & Scale context/sync timestamp;
- status (`good`, `watch`, `poor`, `insufficient` or equivalent existing semantics);
- headline;
- structured insight/context fields needed to render the cards;
- digest bullets/text where useful;
- a schema/version marker so future digest logic can evolve safely.

Regenerate only when appropriate: no digest yet for the date, the underlying Dose & Scale snapshot materially changed, or the user explicitly requests refresh.

### Dashboard presentation

The Morning Digest sits immediately below the greeting/header and above the rest of the dashboard. It spans the full available content width on desktop, tablet, and mobile.

Do not transplant the old Dose & Scale bullet card visually. Render the digest in preston.ai's card language:

- a full-width digest header/status card with headline, status, generated time, and source freshness;
- underneath, a responsive row/grid of focused cards such as Recovery, Today's Training, Weight Trend, and Recent Training / Context;
- important recommendation text remains readable without requiring navigation to Dose & Scale;
- include an `Open Dose & Scale` affordance for detailed data;
- optionally include `Refresh` when a safe server-side refresh path exists.

On mobile, every digest card is full width within the page's normal horizontal padding.

## Planned workouts

### Source and ownership

Planned workouts originate in Dose & Scale/Garmin and are delivered through the service-to-service daily-context feed.

They become a first-class internal calendar source in preston.ai, but they must **not** be inserted into `calendar_events`, because that table remains the normalized provider-import cache for Google/Apple data.

The calendar domain layer merges provider calendar events with cached planned workouts at the view-model level.

### Dashboard Calendar section

The dashboard Calendar card has four groups in this order:

1. Personal
2. Holidays
3. Reminders
4. Planned Workouts

The Planned Workouts group always shows planned workouts for **today and tomorrow** when present.

Today's planned workout remains visible even when it has already been completed. Completion is context, not a reason to remove the plan. If reliable matching to an actual completed activity exists, show a quiet `Completed` state; otherwise show the plan without guessing completion.

Tomorrow's plan is shown as future context.

Planned workouts must not become Life Admin tasks or reminder-engine rows.

### Full `/calendar` view

The authenticated read-only `/calendar` month view merges planned workouts into the visible month alongside imported calendar events.

Planned workouts should have a consistent dedicated visual treatment/source label such as `Planned Workout`, distinguishable from Google/iCloud sources without overwhelming the calendar.

Include the full set of cached planned workouts that overlap the visible month, not merely today/tomorrow.

Planned workouts remain read-only in preston.ai. No drag/reschedule/edit behavior is introduced in v0.11.0.

## Calendar briefing

### Imported source of truth

Read imported events from the existing `calendar_events` cache and `calendar_sources` metadata. Never call Google or Apple from the page request.

### Imported-event dashboard window

Use `Australia/Sydney` for all boundaries. Include:

- all qualifying imported events overlapping today;
- timed imported events tomorrow starting at or before 09:00 Sydney;
- all-day imported events tomorrow.

Events spanning midnight are included by overlap rather than start-date-only logic.

The Planned Workouts group uses its separate today/tomorrow rule above and is not truncated by the imported-event 09:00 cutoff.

### Imported groups

#### Personal

Merge selected sources named `ppodolske@gmail.com` and `Home` into one chronological list and do not display their individual source identity on the dashboard.

#### Holidays

Group the selected holiday calendars and render them more quietly than personal events. Identify them from selected source metadata, not provider IDs.

#### Reminders

Calendar-imported reminders remain separate from preston.ai reminders/Life Admin. Only outstanding imported reminders render. Do not infer completion from title text.

## Full calendar view

Keep `/calendar` as a separate authenticated read-only month view distinct from `/settings/calendars`.

Requirements:

- default to current Sydney month;
- previous, next, and Today navigation;
- provider events overlapping the visible month, including all-day/multi-day events;
- planned workouts overlapping the visible month;
- provider source display names/colors where useful;
- dedicated planned-workout styling;
- event details may show title, time/all-day, location, source display name, and external provider URL when present;
- no provider credentials/provider IDs in rendered output;
- no Google/Apple sync call on normal render;
- no Dose & Scale live call on normal render; use cached planned-workout context.

The dashboard Calendar card/title opens `/calendar`; Calendar Settings remains a secondary management destination.

## Desktop layout

Use this overall order:

1. compact header/greeting;
2. full-width Morning Digest;
3. three-column daily dashboard;
4. full-width Website Admin card area;
5. footer/version.

Three-column dashboard:

| Left (~35%) | Middle (~40%) | Right (~25%) |
| --- | --- | --- |
| Weather | Calendar briefing | Overdue |
| Birthdays | Personal | Today |
| Trips | Holidays | Life Admin coming up |
|  | Reminders | Apps |
|  | Planned Workouts |  |

The exact proportions may be tuned during UAT for visual balance; preserving overview density matters more than exact percentages.

## Responsive behavior

### Tablet

Morning Digest remains full width. Calendar may take a full-width row, with remaining cards arranged in two columns where comfortable.

### Mobile

All dashboard and digest cards must be **100% of the available content width** within the page's standard horizontal padding. No desktop/grid width constraint may survive the mobile breakpoint.

Mobile order:

1. Morning Digest header/status
2. Morning Digest detail cards
3. Weather
4. Calendar (including Planned Workouts)
5. Overdue
6. Today
7. Life Admin
8. Birthdays
9. Trips
10. Apps
11. Website Admin

App launchers and Website Admin retain their intended visual structure on mobile; they must not collapse into tiny text strips.

## Weather

Keep the current Sydney weather information level:

- current temperature;
- condition;
- feels like;
- rain chance;
- high/low;
- wind.

The existing Open-Meteo browser fetch may remain. Weather failure is isolated.

## Needs Attention

Keep separate Overdue and Today cards using the already-defined domain behavior:

- overdue items only in Overdue;
- due-today items only in Today;
- never duplicate between them;
- future/undated attention signals are not mislabeled as due today;
- Life Admin Coming Up excludes items already shown in Overdue/Today.

## Coming Up

Keep the existing compact horizons and caps:

- Birthdays: 90 days;
- Life Admin: 90 days, excluding Overdue/Today;
- Trips: 180 days.

Do not add additional generic content widgets in v0.11.0. The Morning Digest and planned-workout context fill the meaningful gaps identified in UAT.

## App launchers

Retain Dose & Scale, Parks, and Archive as iPhone-style launchers on desktop and mobile.

Use stable maintained app assets, not runtime favicon scraping:

- Parks: use its existing tree asset (`park-favicon.svg` / deployed equivalent);
- Archive: use its existing book app icon (`app/icon.svg` / deployed equivalent);
- Dose & Scale: use its maintained app/logo icon asset suitable for launcher presentation.

The icon is the dominant rounded-square visual, with app name and a small secondary availability/status indicator. A failed image uses the preston.ai fallback icon without breaking layout.

## Website Admin

Restore Website Admin as a visually substantial full-width section rather than a short dark strip.

Render one card per site/app with clear identity and actions, preserving the useful structure from the earlier portal design:

- site/app name;
- site/open action;
- GitHub action;
- Railway action where applicable.

On desktop these cards may sit in a compact row/grid inside the full-width Website Admin section. On mobile they stack full width.

Website Admin remains visually below the daily-operating content, but should look intentional rather than lost.

## Product naming

Audit user-facing copy in preston.ai pages touched by this release. Where the product itself is referenced, use `preston.ai` exactly, lowercase.

For example, Calendar Settings should say `Choose exactly which personal calendars preston.ai may use...`, not `Preston may use...`.

This rule does not require changing a person's name where a human name is genuinely intended; it applies to the product/assistant branding.

## Freshness

Because preston.ai aggregates cached sources, expose small, quiet freshness cues where useful:

- Calendar: last successful provider sync when available;
- Morning Digest / Dose & Scale context: digest generation time and source Garmin/context sync time.

Freshness text is informational, not another prominent status card.

## Failure isolation

- Dose & Scale fetch unavailable: retain last successful cached fitness context and digest; mark freshness/staleness. If no cache exists, only Morning Digest and Planned Workouts degrade.
- Digest generation failure: show a digest unavailable state without suppressing other dashboard sections.
- Calendar provider cache failure: Calendar provider groups degrade; planned workouts may still render if fitness cache is available.
- Fitness cache failure: provider calendar groups still render.
- Life Admin/tasks failure: only Overdue/Today/Life Admin Coming Up degrade.
- Birthday failure: only Birthdays degrade.
- Trips failure: only Trips degrade.
- Weather failure: only Weather degrades.
- App-status failure: launch links remain usable.
- App-icon failure: only that icon falls back.

The authenticated page shell should still render whenever the core renderer can run.

## Privacy and security

- The Dose & Scale integration is server-to-server only.
- Use a dedicated service token/shared secret; never reuse or expose the user's Dose & Scale Basic Auth password.
- Do not expose the service token in HTML/client JavaScript.
- The Dose & Scale endpoint returns a deliberately constrained data contract, not full `app_state`.
- Personal data stays behind preston.ai authentication.
- Do not broaden Google Calendar OAuth scopes.
- Planned workouts are never written to Google/Apple as part of v0.11.0.
- Planned workouts do not create preston.ai reminder rows.
- Existing noon/evening urgent-check behavior remains unchanged.

## Release/version boundary

- Keep feature version `v0.11.0`; this is a UAT revision of the same unreleased feature, not a new production release line.
- Continue on `build/preston-ai-v0.11.0`.
- Dose & Scale will require a coordinated small change for the read-only preston.ai feed and removal of its Morning Digest UI after parity is proven.
- No production merge/deploy for either app without explicit approval after UAT.
- The existing UAT candidate should be replaced with a new verified v0.11.0 candidate after these changes.

## Likely code boundaries

### preston.ai repo

Expected changes include:

- `src/pages/home.js` — full-width Morning Digest, mobile full-width fixes, Website Admin cards, correct app icons, freshness cues;
- `src/routes/site.js` — load cached fitness context/digest and planned-workout models;
- `src/domain/calendars.js` — merge planned workouts into dashboard/full-month calendar view models without writing to `calendar_events`;
- `src/pages/calendar-view.js` — render planned workouts in month view;
- `src/pages/calendars.js` and other touched user-facing pages — `preston.ai` naming cleanup;
- `src/branding.js` — stable Parks tree and Archive book icon metadata;
- focused Dose & Scale client/data/domain modules in preston.ai for fetch/cache/digest generation;
- scheduled fitness-context refresh job;
- Supabase migration/table(s) only as needed for cached Dose & Scale context and persisted Morning Digest;
- tests and CI syntax checks.

### Dose & Scale repo

Expected changes include:

- server-side constrained `GET /api/preston/daily-context` endpoint;
- dedicated service-token authentication;
- normalized contract builder isolated from the HTTP route;
- tests for auth, contract minimization, planned workouts, and relevant digest inputs;
- after preston.ai parity verification, remove/inactivate the old Morning Digest UI/generation script so there is one owner.

## Test requirements

At minimum, add/retain tests for:

### Dose & Scale context contract

- dedicated service token required;
- browser Basic Auth credential is not the service integration credential;
- response excludes unrelated/full application state;
- required recovery/baseline/weight/training/phase/intervention inputs are normalized;
- planned workouts include dates/names/types/details needed by preston.ai;
- completion state is only asserted when based on reliable actual-workout matching;
- timestamps/freshness metadata are present.

### Morning Digest migration

- existing digest fixture(s) produce equivalent status/headline/substantive recommendation content when generated in preston.ai;
- digest persists by Sydney date;
- unchanged source snapshot does not create unnecessary regeneration;
- changed snapshot can regenerate;
- stale last-good context remains usable after source failure;
- Dose & Scale no longer renders a competing Morning Digest after migration is complete.

### Planned workouts

- today's workout is included even when marked completed;
- tomorrow's workout is included;
- dashboard Planned Workouts does not hide today's completed plan;
- dashboard planned-workout window is independent from the imported-calendar tomorrow-09:00 cutoff;
- full month view includes cached planned workouts in the visible month;
- planned workouts never become `calendar_events` rows;
- planned workouts never become preston.ai reminder rows.

### Existing calendar behavior

Retain tests for Sydney imported-event window, Personal/Holidays/Reminders grouping, reminder visibility, month overlap/navigation, privacy, and no provider calls during page rendering.

### UI/UAT regressions

- Morning Digest is full width before the three-column dashboard;
- mobile card containers render with full available width semantics;
- Parks launcher uses tree asset metadata;
- Archive launcher uses book icon metadata;
- Website Admin renders card structure with Site/GitHub/Railway actions and retains structure on mobile;
- user-facing product copy uses `preston.ai`, not `Preston`, in affected pages;
- freshness labels render when timestamps exist and degrade quietly when they do not.

### Existing reminder isolation

Retain regression coverage proving calendar/planned-workout integration does not alter Morning Summary reminder-row semantics or noon/evening urgent checks.

## Out of scope

- editing/rescheduling planned workouts from preston.ai;
- writing planned workouts into Google/iCloud;
- broadening Morning Digest logic to make new calendar/Life Admin-driven health recommendations in this migration pass;
- email/news/finance/general notes widgets;
- creating/completing calendar reminders from preston.ai;
- changing Life Admin categories;
- changing noon/evening urgent reminder behavior;
- replacing the current server-rendered architecture with a SPA.

## Success criteria

v0.11.0 is ready for release when:

- preston.ai is the sole owner/presenter of the Morning Digest;
- the digest is full-width, native to preston.ai, and substantively equivalent to the existing Dose & Scale logic;
- today's and tomorrow's planned workouts appear as day context on the dashboard, including today's completed workout;
- planned workouts appear throughout the full preston.ai calendar month view without being written to provider calendar storage;
- Parks uses the tree icon and Archive uses the book icon;
- Website Admin regains a useful card structure on desktop and mobile;
- all mobile dashboard/digest/admin cards occupy the full available width;
- product copy consistently says `preston.ai` where it means the product;
- cached-source freshness is visible without clutter;
- all domains retain independent failure behavior;
- the complete automated regression suite and UAT pass before any production promotion.