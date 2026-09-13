# Dose & Scale Frontend Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Dose & Scale from a monolithic HTML application plus an expanding stack of versioned runtime patch scripts into one canonical, modular frontend while preserving all current functionality and data.

**Architecture:** Do not rewrite the application from scratch. Create an isolated UAT service and database, snapshot the current rendered behavior, then fold each current runtime patch into canonical modules in small, testable steps. Preserve server APIs and state shape unless a task explicitly migrates them.

**Tech Stack:** Node.js/Express, PostgreSQL, vanilla HTML/CSS/JS, existing Railway deployment, current test tooling.

**Spec:** `docs/superpowers/plans/2026-09-13-ecosystem-ux-remediation.md`

## Global Constraints

- Work only on `uat/v13-frontend-consolidation` in `ppodolske/dose-and-scale`.
- Deploy only to `dose-and-scale-uat` using `Postgres-UAT` until explicit production approval.
- UAT must never point at production `DATABASE_URL`.
- Disable or isolate Garmin writes/sync operations during UI consolidation unless a task explicitly tests them.
- Preserve the current `app_state` schema and all user data semantics through the consolidation.
- No new versioned UI patch file may be introduced during this plan.
- Each migrated feature must delete or stop injecting the superseded patch only after regression tests prove parity.

---

## Target file structure

Create canonical frontend modules under:

```text
public/app/
  bootstrap.js
  state.js
  router.js
  ui/
    shell.js
    menu.js
    formatting.js
    dialogs.js
  features/
    integrity.js
    backups.js
    morning-digest.js
    weekly-review.js
    interventions.js
    insights.js
    exercise-normalization.js
  styles/
    tokens.css
    base.css
    components.css
    responsive.css
```

Keep `public/index.html` as the entry document, but remove feature implementation from the monolith as modules are extracted.

Superseded injected files targeted for retirement include:

```text
integrity-v12.3.0.js
backups-v12.3.1.js
morning-digest-v12.4.0.js
weekly-review-v12.4.1.js
interventions-v12.5.0.js
insights-ia-v12.5.1.js
ui-sweep-v12.5.7.js
formatting-v12.5.4.js
header-menu-v12.5.2.js
exercise-normalization-v12.5.5.js
```

Retain old files on the UAT branch until the replacement task passes, then remove them in the same commit that removes their runtime injection.

---

### Task 1: Provision and verify isolated Dose & Scale UAT

**Files:**
- Railway configuration only.

**Interfaces:**
- Produces: `dose-and-scale-uat` URL and isolated `Postgres-UAT`.

- [ ] **Step 1: Create UAT service from branch `uat/v13-frontend-consolidation`**
- [ ] **Step 2: Create UAT Postgres and point only UAT `DATABASE_URL` to it**
- [ ] **Step 3: Copy current app state into UAT**

Use application export/API or a database dump limited to `app_state` and representative `app_events`; remove credentials/tokens.

- [ ] **Step 4: Disable Garmin side effects**

Set UAT worker URL/token to a UAT worker if available; otherwise leave worker integration intentionally unavailable and verify the UI fails safely.

- [ ] **Step 5: Change a harmless UAT value and confirm production does not change**

Expected: complete isolation.

---

### Task 2: Freeze the current rendered contract with regression tests

**Files:**
- Create/modify test files in the existing test structure.
- Add browser/snapshot tooling only if already compatible with the repo.

**Interfaces:**
- Produces: regression coverage that protects consolidation work.

- [ ] **Step 1: Enumerate current top-level views and overlays**

At minimum cover:

```text
Dashboard
Progress Intelligence
Morning Digest
Weekly Review
Interventions
Insights
workout/planned-workout views
exercise/key-lift controls
history/undo
backup/restore
Garmin status/sync affordances
header/menu/settings dialogs
```

- [ ] **Step 2: Add DOM contract tests**

For each view assert the important stable selectors, headings, and controls exist.

- [ ] **Step 3: Add state round-trip smoke test**

```text
load UAT state -> edit harmless field -> PUT /api/state -> reload -> field persists
```

- [ ] **Step 4: Capture screenshots at 1440px, 768px, 390px**

Store as UAT evidence; do not use brittle pixel-perfect comparisons unless the existing stack already supports them.

- [ ] **Step 5: Commit**

```bash
git add test public
git commit -m "test: freeze Dose & Scale v12 UI contract"
```

---

### Task 3: Replace server-side script injection with an explicit app entrypoint

**Files:**
- Modify: `server.js`
- Modify: `public/index.html`
- Create: `public/app/bootstrap.js`
- Test: server/static route tests

**Interfaces:**
- Produces: one explicit `<script type="module" src="/app/bootstrap.js"></script>` entrypoint.

- [ ] **Step 1: Write failing server test**

Assert `GET /` already contains the canonical app entrypoint in `index.html` and server does not mutate HTML by inserting patch tags.

- [ ] **Step 2: Run test and confirm failure**
- [ ] **Step 3: Add `bootstrap.js` that imports existing patch files temporarily**

Initially preserve behavior with imports/load order equivalent to current server injection.

- [ ] **Step 4: Remove the `sendAppHtml()` tag-injection loop**

Serve the static canonical `index.html` for known SPA routes.

- [ ] **Step 5: Add an explicit 404 path for non-SPA/unknown asset requests**

Do not allow every unmatched request to silently receive application HTML.

- [ ] **Step 6: Run tests and UAT smoke test**
- [ ] **Step 7: Commit**

```bash
git add server.js public/index.html public/app/bootstrap.js test
git commit -m "refactor: add canonical Dose & Scale frontend entrypoint"
```

---

### Task 4: Extract shared design tokens and base styles

**Files:**
- Create: `public/app/styles/tokens.css`
- Create: `public/app/styles/base.css`
- Create: `public/app/styles/components.css`
- Create: `public/app/styles/responsive.css`
- Modify: `public/index.html`

**Interfaces:**
- Produces CSS custom properties and reusable component classes.

- [ ] **Step 1: Inventory repeated colors, radii, shadows, spacing, typography, breakpoints from `index.html` and current patches**
- [ ] **Step 2: Define semantic tokens**

Use names such as:

```css
--color-bg
--color-surface
--color-text
--color-muted
--color-primary
--color-positive
--color-warning
--color-danger
--radius-card
--radius-control
--space-1 through --space-6
```

- [ ] **Step 3: Move only shared/base rules first**

Do not rewrite feature CSS in this task.

- [ ] **Step 4: Add `:focus-visible` styling and 390px no-overflow guard**
- [ ] **Step 5: Run regression tests/screenshots**
- [ ] **Step 6: Commit**

---

### Task 5: Consolidate header/menu runtime

**Files:**
- Create: `public/app/ui/menu.js`
- Modify: `public/app/bootstrap.js`
- Fold behavior from: `public/header-menu-v12.5.2.js`
- Modify canonical HTML/CSS as needed

**Interfaces:**
- Produces: `initHeaderMenu(root=document)`.

- [ ] **Step 1: Write menu behavior tests**

Cover open, close, Escape, click-outside, keyboard focus, and return-to-preston.run link.

- [ ] **Step 2: Implement `initHeaderMenu` using stable data attributes instead of brittle positional selectors**
- [ ] **Step 3: Replace old injection/import**
- [ ] **Step 4: Verify desktop/mobile UAT**
- [ ] **Step 5: Delete superseded header-menu file only after parity passes**
- [ ] **Step 6: Commit**

---

### Task 6: Consolidate formatting and UI sweep patches

**Files:**
- Create: `public/app/ui/formatting.js`
- Modify: canonical markup/styles
- Fold behavior from current `formatting-*` and `ui-sweep-*` files

**Interfaces:**
- Produces pure formatting helpers rather than DOM mutation for static formatting decisions.

- [ ] **Step 1: Inventory every selector mutated by the active formatting and UI-sweep scripts**

Create a checked migration table in the commit/PR description with columns:

```text
old selector | old mutation | canonical replacement | regression test
```

- [ ] **Step 2: Move formatting logic into pure functions**

Examples: date labels, number display, units, headings.

- [ ] **Step 3: Move structural changes into canonical HTML/render functions rather than `querySelector(...).replaceWith(...)` style patches**
- [ ] **Step 4: Remove active formatting/UI-sweep imports**
- [ ] **Step 5: Delete superseded files after all tests/screenshots pass**
- [ ] **Step 6: Commit**

---

### Task 7: Extract Morning Digest and Weekly Review into canonical feature modules

**Files:**
- Create: `public/app/features/morning-digest.js`
- Create: `public/app/features/weekly-review.js`
- Modify: `public/app/bootstrap.js`
- Retire: active morning/weekly patch files

**Interfaces:**
- Produces `renderMorningDigest(state, root)` and `renderWeeklyReview(state, root)`.

- [ ] **Step 1: Write fixture-based rendering tests using representative state**
- [ ] **Step 2: Implement modules without global monkey-patching**
- [ ] **Step 3: Ensure each module can render twice idempotently without duplicate nodes/listeners**
- [ ] **Step 4: Remove old patch imports**
- [ ] **Step 5: Compare UAT screenshots to baseline**
- [ ] **Step 6: Commit**

---

### Task 8: Extract Interventions and Insights modules

**Files:**
- Create: `public/app/features/interventions.js`
- Create: `public/app/features/insights.js`
- Retire: `interventions-v12.5.0.js`, `insights-ia-v12.5.1.js` after parity

**Interfaces:**
- Render from explicit state/input; do not scrape other DOM cards to reconstruct source data.

- [ ] **Step 1: Write rendering/interaction tests**
- [ ] **Step 2: Implement canonical modules**
- [ ] **Step 3: Verify edit/save flows update the same state paths as before**
- [ ] **Step 4: Remove patch imports and old files**
- [ ] **Step 5: Commit**

---

### Task 9: Extract backup/history/integrity controls

**Files:**
- Create: `public/app/features/backups.js`
- Create: `public/app/features/integrity.js`
- Create: `public/app/state.js`
- Retire corresponding versioned scripts after parity

**Interfaces:**
- `state.js` owns API state load/save/history helpers.
- Feature modules consume `state.js` rather than duplicating fetch wrappers.

- [ ] **Step 1: Write tests for save/history/undo conflict behavior at the frontend boundary**
- [ ] **Step 2: Centralize API helpers**

Canonical signatures:

```js
loadState()
saveState(state, mutation)
loadHistory(limit)
undoHistoryEvent(id)
```

- [ ] **Step 3: Migrate backup and integrity UI**
- [ ] **Step 4: Verify restore requires confirmation and UAT safety snapshot still works**
- [ ] **Step 5: Remove old script imports/files**
- [ ] **Step 6: Commit**

---

### Task 10: Extract exercise normalization and key-lift UI

**Files:**
- Create: `public/app/features/exercise-normalization.js`
- Modify canonical workout/exercise render path
- Retire active exercise-normalization patch

**Interfaces:**
- Normalization must be pure and deterministic.

- [ ] **Step 1: Copy existing normalization cases into unit tests before moving code**
- [ ] **Step 2: Implement pure normalizer**
- [ ] **Step 3: Wire key-lift selection to canonical exercise IDs/names**
- [ ] **Step 4: Confirm existing saved state remains readable without migration**
- [ ] **Step 5: Remove patch import/file**
- [ ] **Step 6: Commit**

---

### Task 11: Break remaining monolithic `index.html` behavior into focused modules

**Files:**
- Modify: `public/index.html`
- Create focused files under `public/app/` as needed, one responsibility per file.

**Interfaces:**
- `index.html` becomes document structure/templates, not the primary application source file.

- [ ] **Step 1: Measure current inline JS/CSS bytes**
- [ ] **Step 2: Move remaining inline JS by responsibility into modules**
- [ ] **Step 3: Move remaining reusable CSS into stylesheets**
- [ ] **Step 4: Keep only small bootstrapping/config data inline**
- [ ] **Step 5: Target outcome: no single frontend JS source file above 100 KB without documented justification**
- [ ] **Step 6: Run full regression suite and commit**

---

### Task 12: Replace Basic Auth with ecosystem-compatible app login in UAT

**Files:**
- Modify: `server.js`
- Create auth module/files following preston.ai owner-only pattern or another explicit shared-session design.
- Tests: auth route/middleware tests

**Interfaces:**
- UAT must support authenticated browser sessions without the browser-native Basic Auth modal.

- [ ] **Step 1: Write auth tests before changing Basic Auth**

Cover unauthenticated redirect, successful login/session, logout, protected API routes, expired session.

- [ ] **Step 2: Implement UAT login flow**

Prefer the same Google owner identity model as preston.ai if domain/cookie boundaries permit securely. Do not share a cookie across subdomains unless the security model is explicitly reviewed.

- [ ] **Step 3: Keep API protection equivalent or stronger than current Basic Auth**
- [ ] **Step 4: Verify no credentials appear in URLs/local storage**
- [ ] **Step 5: UAT-test from desktop and mobile browser**
- [ ] **Step 6: Commit**

---

### Task 13: Remove dead/superseded frontend files and document canonical architecture

**Files:**
- Delete superseded versioned scripts no longer loaded
- Update: `README.md`
- Create: `docs/frontend-architecture.md`

**Interfaces:**
- Produces one documented source of truth.

- [ ] **Step 1: Search repo for references to every candidate deletion**

```bash
grep -R "v12\." -n server.js public test || true
```

- [ ] **Step 2: Delete only files with zero runtime/test references**
- [ ] **Step 3: Document entrypoint, state flow, module boundaries, and rule: no versioned DOM patch files**
- [ ] **Step 4: Run full test suite**
- [ ] **Step 5: Commit**

---

## UAT acceptance gate

- [ ] Production remains unchanged throughout UAT.
- [ ] UAT uses isolated Postgres.
- [ ] Every baseline feature remains functional.
- [ ] State load/edit/save/reload works.
- [ ] History and undo work.
- [ ] Backup/restore works against UAT only.
- [ ] Morning Digest, Weekly Review, Interventions, Insights and Progress Intelligence render correctly.
- [ ] Exercise normalization/key lifts behave identically or better.
- [ ] Header/menu works with mouse, touch and keyboard.
- [ ] No active versioned UI patch chain is injected by `server.js`.
- [ ] Unknown non-SPA routes return proper 404 responses.
- [ ] No horizontal overflow at 390px.
- [ ] Full test suite passes.
- [ ] UAT screenshots have been reviewed and approved.

## Production promotion

Promote as a major frontend architecture release, recommended version **v13.0.0**. Merge only after explicit approval and keep the previous Railway deployment available for immediate rollback. Do not delete the UAT service after launch; it should become the permanent pre-production environment for Dose & Scale.
