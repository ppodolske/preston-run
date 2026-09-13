# preston.ai v0.10.0 — Personal Calendars Design

## Status

Approved architectural design for v0.10.0. Implementation must not begin until this written spec is reviewed and approved, then converted into a detailed implementation plan.

## Goal

Add read-only personal calendar ingestion to preston.ai so selected personal Google Calendar and Apple/iCloud Calendar events can feed the existing 07:05 Australia/Sydney Morning Summary.

v0.10.0 supports exactly one connected Google Calendar account and one connected Apple/iCloud Calendar account. Each connected account may expose multiple calendars, and every calendar is opt-in: nothing is selected by default.

Work calendars are explicitly excluded. The product must never infer that a visible/shared calendar is personal merely because it is accessible from a personal account; only calendars explicitly selected by the owner are eligible for sync or digest inclusion.

## Non-goals

v0.10.0 does not:

- write, create, edit, delete, accept, decline, or otherwise mutate external calendar events;
- expose calendar events on the authenticated home page;
- use calendar events in the noon or 18:00 urgent checks;
- create Preston reminder rows from calendar events;
- sync continuously or poll throughout the day;
- support more than one Google Calendar account or more than one Apple/iCloud Calendar account;
- store attendee lists or full event descriptions/notes;
- integrate work calendars;
- add Gmail behavior;
- add calendar-to-trip or calendar-to-Life-Admin matching.

## Product behavior

### Connection model

Calendar authorization is separate from Preston login authentication.

The owner may connect:

1. one Google Calendar account using provider-native OAuth with read-only Calendar scopes; and
2. one Apple/iCloud Calendar account using server-side CalDAV authentication with an Apple app-specific password.

The Google grant must request only the scopes required to list calendars and read events. No calendar write scope is permitted.

The Apple connection flow asks for the Apple ID email and an app-specific password, never the normal Apple Account password. Credentials are validated server-side before a connection is considered active.

Disconnecting a provider deletes Preston's stored provider credential material and cached provider calendar/event data. It must not mutate the source Google or Apple account.

### Calendar selection

After a provider is connected, Preston lists the calendars visible to that account.

Every calendar begins unselected. The owner explicitly opts each calendar in or out through Settings → Calendars.

Only opted-in calendars may be synced into the normalized event store or used by the Morning Summary.

Turning a calendar off immediately makes it ineligible for the digest. Its cached event rows are removed during the next sync/cleanup cycle. Disconnecting the provider removes all cached rows for that provider immediately as part of disconnect cleanup.

### Sync window

For each selected calendar, Preston maintains a rolling local cache covering:

- 30 days in the past; and
- 12 months in the future.

The sync window is evaluated in a timezone-safe manner and must not depend on the server's physical region or local timezone.

### Scheduled and manual sync

A private background calendar-sync worker runs at approximately 06:55 Australia/Sydney each day.

The purpose of the 06:55 run is to refresh calendar data before the existing 07:05 Morning Summary.

Settings → Calendars also exposes a manual `Sync calendars` action. Manual sync uses the same provider adapters, normalization, validation, persistence, cleanup, and failure-handling pipeline as the scheduled worker. There is no separate manual-only sync implementation.

### Morning Summary inclusion window

Calendar events appear only in the 07:05 Morning Summary in v0.10.0.

The summary includes:

- all eligible events from the start of the current Sydney calendar day through 09:00 on the following Sydney calendar day; and
- all eligible all-day events on the following Sydney calendar day, regardless of their lack of a timed start.

Cancelled events are excluded.

Events declined by the owner are excluded when the provider supplies enough participation state to determine that reliably.

Tentative events remain included and are visibly marked as tentative.

Within the Calendar section of the digest:

1. current-day all-day events appear first;
2. current-day timed events follow in chronological order;
3. next-day all-day events appear in the next-day portion; and
4. next-day timed events through 09:00 follow chronologically.

Calendar data does not participate in the noon or 18:00 urgent-check logic in this release.

## Architecture

### Calendar subsystem

v0.10.0 introduces a dedicated calendar subsystem alongside the existing reminder subsystem.

External events remain external-source data. They do not become reminder records and do not inherit reminder-default or reminder-override behavior.

The subsystem consists of:

- provider adapters;
- connection and credential handling;
- calendar discovery and opt-in selection;
- normalized event persistence;
- scheduled/manual sync orchestration; and
- Morning Summary calendar querying/formatting.

### Provider adapter boundary

Both providers implement one internal contract so the rest of Preston does not depend on Google-specific or CalDAV-specific response shapes.

At minimum, the provider interface supports:

- validate/connect account;
- refresh/validate credentials as applicable;
- list visible calendars;
- fetch occurrences for a bounded date/time window;
- normalize provider-specific status, all-day, recurrence-instance, timezone, location, and external identifiers;
- expose provider event links where available; and
- disconnect/cleanup provider state.

Provider adapters should be small, isolated modules. Sync orchestration should not contain provider-specific HTTP response parsing.

### Google provider

Google Calendar uses provider-native OAuth and read-only Google Calendar APIs.

The Google calendar grant remains distinct from the existing Google login grant. A user being authenticated to Preston through Google does not imply Calendar authorization.

The implementation should use the narrowest available read-only scopes sufficient to:

- enumerate calendars visible to the connected Google account; and
- retrieve event occurrences from selected calendars.

Refresh-token handling remains server-side only.

### Apple/iCloud provider

Apple/iCloud Calendar uses CalDAV with an Apple app-specific password for v0.10.0.

The server validates the supplied credentials and discovers calendars through the CalDAV account. Provider-specific DAV discovery/report logic stays inside the Apple provider adapter.

If Apple later exposes a cleaner generally available authorization flow suitable for Preston, that can replace the credential mechanism in a future version without changing the normalized calendar/event interface.

## Data model

All new private data is owner-scoped and protected by Row Level Security.

### `calendar_connections`

One row per owner/provider connection.

Expected fields include:

- `id`;
- `user_id`;
- `provider` (`google` or `apple`);
- provider account identity/display metadata;
- encrypted credential payload or encrypted credential reference;
- `status`;
- `last_attempt_at`;
- `last_success_at`;
- sanitized `last_error`;
- `created_at`;
- `updated_at`.

A uniqueness constraint prevents more than one connection per owner/provider in v0.10.0.

No plaintext refresh token, access token, app-specific password, or equivalent secret may be returned by application data APIs.

### `calendar_sources`

Represents calendars discovered beneath a connection.

Expected fields include:

- `id`;
- `user_id`;
- `connection_id`;
- provider calendar ID/href;
- calendar display name;
- optional provider color/display metadata if useful to Settings;
- `selected` boolean, default `false`;
- provider read-only/visibility metadata if needed;
- `created_at`;
- `updated_at`.

Selection is explicit opt-in and defaults off.

### `calendar_events`

Stores the minimal normalized event/occurrence copy needed by Preston.

Expected fields include:

- `id`;
- `user_id`;
- `connection_id`;
- `calendar_source_id`;
- provider external event ID;
- provider occurrence/recurrence-instance identifier where applicable;
- title;
- start value;
- end value;
- all-day flag;
- timezone information sufficient to render correctly;
- location;
- normalized status;
- normalized owner response state when reliably available;
- recurrence/series identity sufficient for occurrence stability;
- provider external link when available;
- provider update/version marker if useful for incremental sync;
- `created_at`;
- `updated_at`.

The schema must support a stable uniqueness rule that prevents duplicate occurrences while allowing moved/exception recurring instances to update correctly.

The table must not store attendee lists or full descriptions/notes in v0.10.0.

## Credential protection

Provider secret material must be encrypted before persistence with a server-only encryption key.

The encryption key is stored only in privileged runtime configuration and is not present in browser-delivered configuration, static assets, public endpoints, logs, or source control.

Web/backend processes that perform account connection or token refresh and the calendar-sync worker may receive the encryption key. Other services should not receive it unless required.

Application logs must never contain OAuth refresh tokens, access tokens, Apple app-specific passwords, authorization headers, CalDAV credentials, encryption keys, or raw credential payloads.

Database access alone should not be sufficient to recover provider credential material without the separate runtime encryption key.

## Sync semantics

### Independence between providers

Google and Apple sync independently.

A failure in one provider must not prevent the other provider from completing successfully.

The orchestrator records attempts and results per connection.

### Incremental vs bounded refresh

The implementation may use provider-supported incremental synchronization when it is reliable, but correctness is more important than optimization.

The normalized local cache must always converge on the provider's source-of-truth state inside the active 30-day-back/12-month-forward window.

### Recurring events

Preston stores normalized event occurrences for the active sync window rather than re-implementing recurrence expansion itself.

The provider remains authoritative for recurrence exceptions, moved instances, cancellations, and deletions.

### Cleanup

Sync must remove or invalidate normalized occurrences that:

- are no longer returned by the authoritative provider inside the current window;
- belong to a calendar that has been deselected;
- belong to a disconnected provider; or
- have fallen outside the retained rolling window.

Cleanup must be owner-scoped and provider/calendar-scoped so one source cannot delete another source's data.

## Failure and stale-data behavior

Each connection records:

- most recent sync attempt;
- most recent successful sync; and
- a sanitized last error suitable for showing in Settings.

The 07:05 Morning Summary must not fail wholesale because one or both calendar providers failed at 06:55.

If previously synced calendar data exists, the digest may use it while it remains acceptably fresh.

Calendar data older than 24 hours since the connection's last successful sync is considered stale for digest purposes. If calendar data would otherwise be included but its source is stale beyond 24 hours, the digest should avoid presenting it as current and include a concise `Calendar sync needs attention` note instead.

Provider errors shown in Settings must be useful enough to distinguish disconnected/expired credentials from temporary network/provider failures without exposing secret material.

## Settings experience

Add an authenticated Settings → Calendars page/section.

Each provider card shows:

- disconnected/connected state;
- connected account identity;
- last successful sync;
- current error/attention state when applicable;
- connect or disconnect action;
- `Sync calendars` action while connected; and
- discovered calendars with explicit opt-in toggles.

No calendar toggle is enabled automatically.

The UI must make clear that only selected calendars are imported into Preston.

The Apple card must explicitly explain that Preston requires an Apple app-specific password, not the normal Apple Account password.

## Security and privacy requirements

1. All new private tables have RLS enabled.
2. Authenticated owner CRUD policies are scoped to `auth.uid() = user_id` or the project's established equivalent ownership pattern.
3. No anonymous grants exist for calendar private tables.
4. Composite ownership foreign keys should be used where they materially prevent cross-owner reference mistakes, following the existing v0.8/v0.9 pattern.
5. All server-side data queries include explicit owner filters in addition to RLS.
6. Calendar credentials/tokens never reach client-side JavaScript.
7. Calendar private data never appears in anonymous HTML, public static assets, public metadata, or cacheable unauthenticated responses.
8. Calendar authorization remains separate from Google login authentication.
9. Work calendars are never selected automatically or inferred from account membership.
10. Provider connection/disconnection state changes require an authenticated owner session and normal same-origin/CSRF protections used elsewhere in the app.

## Background runtime

Add one private calendar-sync background worker.

The scheduler must account for Australia/Sydney daylight-saving changes using the same dual-UTC-slot + runtime Sydney-time gate strategy used for the v0.9 reminder jobs, or an equivalently tested strategy that guarantees one effective 06:55 Sydney run per day.

The worker receives only the credentials needed for background calendar sync, including:

- Supabase service-role access;
- provider OAuth/client configuration needed for Google token refresh/API access;
- server-side credential-encryption key; and
- any Apple/CalDAV runtime configuration that is not connection-specific encrypted data.

The public web service must not receive Supabase service-role credentials.

## Morning Summary integration

The existing Morning Summary gains a calendar reader/formatter that consumes normalized local event rows only. It does not call Google or Apple directly during the 07:05 summary job.

This separation ensures:

- provider latency cannot block the digest;
- the 06:55 sync can fail independently;
- provider adapters remain isolated from notification formatting; and
- summary tests can use deterministic normalized fixtures.

The Calendar section is omitted when there are no eligible events and no stale-sync attention condition.

## Testing requirements

### Provider adapters

Use deterministic fixtures/mocks for Google and Apple/CalDAV provider responses. Tests cover:

- account validation;
- calendar discovery;
- bounded event retrieval;
- provider pagination where applicable;
- token refresh/credential failure behavior;
- all-day events;
- timed events;
- recurrence instances/exceptions;
- cancellations/deletions;
- tentative state; and
- owner-declined state where reliably available.

No CI test depends on live Google or Apple accounts.

### Normalization and timezone behavior

Tests cover:

- event timestamps in non-Sydney timezones;
- all-day date semantics;
- Sydney DST transitions;
- events crossing midnight;
- events at exactly 09:00 tomorrow;
- events immediately after 09:00 tomorrow;
- next-day all-day inclusion;
- cancelled exclusion;
- declined exclusion;
- tentative labeling; and
- stable recurrence occurrence identity.

The inclusion boundary is inclusive through exactly 09:00:00 Australia/Sydney on the next day for timed events.

### Persistence and security

Tests verify:

- RLS enabled on all new tables;
- owner-only CRUD policies;
- no anonymous grants;
- explicit owner filters in application data access;
- one connection per provider per owner;
- default-off calendar selections;
- deselection cleanup;
- disconnect cleanup;
- rolling-window cleanup;
- duplicate prevention/upsert behavior;
- encrypted credential round trip;
- failure on invalid encryption key/ciphertext; and
- no plaintext credential leakage in serialized responses or logs.

### Sync orchestration

Tests verify:

- Google and Apple failures are isolated;
- successful provider sync persists even when the other provider fails;
- `last_attempt_at`, `last_success_at`, and sanitized error state update correctly;
- manual sync and scheduled sync share one pipeline;
- stale data rules are enforced at 24 hours; and
- the 06:55 Sydney gate runs exactly once across DST dual-UTC schedule slots.

### Morning Summary integration

Tests verify:

- normalized calendar rows feed the 07:05 summary;
- no direct provider call is made from the summary pipeline;
- ordering matches the approved all-day/timed chronology;
- the exact today-through-09:00-tomorrow window;
- tomorrow all-day inclusion;
- stale-source warning behavior;
- calendar section omission when empty;
- no noon/18:00 calendar alert path exists; and
- calendar events do not create or mutate reminder records.

## UAT criteria

v0.10.0 is not release-ready until all of the following have been proven in UAT with the owner's real personal accounts:

1. Connect one personal Google Calendar account through a distinct Calendar authorization flow.
2. Discover its calendars and confirm every calendar starts unselected.
3. Select only approved personal Google calendars and successfully sync them.
4. Confirm an unselected Google calendar never appears in normalized event storage used by the digest.
5. Connect one Apple/iCloud Calendar account using an app-specific password.
6. Discover its calendars and confirm every calendar starts unselected.
7. Select only approved personal Apple calendars and successfully sync them.
8. Confirm an unselected Apple calendar never appears in normalized event storage used by the digest.
9. Confirm manual `Sync calendars` refreshes both providers through the production-equivalent pipeline.
10. Confirm the scheduled 06:55 Sydney UAT sync runs successfully.
11. Confirm a 07:05 UAT Morning Summary includes the correct selected-calendar events through 09:00 the following day plus following-day all-day events.
12. Confirm cancelled and declined events are absent and tentative events are marked.
13. Confirm one-provider failure does not prevent the other provider from syncing or the digest from running.
14. Confirm stale-data behavior after simulated/controlled last-success age greater than 24 hours.
15. Disconnect and reconnect Google once, proving credential/cache cleanup and recovery.
16. Disconnect and reconnect Apple once, proving credential/cache cleanup and recovery.
17. Reconfirm anonymous/private-data regression tests before release.
18. Reconfirm production web services do not receive Supabase service-role credentials.

## Release gate

v0.10.0 follows the established release discipline:

- implementation occurs on `build/preston-ai-v0.10.0`;
- package version, visible version marker, tests, schema, and runtime configuration advance together;
- exact-head CI must pass;
- Supabase migrations/RLS/grants must be verified live;
- UAT web and background worker deployments must be healthy;
- real-account UAT above must pass;
- production remains on v0.9.0 until explicit release approval; and
- no merge to `main` or production release occurs without explicit owner approval after UAT.

## Future-compatible boundaries

The normalized calendar subsystem should make later releases possible without changing provider integrations unnecessarily. Potential future uses include homepage upcoming-event views, trip/event matching, event-driven urgent intelligence, and richer digest preparation. None of those behaviors are included in v0.10.0.
