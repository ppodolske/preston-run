# preston.ai Versioned Rollout

**Spec:** `docs/superpowers/specs/2026-09-13-life-admin-design.md`

This document is the release map. Each release receives its own detailed Superpowers implementation plan before code is changed. Every release must leave `preston.run` deployable, testable, and usable.

## Release sequence

| Version | Scope | Exit condition |
|---|---|---|
| **v0.5.0** | preston.ai branding, approved logo/icon assets, Google sign-in, owner-only authentication, private-by-default homepage, PWA manifest/icon update | Anonymous visitors see only sign-in; owner sees authenticated dashboard shell; PWA installs as preston.ai |
| **v0.6.0** | Supabase private data foundation, People/Birthdays, Coming Up | Owner can CRUD people/birthdays and see upcoming birthdays securely |
| **v0.7.0** | Life Admin items, tasks, renewals | Owner can CRUD and resolve Life Admin items/tasks with secure detail/edit flows |
| **v0.8.0** | Trips, segments, bookings, itinerary | Owner can manually create/edit/merge/split trips and see chronological itineraries |
| **v0.9.0** | Web Push, reminder rules, notification history | PWA can subscribe devices and deliver deduplicated reminders with snooze/acknowledge |
| **v0.10.0** | Gmail OAuth and manual scan | Gmail can be connected separately from login and scanned on demand with provenance stored |
| **v0.11.0** | Classification, matching, auto-update, review inbox | High-confidence messages update records; uncertainty goes to review; undo/history works |
| **v0.12.0** | Scheduled Gmail sweep and trip intelligence | Scheduled scans group/update trips and batch routine notifications safely |
| **v0.13.0** | Unified Morning Digest | preston.ai homepage combines Life Admin with Dose & Scale summary data and sends one morning push |
| **v0.14.0+** | Refinement | Sender rules, maintenance/subscriptions, advanced trip intelligence, more app summaries |

## Cross-release rules

1. `preston.run` remains the canonical URL and `preston.ai` the product name.
2. `parks.preston.run` remains public and independent.
3. Google authentication and Gmail authorization are separate grants.
4. PWA Web Push is the only outbound notification channel.
5. No release may expose private data in unauthenticated HTML, static assets, metadata, logs, or public caches.
6. All Supabase private tables introduced from v0.6.0 onward require RLS and owner-scoped policies.
7. Every release increments `package.json`, the visible release marker, and automated tests together.
8. Tests must pass before deployment/merge claims are made.
9. Implementation should favor small focused modules over returning to a single monolithic `server.js`.
10. The approved outdoors-oriented transparent logo is the website wordmark; the approved opaque navy outdoors icon is the PWA/app icon source.

## Detailed plans

- `docs/superpowers/plans/2026-09-13-preston-ai-v0.5.0-private-foundation.md`

Later detailed plans are written only after the preceding release is complete and verified, so they can use the actual resulting codebase rather than assumptions.