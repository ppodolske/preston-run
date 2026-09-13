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
- Normal dashboard rendering never depends on Dose & Scale being live; use a local preston.ai cache and show freshness.
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

Add exactly one server-to-server endpoint to Dose & Scale: `GET /api/preston/daily-context`.

The endpoint is protected with `Authorization: Bearer <service-token>` using a dedicated secret such as `PRESTON_AI_SERVICE_TOKEN`. It must not reuse the user's Dose & Scale browser Basic Auth credentials.

Because Dose & Scale currently applies browser Basic Auth globally, the service endpoint must be mounted before that browser-auth middleware or otherwise explicitly use the service-token guard instead of requiring both credentials.

The endpoint returns only the minimum normalized context preston.ai needs, not the full Dose & Scale `app_state`. The contract includes:

- contract/schema version;
- generated timestamp;
- latest Garmin import/sync timestamp;
- current-day recovery metrics required by the existing digest logic;
- recent recovery baseline values required by that logic;
- recent weight trend inputs or normalized trend values;
- recent training summary inputs;
- active training phase;
- recent intervention/context used by the existing digest;
- all currently stored planned workouts needed to populate the current and future calendar views;
- enough actual-training information to identify whether today's planned workout appears completed when that match can be determined reliably.

The endpoint is read-only. preston.ai never mutates Dose & Scale state through this integration.

### preston.ai fitness-context cache

Normal page rendering reads a local Supabase-backed cache and never calls Dose & Scale directly.

Add a focused `fitness_context_cache` model with one current row per owner containing at minimum:

- owner id;
- contract/schema version;
- normalized payload JSON;
- source/Garmin updated timestamp;
- last successful fetch timestamp;
- last fetch-attempt timestamp;
- last fetch error, nullable.

A failed refresh updates attempt/error metadata but must not erase or replace the last successful payload.

Add a focused `morning_digests` model keyed by owner + Sydney date containing at minimum:

- owner id;
- Sydney date;
- digest schema/version;
- digest JSON/view-model payload;
- generated timestamp;
- source fitness-context updated timestamp.

Use RLS/owner access consistent with the existing private preston.ai tables.

### Refresh timing

Add a scheduled preston.ai fitness-context job that runs at **07:15 Australia/Sydney** each day, after the normal 07:00 Dose & Scale/Garmin sync window. Use the same DST-safe Railway scheduling/gating pattern already used by preston.ai jobs.

This job only refreshes the fitness cache and regenerates the day's Morning Digest when the source snapshot is new or the digest does not yet exist. It does not alter the existing 06:55 calendar sync or 07:05 Morning Summary schedule/behavior.

Add an authenticated `POST /api/fitness/refresh` action in preston.ai for manual refresh. It performs the server-side Dose & Scale fetch, updates the cache on success, regenerates the digest when needed, and redirects/returns safely. It never exposes the service token to the browser.

If the scheduled refresh happens before a delayed Garmin sync completes, the last good context remains visible with freshness metadata; the user can manually refresh. Do not add aggressive polling in v0.11.0.

## Morning Digest

### Ownership and migration

Move Morning Digest generation from Dose & Scale to preston.ai.

The first preston.ai implementation preserves the substantive logic and interpretation of the existing Dose & Scale Morning Digest before adding broader cross-domain recommendations. This avoids silently changing health/training guidance while changing ownership.

Migration sequence:

1. Add/test the constrained Dose & Scale service feed while the old D&S digest still exists.
2. Implement preston.ai cache + digest generation and verify parity in UAT.
3. Once parity is accepted, remove/inactivate the Dose & Scale Morning Digest UI/generation path so preston.ai is the sole canonical owner.

### Digest persistence and regeneration

Persist by Sydney date in `morning_digests`.

Regenerate only when:

- no digest exists for the Sydney date;
- the successful cached Dose & Scale source timestamp materially changes; or
- the user explicitly requests refresh.

The digest retains existing status semantics (`good`, `watch`, `poor`, `insufficient` or equivalent), headline, recommendation/context text, and structured values needed for presentation.

### Dashboard presentation

The Morning Digest sits immediately below the greeting/header and above the rest of the dashboard. It spans the full available content width on desktop, tablet, and mobile.

Do not transplant the old Dose & Scale bullet card visually. Render it in preston.ai's card language:

- a full-width digest header/status card with headline, status, generated time, source freshness, and Refresh/Open Dose & Scale actions;
- underneath, a responsive row/grid of focused cards for Recovery, Today's Training, Weight Trend, and Recent Training / Context;
- important recommendation text remains readable without navigating to Dose & Scale.

On mobile, every digest card is full width within the page's normal horizontal padding.

## Planned workouts

### Source and ownership

Planned workouts originate in Dose & Scale/Garmin and arrive through the cached daily-context feed.

They are a first-class internal calendar source in preston.ai but must **not** be inserted into `calendar_events`. That table remains the normalized Google/Apple provider-import cache.

The calendar domain layer merges provider calendar events and cached planned workouts only in view models.

### Dashboard Calendar section

The dashboard Calendar card has four groups in this order:

1. Personal
2. Holidays
3. Reminders
4. Planned Workouts

Planned Workouts always shows workouts for **today and tomorrow** when present.

Today's plan remains visible even when already completed. Completion is day context, not a reason to remove it. If reliable matching to an actual completed activity exists, show a quiet `Completed` state; otherwise show the plan without guessing.

Tomorrow's plan is shown as future context.

The planned-workout today/tomorrow window is independent of the imported-calendar tomorrow-09:00 cutoff.

Planned workouts never become Life Admin tasks or reminder-engine rows.

### Full `/calendar` view

The authenticated read-only `/calendar` month view merges all cached planned workouts overlapping the visible month alongside imported calendar events.

Planned workouts use a dedicated consistent visual treatment/source label such as `Planned Workout`. They remain read-only in preston.ai.

No drag, reschedule, edit, or write-back behavior is included in v0.11.0.

## Imported calendar briefing

### Source of truth

Read imported events from `calendar_events` and selected `calendar_sources`. Never call Google or Apple from the page request.

### Dashboard time window

Use `Australia/Sydney`.

For imported provider events include:

- events overlapping today;
- timed events tomorrow starting at or before 09:00 Sydney;
- all-day events tomorrow.

Events spanning midnight are included by overlap rather than start date only.

### Imported groups

#### Personal

Merge selected `ppodolske@gmail.com` and `Home` events chronologically and do not show which of those two sources an item came from on the dashboard.

#### Holidays

Group the selected holiday calendars and render them more quietly. Identify them from selected source metadata, not provider IDs.

#### Reminders

Calendar-imported reminders remain separate from preston.ai reminders/Life Admin. Only outstanding imported reminders render; do not infer completion from title text.

## Full calendar view

Keep `/calendar` as a separate authenticated read-only month view distinct from `/settings/calendars`.

Requirements:

- default to current Sydney month;
- previous, next, Today navigation;
- provider events overlapping the visible month, including all-day/multi-day events;
- cached planned workouts overlapping the visible month;
- provider source display names/colors where useful;
- dedicated planned-workout styling;
- event details may show title, time/all-day, location, source display name, and external provider URL when present;
- no provider credentials/provider IDs in rendered output;
- no Google/Apple or Dose & Scale live call on normal render.

The dashboard Calendar card/title opens `/calendar`; Calendar Settings remains a secondary management destination.

## Desktop layout

Overall order:

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

Exact proportions may be tuned during UAT for visual balance.

## Responsive behavior

### Tablet

Morning Digest remains full width. Calendar may take a full-width row, with remaining cards in two columns where comfortable.

### Mobile

All dashboard, digest, app, and Website Admin card containers are **100% of the available content width** inside the page's standard horizontal padding. No desktop/grid width constraint may survive the mobile breakpoint.

Mobile order:

1. Morning Digest header/status
2. Morning Digest detail cards
3. Weather
4. Calendar, including Planned Workouts
5. Overdue
6. Today
7. Life Admin
8. Birthdays
9. Trips
10. Apps
11. Website Admin

App launchers retain the iPhone-style treatment on mobile. Website Admin retains real cards and does not collapse into a text strip.

## Weather

Keep Sydney weather at the current information level: current temperature, condition, feels like, rain chance, high/low, and wind. The current Open-Meteo browser fetch may remain; failure is isolated.

## Needs Attention and Coming Up

Keep the already-defined behavior:

- Overdue and Today are mutually exclusive;
- future/undated attention signals are not mislabeled as due today;
- Life Admin Coming Up excludes items already shown in Overdue/Today;
- Birthdays horizon: 90 days;
- Life Admin horizon: 90 days;
- Trips horizon: 180 days;
- lists remain capped with navigation links.

Do not add additional generic widgets in v0.11.0. Morning Digest and planned workouts fill the meaningful UAT gaps.

## App launchers

Retain Dose & Scale, Parks, and Archive as iPhone-style launchers on desktop and mobile.

Use stable maintained assets, never runtime favicon scraping:

- Parks: its existing tree asset `park-favicon.svg` (deployed equivalent);
- Archive: its existing book app icon `app/icon.svg` (deployed equivalent);
- Dose & Scale: its maintained logo/icon asset appropriate for launcher presentation.

The icon is the dominant rounded-square visual; app name and availability are secondary. Failed icons fall back to the preston.ai app icon without breaking layout.

## Website Admin

Restore Website Admin as a visually substantial full-width section rather than the short strip from the first v0.11.0 UAT candidate.

Render one card per site/app with:

- app/site identity;
- Open Site action;
- GitHub action;
- Railway action where applicable.

Desktop: compact card row/grid inside the full-width section. Mobile: cards stack full width.

Website Admin remains below daily-operating content but should look intentional and useful.

## Product naming

Audit user-facing copy in preston.ai pages touched by this release. Where the product itself is referenced, use `preston.ai` exactly, lowercase.

Example: Calendar Settings says `Choose exactly which personal calendars preston.ai may use...`, not `Preston may use...`.

This applies to product branding, not a human person's name where one is genuinely intended.

## Freshness

Expose quiet freshness cues where relevant:

- Calendar: latest successful provider sync when available;
- Morning Digest: digest generation time;
- Dose & Scale context: source Garmin/context updated time and last successful preston.ai fetch.

Freshness is informational and should not become another prominent status widget.

## Failure isolation

- Dose & Scale fetch unavailable: preserve last successful cached context/digest, update stale/error metadata; if no cache exists, only Morning Digest and Planned Workouts degrade.
- Digest generation failure: only Morning Digest degrades.
- Calendar provider cache failure: provider calendar groups degrade; Planned Workouts may still render from fitness cache.
- Fitness cache failure: provider calendar groups still render.
- Life Admin/tasks failure: only Overdue, Today, and Life Admin Coming Up degrade.
- Birthday failure: only Birthdays degrade.
- Trip failure: only Trips degrade.
- Weather failure: only Weather degrades.
- App-status failure: launch links remain usable.
- App-icon failure: only that icon falls back.

The authenticated page shell renders whenever the core renderer can run.

## Privacy and security

- Dose & Scale integration is server-to-server only.
- Dedicated service bearer token only; never reuse/expose Dose & Scale Basic Auth credentials.
- Service token is stored only in server environment variables and never sent to browser HTML/JS.
- Dose & Scale endpoint returns a constrained contract, not full `app_state`.
- Personal data stays behind preston.ai authentication and owner-scoped RLS.
- Do not broaden Google Calendar OAuth scopes.
- Planned workouts are never written to Google/Apple.
- Planned workouts do not create preston.ai reminder rows.
- Noon/evening urgent behavior remains unchanged.

## Release/version boundary

- Keep feature version `v0.11.0`; this is a UAT revision of the same unreleased feature.
- Continue on `build/preston-ai-v0.11.0`.
- Dose & Scale requires a coordinated change for the service feed and eventual removal of its old Morning Digest UI.
- No production merge/deploy for either app without explicit approval after UAT.
- Replace the existing UAT candidate with a newly verified v0.11.0 candidate after implementation.

## Likely code boundaries

### preston.ai repo

Expected changes:

- `src/pages/home.js` — full-width Morning Digest, mobile-width corrections, Website Admin cards, correct launcher icons, freshness;
- `src/routes/site.js` — cached fitness/digest/planned-workout assembly;
- `src/domain/calendars.js` — planned-workout merging for dashboard/full month;
- `src/pages/calendar-view.js` — planned-workout rendering;
- `src/pages/calendars.js` and touched UI — `preston.ai` naming cleanup;
- `src/branding.js` — stable icon metadata;
- focused `src/data` / `src/domain` / `src/services` modules for fitness context and Morning Digest;
- `src/jobs/fitness-sync.js` (or equivalent focused job);
- authenticated fitness-refresh route;
- Supabase migration for `fitness_context_cache` and `morning_digests`;
- tests and CI syntax checks.

### Dose & Scale repo

Expected changes:

- constrained `GET /api/preston/daily-context` endpoint;
- dedicated bearer-token guard mounted independently of browser Basic Auth;
- isolated normalized contract builder;
- tests for auth, data minimization, digest inputs, and planned workouts;
- after preston.ai UAT parity acceptance, remove/inactivate old Morning Digest rendering/generation so there is one owner.

## Test requirements

### Dose & Scale service contract

- bearer service token required;
- browser Basic Auth alone does not authorize the service endpoint;
- full app state/unrelated private fields are excluded;
- required recovery/baseline/weight/training/phase/intervention fields are normalized;
- all currently stored planned workouts required by calendar views are included;
- completion state is only asserted from reliable matching;
- contract/source timestamps are present.

### Cache and refresh

- successful fetch replaces cache payload and clears last error;
- failed fetch preserves last good payload and records attempt/error metadata;
- dashboard does not call Dose & Scale directly;
- scheduled job uses Sydney gating for 07:15;
- manual refresh is authenticated and server-side only;
- service token never appears in rendered output.

### Morning Digest migration

- representative existing Dose & Scale digest fixtures produce equivalent status/headline/substantive recommendation content in preston.ai;
- digest persists by Sydney date;
- unchanged source does not regenerate unnecessarily;
- changed source can regenerate;
- stale last-good context remains renderable after source failure;
- Dose & Scale no longer renders a competing Morning Digest after migration completion.

### Planned workouts

- today's workout is shown even when completed;
- tomorrow's workout is shown;
- planned-workout dashboard window ignores the provider-event 09:00 cutoff;
- full month includes cached planned workouts in visible month;
- planned workouts never become `calendar_events` rows;
- planned workouts never become preston.ai reminder rows.

### Existing calendar behavior

Retain tests for Sydney provider-event window, Personal/Holidays/Reminders grouping, imported reminder visibility, full-month overlap/navigation, privacy, and no provider calls during page rendering.

### UI/UAT regressions

- Morning Digest precedes and spans wider than the three-column dashboard;
- mobile dashboard/digest/admin cards use full available width semantics;
- Parks launcher uses tree asset metadata;
- Archive launcher uses book icon metadata;
- Website Admin renders card structure with Site/GitHub/Railway actions on desktop and mobile;
- product copy uses `preston.ai`, not `Preston`, in affected UI;
- freshness labels render when timestamps exist and degrade quietly when absent.

### Reminder isolation

Retain regression coverage proving fitness/planned-workout integration does not alter existing Morning Summary reminder-row semantics or noon/evening urgent checks.

## Out of scope

- editing/rescheduling planned workouts from preston.ai;
- writing planned workouts into Google/iCloud;
- new calendar/Life Admin-driven health recommendations during this migration pass;
- email/news/finance/general-notes widgets;
- creating/completing calendar reminders from preston.ai;
- changing Life Admin categories;
- changing 07:05 Morning Summary or noon/evening urgent behavior;
- replacing the server-rendered architecture with a SPA.

## Success criteria

v0.11.0 is ready for release when:

- preston.ai is the sole owner/presenter of the Morning Digest;
- the digest is full-width, native to preston.ai, and substantively equivalent to the existing Dose & Scale logic;
- normal dashboard rendering uses the local fitness cache and remains available when Dose & Scale is temporarily down;
- today's and tomorrow's planned workouts appear as day context, including today's completed workout;
- planned workouts appear in the full preston.ai month calendar without provider-calendar writes;
- Parks uses the tree icon and Archive uses the book icon;
- Website Admin regains useful card structure on desktop/mobile;
- all mobile dashboard/digest/admin cards occupy full available width;
- product copy consistently says `preston.ai` where it means the product;
- source freshness is visible without clutter;
- all domains retain independent failure behavior;
- the complete automated regression suite and UAT pass before production promotion.