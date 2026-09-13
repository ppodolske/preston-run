# preston.ai v0.9.0 — Daily Summary + Web Push Foundation

**Date:** 2026-09-13  
**Status:** Approved design  
**Repository:** `ppodolske/preston-run`  
**Base release:** v0.8.0  
**Target release:** v0.9.0

## 1. Purpose

v0.9.0 introduces the notification foundation for preston.ai without turning the portal into an always-interrupting reminder system.

The core behavior is:

- one routine daily summary at **7:05 AM Australia/Sydney**
- silent urgent-only evaluations at **12:00 PM** and **6:00 PM Australia/Sydney**
- no continuous polling
- no calendar integration in v0.9.0
- no work-calendar access
- PWA Web Push is the only outbound notification channel

The 7:05 AM timing intentionally follows the planned 7:00 AM Garmin / Dose & Scale synchronization so later unified digest work can reuse the same morning notification slot.

Personal Google Calendar and Apple Calendar are deferred to v0.10.0 and will be read-only at first. Work calendars remain explicitly out of scope.

## 2. Design principles

1. **Low interruption by default.** Routine personal admin information should wait for the next morning summary.
2. **Urgent means urgent.** Noon and 6:00 PM checks should normally send nothing.
3. **One logical reminder across devices.** Delivery fans out, but acknowledgement and snooze state are shared.
4. **Defaults first, overrides second.** Global reminder defaults should cover most records; individual items can override them.
5. **Private by default.** No reminder, subscription, delivery, or personal record data may be exposed before authentication.
6. **Auditable delivery.** Push attempts and user actions must have useful history without duplicating unnecessary personal content.
7. **No work calendar.** preston.ai must not connect to or ingest the user's work calendar.

## 3. Notification schedule

### 3.1 Morning summary

At **7:05 AM Australia/Sydney**, preston.ai evaluates reminder-capable records and sends one routine summary push when there is relevant content.

The summary may include:

- birthdays
- Life Admin items
- renewals / expiries
- bills / deadlines
- appointments or events stored directly in preston.ai
- tasks
- upcoming trips
- items requiring attention

The morning push deep-links to the authenticated preston.ai home page.

If there is nothing worth surfacing, the system may send no push rather than an empty notification.

### 3.2 Noon and 6:00 PM urgent checks

At **12:00 PM** and **6:00 PM Australia/Sydney**, preston.ai performs a silent evaluation.

A push is sent only for genuinely urgent conditions, such as:

- an item explicitly marked urgent that now requires action
- a same-day urgent obligation not already acknowledged
- future Gmail-derived high-confidence material travel cancellation or major booking change
- another condition explicitly classified as urgent by future approved logic

Normal-priority overdue tasks, ordinary reminders getting closer to their due date, birthdays, routine renewals, and other non-urgent items wait until the next 7:05 AM summary.

## 4. Reminder defaults and overrides

Reminder schedules are rule-driven.

### 4.1 Initial global defaults

- **Birthdays:** 30, 14, 7, and 1 day before
- **Renewals / expiries:** 60, 30, 14, 7, and 1 day before
- **Bills / deadlines:** 14, 7, and 3 days before, plus due day
- **Appointments / events:** 7 days, 1 day, and day-of
- **Trips:** 14, 7, and 1 day before

Because v0.9.0 is summary-oriented, these offsets determine which morning summaries an item appears in rather than creating throughout-the-day push times.

### 4.2 Precedence

Reminder policy precedence is:

`global defaults -> per-item override -> generated reminder occurrences`

An item is either:

- **Inherited** — uses the current global default for its type
- **Custom** — uses an item-specific schedule until switched back to inherited mode

### 4.3 Changing global defaults

When a global default changes:

- future, unsent reminder occurrences for inheriting items are recalculated immediately
- individually overridden items are unchanged
- already-sent reminders are unchanged
- acknowledged reminders are unchanged
- snoozed reminders are unchanged

This keeps defaults useful for existing data without rewriting user decisions or notification history.

## 5. Quiet hours

Default quiet hours are **10:00 PM–7:00 AM Australia/Sydney**.

In v0.9.0, routine scheduled evaluations already occur outside that window, but quiet hours remain a first-class setting for future notification types and must still be enforced by shared notification logic.

High-priority travel bypass behavior is not needed until the relevant Gmail/travel automation release and should remain configurable when introduced.

## 6. Push enrollment and device management

Push permission must never be requested automatically on page load.

The authenticated Settings / Notifications UI provides an explicit **Enable notifications on this device** action. Only after the user invokes it should the browser permission prompt appear.

On successful enrollment:

- the browser/device receives a push subscription
- preston.ai stores the subscription securely for the authenticated owner
- the user can assign a friendly label such as `iPhone` or `MacBook`
- each device can be independently enabled or disabled

Multiple devices are supported.

A reminder is delivered to **all enabled devices**. Delivery outcome is tracked separately per device, but the logical reminder has one shared state across devices.

## 7. Acknowledgement and snooze

Acknowledgement and completion are different concepts.

- **Acknowledge** means the user has seen the reminder.
- **Complete** changes the underlying Life Admin item or task when applicable.
- **Snooze** changes reminder timing only and never changes the underlying due date.

Initial snooze options:

- tomorrow
- 3 days
- 1 week
- custom date

Acknowledging or snoozing from one device updates the reminder state everywhere.

## 8. Data model

v0.9.0 introduces focused private tables rather than embedding complex notification state into unrelated domain rows.

### 8.1 `reminder_settings`

Stores owner-scoped global reminder configuration, including:

- user_id
- reminder-class defaults
- quiet-hours start/end
- timezone
- morning summary time
- noon urgent-check enablement
- evening urgent-check enablement
- timestamps

Default timezone: `Australia/Sydney`  
Default morning summary: `07:05`  
Default urgent checks: `12:00`, `18:00`

### 8.2 `reminder_overrides`

Stores per-entity custom schedules:

- id
- user_id
- entity_type
- entity_id
- override mode / offsets
- enabled flag
- timestamps

A unique owner/entity constraint prevents duplicate active override records for the same target.

### 8.3 `reminders`

Stores logical reminder occurrences and state:

- id
- user_id
- entity_type
- entity_id
- reminder_class
- occurrence_key
- trigger_date / effective trigger time
- status
- acknowledged_at
- snoozed_until
- first_sent_at
- last_sent_at
- deep_link
- timestamps

The occurrence key must be stable enough to prevent duplicate reminder creation for the same entity/rule/target occurrence.

### 8.4 `push_subscriptions`

Stores Web Push subscriptions:

- id
- user_id
- endpoint
- push key material
- device_label
- active
- last_used_at
- failure metadata
- timestamps

Subscription secrets are private data and must not be exposed in rendered HTML, logs, or public assets.

### 8.5 `notification_deliveries`

Stores per-device delivery attempts:

- id
- user_id
- reminder_id
- push_subscription_id
- attempted_at
- delivered_at nullable
- status
- error_category nullable
- retry_count
- timestamps

Do not duplicate verbose personal notification payloads when references to the reminder are sufficient.

## 9. Reminder engine

The reminder engine is server-side and testable independently from Railway scheduling.

### 9.1 Scheduled entry points

Railway schedules three executions in Australia/Sydney semantics:

- 07:05 — morning summary
- 12:00 — urgent-only evaluation
- 18:00 — urgent-only evaluation

Implementation may use UTC cron expressions or separate Railway cron services/jobs as required, but application logic must interpret scheduling in the configured profile timezone and remain correct across daylight-saving transitions.

### 9.2 Morning flow

```text
07:05 scheduled execution
  -> load owner reminder settings
  -> evaluate reminder-capable records
  -> apply global defaults / per-item overrides
  -> materialize or refresh eligible reminder occurrences
  -> exclude acknowledged / ineligible / duplicate occurrences
  -> build one morning summary
  -> fan out to enabled push subscriptions
  -> record one delivery attempt per device
```

### 9.3 Urgent-check flow

```text
12:00 or 18:00 scheduled execution
  -> evaluate urgent conditions only
  -> exclude acknowledged / duplicate / non-urgent items
  -> if none: exit silently
  -> if any: build urgent push
  -> fan out to enabled subscriptions
  -> record delivery attempts
```

## 10. Deduplication

Reminder generation and push delivery must be idempotent.

A logical occurrence key should include enough stable information to identify the same reminder occurrence across repeated evaluations, for example:

`user_id + entity_type + entity_id + reminder_rule + target_date`

Repeated scheduler runs must not produce duplicate logical reminders or duplicate successful device deliveries for the same occurrence.

Snoozing changes the effective trigger state of the same logical reminder rather than cloning the underlying entity.

## 11. Push failure handling

A push failure does not cancel the reminder.

- transient delivery errors remain retryable
- permanent subscription errors deactivate only that device subscription
- the logical reminder remains active for other devices
- all attempts are written to notification history

Because v0.9.0 uses only three scheduled evaluations per day, retry behavior should remain simple. A transient morning-summary failure may be retried during the same execution when safe or at the next scheduled evaluation if still relevant. The implementation does not need a generalized high-frequency job queue.

## 12. UI

The authenticated UI adds a Notifications / Settings area that supports:

- enable notifications on this device
- label current device
- list registered devices
- enable / disable individual devices
- edit global reminder defaults
- edit quiet hours
- display current timezone and scheduled summary/check times
- view useful notification history

Reminder-capable entity forms gain a reminder section with:

- inherit global defaults
- custom reminder schedule
- restore defaults

The UI must make the difference between reminder acknowledgement and underlying item completion clear.

## 13. Security

All v0.9.0 tables are private and owner-scoped.

Required controls:

- RLS enabled on every new private table
- authenticated owner-only CRUD policies
- no anon grants
- explicit user_id filters in server-side data access in addition to RLS
- same-origin validation on state-changing routes
- subscription endpoints and key material never exposed in public markup or logs
- authenticated pages remain `private, no-store`
- no service-role key in the browser or public runtime configuration

## 14. Testing

The release requires automated coverage for:

- reminder default validation
- per-item override precedence
- global-default recalculation behavior
- birthday / renewal / bill / appointment / trip inclusion dates
- Australia/Sydney date handling and DST boundaries
- 07:05 morning evaluation
- noon / 18:00 urgent-only behavior
- normal-priority overdue tasks not producing urgent pushes
- occurrence deduplication
- shared acknowledgement / snooze state across device deliveries
- push subscription ownership
- permanent vs transient delivery failure behavior
- unauthenticated pages containing no notification data
- RLS / grants / migration contract
- release version metadata at v0.9.0

Push transport itself should be abstracted behind a testable adapter so most tests do not require an external push service.

## 15. Explicit non-goals

v0.9.0 does **not** include:

- Google Calendar integration
- Apple Calendar integration
- work calendar integration
- Gmail OAuth or Gmail scanning
- continuous reminder polling
- minute-by-minute appointment alerts
- email notifications
- SMS notifications
- calendar event creation or editing
- generalized job queues
- Dose & Scale data aggregation into the push payload yet

## 16. Roadmap handoff

After v0.9.0:

- **v0.10.0:** read-only personal Google Calendar + Apple Calendar connections and summary integration; work calendars explicitly excluded
- **v0.11.0:** Gmail OAuth + manual scan
- **v0.12.0:** Gmail classification, matching, automatic updates, review inbox
- **v0.13.0:** scheduled Gmail sweep + trip intelligence
- **v0.14.0:** unified Morning Digest including Dose & Scale / Garmin summary data

This ordering proves notification delivery and external-source aggregation incrementally before adding Gmail inference complexity.

## 17. Exit condition

v0.9.0 is complete when:

- the owner can explicitly enroll one or more devices for Web Push
- reminder defaults are editable globally
- individual supported records can override or inherit those defaults
- one routine daily summary can be generated and pushed at 07:05 Sydney time
- noon and 18:00 evaluations remain silent unless a qualifying urgent item exists
- acknowledgement and snooze state is shared across devices
- delivery history is available
- failed / invalid subscriptions are handled safely
- all new private data is owner-scoped and RLS protected
- automated tests and release verification are green
