# Preston Ecosystem UX Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize, simplify, and standardize the user experience across preston.ai, Dose & Scale, State Parks, and Archive without changing production until each app has passed isolated UAT acceptance.

**Architecture:** Treat the ecosystem as four independently deployable applications with a common product-navigation and visual-language contract. Implement and verify each application in a dedicated non-production deployment, then promote only after explicit UAT approval. preston.ai already has a UAT Railway service; the other three apps must receive isolated UAT services and isolated data stores before implementation begins.

**Tech Stack:** Node.js/Express, Next.js, PostgreSQL/Supabase, Railway, GitHub Actions, vanilla HTML/CSS/JS, existing app-specific test stacks.

**Spec:** This document defines the cross-product requirements. App-specific execution details live in the linked plans below.

## Global Constraints

- Production services, production custom domains, and production databases MUST NOT be modified while executing this remediation plan.
- All code changes MUST be made on dedicated remediation branches and tested in UAT before any production merge or deployment.
- No UAT service may use a production database connection string unless the connection is provably read-only and the task explicitly requires it; remediation work should instead use copied/sanitized UAT data.
- No destructive migration may run against production during implementation.
- Existing user-visible functionality must remain available unless a task explicitly replaces it with a tested equivalent.
- Accessibility improvements must preserve keyboard navigation and provide visible `:focus-visible` states.
- Responsive acceptance must cover desktop width 1440px, tablet width 768px, and mobile width 390px.
- Every task ends with tests, a UAT verification step, and a commit.
- Promotion to production requires explicit user approval after the corresponding UAT gate passes.

---

## Scope and plan map

Execute in this order:

1. [`2026-09-13-preston-ai-ux-remediation.md`](./2026-09-13-preston-ai-ux-remediation.md)
2. [`2026-09-13-dose-scale-frontend-consolidation.md`](./2026-09-13-dose-scale-frontend-consolidation.md)
3. [`2026-09-13-state-parks-ux-cleanup.md`](./2026-09-13-state-parks-ux-cleanup.md)
4. [`2026-09-13-archive-navigation-polish.md`](./2026-09-13-archive-navigation-polish.md)

The order is deliberate: preston.ai defines the shared ecosystem navigation/design conventions; Dose & Scale is the highest technical-risk frontend and should be consolidated next; State Parks then adopts the stabilized conventions; Archive needs only light polish.

## Target non-production topology

### preston.ai

Reuse Railway service `preston-run-uat` in project `Preston.run`.

- Production service: `preston-run-hub`
- UAT service: `preston-run-uat`
- UAT branch for implementation: `uat/ux-remediation`
- UAT URL: existing Railway-generated domain for `preston-run-uat`
- UAT `SITE_URL` must point to the UAT domain, never `https://preston.run`.
- OAuth callback URLs for UAT integrations must use the UAT domain.
- If the current UAT service points at production Supabase data, create/use isolated UAT tables/schema/project before running write-path tests.

### Dose & Scale

Create a new Railway UAT web service and UAT Postgres database in the existing `Dose & Scale` project.

- Production service: `dose-and-scale-web`
- New UAT service: `dose-and-scale-uat`
- New UAT database: `Postgres-UAT`
- Implementation branch: `uat/v13-frontend-consolidation`
- Do not connect UAT to production `app_state` or production event history.
- Seed UAT with an exported copy of current app state, scrubbed of credentials/tokens.
- Garmin worker calls must be disabled by default or pointed at a safe UAT worker/token.

### State Parks

Create a new Railway UAT service in project `MN-WI-State-Parks`.

- Production service: `state-parks-web`
- New UAT service: `state-parks-uat`
- Implementation branch: `uat/v1.18-ux-cleanup`
- If persistence is browser/local-storage only, use a separate UAT hostname so browser state cannot collide with production.
- If server persistence is present, provision isolated UAT storage before enabling edits.

### Archive

Create a new Railway UAT application service and UAT Postgres database in project `archive`.

- Production service: `archive`
- New UAT service: `archive-uat`
- New UAT database: `Postgres-UAT`
- Implementation branch: `uat/navigation-polish`
- Seed only a small representative story set including: a story with images, a story with progression, a completed story, and an ongoing story.
- Import/export/media relay tests must use UAT credentials and UAT storage targets.

---

## Cross-product acceptance contract

All four apps must satisfy these requirements before production promotion:

- A consistent link back to `preston.run` is visible from every app.
- Internal navigation never uses the external-link glyph `↗` unless the destination actually leaves the current app/site.
- Primary, secondary, and destructive actions have visually distinct and consistent treatments.
- Inputs have programmatically associated labels.
- Interactive controls have visible keyboard focus states.
- No page requires horizontal scrolling at 390px width.
- No primary content relies on hover to reveal required actions.
- Error states keep the user inside the app and provide a recovery action.
- Long-running work returns an immediate response and exposes status rather than blocking a browser request.
- Asset payloads do not ship multi-megabyte images where a web-sized derivative is appropriate.
- UAT smoke tests pass before every merge to a production-targeting branch.

---

## Phase 0: UAT infrastructure gate

### Task 0.1: Freeze production remediation work

**Files:**
- No code files.

**Interfaces:**
- Consumes: current production branches and Railway services.
- Produces: named UAT branches/services that all later tasks target.

- [ ] **Step 1: Create the implementation branches**

```bash
# preston-run
git switch build/preston-ai-v0.11.0
git pull
git switch -c uat/ux-remediation

# dose-and-scale
git switch main
git pull
git switch -c uat/v13-frontend-consolidation

# mnwistateparks
git switch main
git pull
git switch -c uat/v1.18-ux-cleanup

# archive
git switch main
git pull
git switch -c uat/navigation-polish
```

- [ ] **Step 2: Verify no implementation branch is configured as a production Railway source**

Record the Railway source branch for every production service and verify none equals the new UAT branch.

Expected: all four UAT implementation branches are absent from production service source configuration.

- [ ] **Step 3: Commit a branch marker only if the repo requires one**

No empty commit is required unless Railway cannot attach the branch without one.

### Task 0.2: Provision isolated UAT services

**Files:**
- Modify only Railway configuration; do not change application code yet.

**Interfaces:**
- Consumes: UAT branches from Task 0.1.
- Produces: reachable UAT URLs for all four apps.

- [ ] **Step 1: Repoint existing preston.ai UAT service to `uat/ux-remediation`**

Verify health endpoint / landing page works on its Railway-generated domain.

- [ ] **Step 2: Create `dose-and-scale-uat` and `Postgres-UAT`**

Copy only required environment-variable names. Generate new UAT secrets where possible. Point `DATABASE_URL` only to `Postgres-UAT`.

- [ ] **Step 3: Create `state-parks-uat`**

Use `uat/v1.18-ux-cleanup` as the source branch. Generate a Railway UAT domain.

- [ ] **Step 4: Create `archive-uat` and `Postgres-UAT`**

Point all database variables to UAT Postgres and all public/base URL values to the UAT domain.

- [ ] **Step 5: Verify isolation**

For each UAT URL:

```text
1. Add or edit a harmless UAT record.
2. Confirm the production site does not change.
3. Delete/revert the UAT record.
```

Expected: no production-visible change.

### Task 0.3: Establish UAT regression evidence

**Files:**
- Create per-repo screenshots/artifacts only if the test framework already supports them.
- Modify test configuration only where required to target UAT base URLs.

**Interfaces:**
- Produces: baseline evidence to compare against remediation results.

- [ ] **Step 1: Capture representative pages at 1440px, 768px and 390px**

Minimum pages:

```text
preston.ai: home, people, life admin, trip detail, calendar, notifications, Gmail
Dose & Scale: dashboard, Progress Intelligence, workout/history area, settings/menu
State Parks: park list/detail, map, trip planner, collections/tracking
Archive: library, story reader, gallery/progression, activity, import
```

- [ ] **Step 2: Record current functional smoke results**

For each app, record pass/fail for login, primary navigation, create/edit flow, delete confirmation, and persistence/reload.

- [ ] **Step 3: Do not proceed until baseline evidence is stored with the UAT work**

---

## Promotion protocol

Each app-specific plan has its own UAT gate. After an app passes:

1. Open a PR from its UAT branch to the production-targeting branch.
2. Require test suite green.
3. Review UAT screenshots against baseline.
4. Perform one final smoke test on the UAT URL.
5. Obtain explicit user approval.
6. Merge.
7. Deploy production.
8. Immediately perform production smoke tests.
9. If smoke tests fail, roll back to the previous known-good deployment/commit.

Do not batch all four applications into one production release. Promote one app at a time.

## Completion definition

This ecosystem remediation is complete when:

- all four app-specific plans are fully checked off;
- all production deployments are running the remediated versions;
- no production service points at a UAT branch;
- UAT services remain available for future changes;
- Dose & Scale no longer depends on an expanding chain of versioned UI patch scripts;
- preston.ai pages use a shared shell/design-system implementation;
- State Parks has a clear canonical runtime/data structure and optimized web assets;
- Archive exposes its important destinations through intentional navigation;
- the ecosystem navigation and accessibility contract above is satisfied everywhere.
