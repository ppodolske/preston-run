# preston.ai v0.12 Gmail Foundation Design

**Date:** 2026-09-13  
**Status:** Approved design baseline for planning  
**Repository:** `ppodolske/preston-run`  
**Base branch:** `build/preston-ai-v0.11.0`  
**Implementation branch:** `build/preston-ai-v0.12.0`  
**Product name:** `preston.ai`  
**Release:** `v0.12 Gmail Foundation`

## 1. Purpose

`v0.12 Gmail Foundation` adds the first Gmail-backed ingestion subsystem to `preston.ai`. It connects one Gmail account, scans eligible received mail read-only, stores normalized evidence rather than full messages, and creates trip-first Life Admin records with review and audit safeguards.

This release is deliberately foundational. It proves ingestion correctness, source/evidence persistence, trip extraction, manual-authority protection, scan history, and the `Scan Gmail now` control before later releases add broader classification and automation.

## 2. Release boundaries

### 2.1 v0.12 Gmail Foundation

Included:

- One connected Gmail account only.
- Read-only Gmail access.
- Gmail messages and native-text PDF attachments may be read for processing.
- Explicit OAuth connection followed by separate explicit `Scan Gmail now` first scan.
- First scan looks back 12 months and runs newest-to-oldest.
- Incremental scans process eligible received mail since the last successful checkpoint.
- Scanning includes all received mail, including archived messages.
- Scanning excludes Spam, Trash, Drafts, and Sent Mail.
- Checkpoints advance only after successful processing boundaries.
- Idempotency avoids duplicate source records, extracted facts, Life Admin entities, and review items.
- Trip-first extraction for structured records.
- Completed-trip reconstruction as quiet trip history.
- Generic Gmail source records for likely future Life Admin categories.
- Native-text PDF processing only.
- Action Needed review for uncertainty, conflicts, weak matches, and material unreadable sources.
- Lightweight Gmail integration page with connection state, `Scan Gmail now`, scan status, scan summary, and recent scan history.
- Source links and structured extracted fields in review.
- No full email bodies or attachment copies persisted as source of truth.
- Immutable/versioned extracted facts.
- Manual preston.ai edits are authoritative.
- Automatic changes have activity history and undo/correction path.

Excluded:

- Background scheduled Gmail scans.
- Stale-on-open catch-up scans.
- Immediate urgent alerts.
- Broad non-trip Life Admin classification beyond generic source capture.
- Gmail write operations: label, archive, delete, mark read, draft, send.
- Google/Apple calendar writes.
- OCR/image-only PDF support unless UAT proves it necessary.
- A Gmail mirror or searchable email client inside `preston.ai`.

### 2.2 v0.13 Gmail Intelligence

Future release. Adds broader Life Admin classification from the v0.12 source/evidence foundation: bills, payments, subscriptions, renewals, appointments/reservations, important documents, deliveries/orders with meaningful dates/actions, and deadlines/required actions. Adds historical backfill across already-scanned 12-month sources when new categories are introduced.

### 2.3 v0.14 Gmail Automation

Future release. Adds scheduled pre-notification scans before the existing 7:00 AM, noon, and 6:00 PM preston.ai notification windows, stale-on-open catch-up scans, retry/degraded connection state behavior, digest integration, and immediate alerts only for high-confidence time-critical disruptions.

## 3. Core architectural principle

External integrations do not directly modify the user experience. They contribute source records and evidence. `preston.ai` decides what becomes canonical knowledge, what needs review, what changes current Life Admin state, and what appears in dashboard, Action Needed, trips, calendar views, and notifications.

Gmail is therefore implemented as an ingestion source feeding the preston.ai source/evidence/knowledge pipeline, not as a special-purpose email client.

## 4. Gmail access and scope

- Gmail authorization is separate from Google sign-in.
- Only one Gmail account can be connected in these releases.
- The connected account identity must be recorded and displayed.
- Reconnecting the same account resumes from the last successful checkpoint.
- Connecting a different Gmail account later must not silently reuse the prior checkpoint; it requires explicit future handling.
- Gmail access is read-only.
- The app may fetch eligible message metadata, message body content required for extraction, and native-text PDF attachments for processing.
- The app must not persist full message bodies or attachment binaries.
- Source links and Gmail IDs are primary evidence references.

## 5. Eligible mail

Eligible:

- Received Gmail messages from the connected account.
- Archived received mail.
- Relevant native-text PDF attachments attached to eligible messages.

Excluded:

- Spam.
- Trash.
- Drafts.
- Sent Mail.
- Gmail write-side state changes.

The first scan covers 12 months from the scan start timestamp. After the first scan completes, incremental scans process eligible mail received since the last successful scan checkpoint.

## 6. Source/evidence model

`v0.12` introduces a normalized ingestion model for Gmail:

### 6.1 Gmail source record

One record per eligible message, plus attachment-level processing details when applicable.

Required fields:

- `user_id`
- `source_system = 'gmail'`
- `external_account_id`
- `gmail_message_id`
- `gmail_thread_id`
- `sender`
- `subject`
- `received_at`
- `labels` or normalized eligibility flags sufficient for audit
- `classification_hint`
- `processing_status`
- `processing_reason`
- `source_link`
- `scanner_version`
- timestamps

Uniqueness must prevent duplicate source records for the same user/account/message.

### 6.2 Attachment source record

PDF attachments are tracked without storing the file.

Required fields:

- parent source record id
- `gmail_attachment_id`
- `filename`
- `mime_type`
- `processing_status`
- `processing_reason`
- `source_link`
- timestamps

### 6.3 Extracted facts

Facts are immutable/versioned evidence records. Reprocessing creates newer fact versions rather than mutating older evidence away.

Required fields:

- `user_id`
- `source_record_id`
- `attachment_record_id` nullable
- `fact_type`
- `fact_value` JSONB
- `fact_schema_version`
- `parser_version`
- confidence dimensions: classification, extraction, entity match, urgency where applicable
- `is_current_candidate`
- `supersedes_fact_id` nullable
- timestamps

### 6.4 Life Admin changes

A Gmail source may create or update trips/bookings/tasks only through the preston.ai decision layer. Every automatic create/update writes an activity entry with old value, new value, source reference, confidence, parser/scanner version, and undo metadata.

## 7. Trip-first extraction

`v0.12` structured extraction targets trips first.

Covered source types:

- flights
- accommodation
- car hire
- trains
- ferries
- cruises
- tours
- ticketed events
- booking changes
- cancellations
- refunds
- check-in reminders
- receipts clearly linked to a trip

The first 12-month scan builds both upcoming and completed trips. Completed trips are reconstructed as quiet history, including bookings, itinerary, changes, cancellations, and final state. Completed trips must not create noisy overdue tasks or retrospective reminders.

## 8. Matching and conflicts

Trip matching uses ranked signals:

- Exact booking/reference number: automatic match.
- Same Gmail thread as existing source: automatic match.
- Provider plus dates/location: usually automatic when details line up.
- Trip window overlap: useful only with supporting evidence.
- Traveller/name signals: supporting only.

Strong matches may update automatically. Weak matches go to Action Needed.

Manual preston.ai edits are authoritative. Gmail must never silently overwrite a user-edited field. A conflict review item shows current preston.ai value, Gmail value, source link, and actions: keep mine, accept Gmail value, edit manually, ignore source.

Later authoritative provider evidence can supersede earlier Gmail provider evidence, but cannot supersede manual preston.ai edits.

## 9. Review behavior

Action Needed is for decisions, not raw email findings. Review items should be grouped by the affected Life Admin object where possible.

Review types:

- Confirm new item.
- Resolve conflict.
- Confirm match.
- Review unreadable source.
- Fix Gmail connection, only after repeated failures in v0.14.

Review items do not block checkpoint progress. High-confidence non-conflicting creates/updates happen automatically. Uncertain items go to Action Needed.

The UI shows source links plus extracted fields only. Generated previews are deferred unless review feels too blind during UAT.

## 10. First scan experience

Connection and first scan are separate steps.

Before first scan, the Gmail integration page states:

- one Gmail account
- read-only access
- received mail only
- includes archived mail
- excludes Spam, Trash, Drafts, Sent Mail
- 12-month lookback
- native-text PDF processing only

The first scan runs newest-to-oldest. It shows broad progress counts only: eligible messages discovered, messages processed, relevant sources found, trips/tasks/records created, Action Needed items created, PDFs skipped/unreadable, and errors.

The browser does not need to remain open. The scan is resumable and idempotent. If interrupted, successfully processed source records remain, setup stays incomplete, and restart resumes without duplicates.

Initial scan completion means every eligible message in the 12-month window has been processed, ignored, skipped with reason, queued for retry, or queued for review; relevant native-text PDFs have been processed or marked with reason; facts and safe changes have been persisted; review items have been created; and a stable incremental checkpoint has been established.

## 11. Retry behavior

Automatic retries are used for transient failures: Gmail API/network timeout, temporary Google service errors, rate limiting, transient download failures, and internal processing interruptions.

Manual retry is used for persistent content problems: password-protected PDFs, corrupt attachments, unsupported attachment formats, permanently unavailable sources, or sources requiring a future parser capability.

## 12. Undo and correction

Every automatic Gmail-created or Gmail-updated Life Admin change has an activity entry. `Undo Gmail update` restores the prior preston.ai value and makes that field manually authoritative going forward. Undo does not delete the underlying Gmail evidence; it marks that evidence rejected for that field/entity unless manually reconsidered later.

If a Gmail-created record is undone and has no manual edits or non-Gmail provenance, it may be removed or archived as rejected. If it has since been manually edited, undo becomes targeted field correction.

## 13. Privacy and retention

- Links and IDs are the primary evidence mechanism.
- Do not store full email bodies or attachment copies as source of truth.
- Keep normalized source metadata and source IDs while related Life Admin records/audit history exists.
- Keep immutable extracted facts and parser/version history.
- Refetch original Gmail content only when reprocessing requires it and authorization remains available.
- If a Gmail message or attachment is no longer retrievable, keep existing structured facts/audit trail and mark the source unavailable.
- Disconnect Gmail stops future ingestion and preserves existing data.
- Purge Gmail-derived data is a separate explicit destructive operation.
- Purge is provenance-aware: remove Gmail-only records/evidence where safe, preserve manually adopted/mixed records, and review ambiguous mixed cases.

## 14. Calendar and task boundaries

Gmail extraction may create/update preston.ai Life Admin date/time fields and may show those dates in preston.ai dashboard/calendar views. `v0.12-v0.14` must not write to Google Calendar or Apple Calendar.

High-confidence Gmail actions may create preston.ai Life Admin tasks. Completed-trip backfills must not create historical overdue tasks. Task deduplication follows one-obligation/multiple-source behavior for repeated reminders, invoices, and confirmations.

## 15. Versioning and confidence

Store numeric confidence internally. UI shows plain labels and reasons, not fake-precise scores.

Separate confidence dimensions:

- classification confidence
- extraction confidence
- entity match confidence
- urgency confidence

Every scan run records `scanner_version`. Every extractor output records `parser_version`. Every fact records `fact_schema_version`. Automatic Life Admin changes record the rule/version that caused them. Parser/scanner details are hidden by default but available in expanded audit/history details.

## 16. Future v0.14 automation policy

Scheduled Gmail scans happen before the existing 7:00 AM, noon, and 6:00 PM notification cycles. They include retry room and do not block notifications. Notifications are generated from persisted preston.ai state, never by live Gmail calls.

Default Gmail-derived changes wait for the next normal notification window. Immediate alerts are allowed only when classification, extraction, match, and urgency confidence are high and the issue is genuinely time-critical, such as a same-day or imminent travel cancellation where waiting would materially reduce options.

## 17. Success criteria for v0.12

- A user can connect one Gmail account without triggering an automatic bulk scan.
- A user can explicitly start a 12-month read-only scan.
- The scan covers received and archived mail while excluding Spam, Trash, Drafts, and Sent.
- The scan processes newest-to-oldest, is resumable, idempotent, and checkpoint-safe.
- Trips are created/reconstructed from high-confidence Gmail evidence.
- Completed trips are quiet history.
- Weak matches, conflicts, and material unreadable sources appear in Action Needed.
- Manual edits are never silently overwritten.
- Full email bodies and PDF binaries are not persisted as source of truth.
- Source records, attachment records, facts, activities, scan runs, and review items are auditable.
- Existing `v0.11.0` dashboard, calendar, reminder, fitness, and PWA behavior remains intact.
