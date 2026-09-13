# State Parks UX Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the State Parks information architecture, establish a clear canonical runtime/data source, optimize oversized assets, and align navigation/accessibility with the Preston ecosystem while preserving all current trip-planning functionality.

**Architecture:** Keep the existing application and its current persistence model. First freeze behavior in a dedicated UAT deployment, then inventory legacy/runtime layers and designate canonical files before deleting anything. Consolidate user-facing navigation around Explore / Plan / Track without rewriting the park data model.

**Tech Stack:** Existing JavaScript application, Railway, current test scripts and audit tooling, static image assets.

**Spec:** `docs/superpowers/plans/2026-09-13-ecosystem-ux-remediation.md`

## Global Constraints

- Work only on `uat/v1.18-ux-cleanup` in `ppodolske/mnwistateparks`.
- Deploy only to `state-parks-uat` until explicit production approval.
- Do not delete historical/runtime files until reference searches and regression tests prove they are unused.
- Preserve park IDs/keys so saved trips/collections remain compatible.
- Preserve the public nature of the Parks site.
- All park detail work must retain address, official park page, and official map links where available.

---

### Task 1: Provision and baseline State Parks UAT

**Files:** Railway configuration and existing test/audit outputs only.

**Interfaces:** Produces a distinct UAT hostname and baseline evidence.

- [ ] **Step 1: Deploy `uat/v1.18-ux-cleanup` as `state-parks-uat`**
- [ ] **Step 2: Confirm UAT browser storage cannot collide with production by hostname**
- [ ] **Step 3: Seed/copy representative planning state if persistence requires it**
- [ ] **Step 4: Capture desktop/tablet/mobile screenshots for Explore/list, park detail, map, trip planner, trip detail, collections/tracking**
- [ ] **Step 5: Run the existing test/audit scripts and save results**

---

### Task 2: Produce a canonical-runtime inventory before cleanup

**Files:**
- Create: `docs/runtime-inventory.md`
- No deletions yet.

**Interfaces:** Produces an explicit classification for every root runtime/data file.

- [ ] **Step 1: Inventory all root JS/data/style files**

Classify each as:

```text
CANONICAL_RUNTIME
CANONICAL_DATA
BUILD_OR_AUDIT_TOOL
COMPATIBILITY_LAYER
SUPERSEDED_CANDIDATE
UNKNOWN_REQUIRES_REVIEW
```

- [ ] **Step 2: Record import/script references for files including**

```text
app.js
app-v101.js
app-runtime.js
planning-entry.js
project-entry.js
planner-polish.js
decision-runtime.js
collections-runtime.js
parity-runtime.js
park-details.js
park-details-extra.js
park-addresses.js
park-addresses-current.js
data1.js data2.js data3.js data4.js
park-review-text.js and park-review-text-1..4.js
```

- [ ] **Step 3: Use repository-wide reference search before assigning SUPERSEDED_CANDIDATE**

```bash
grep -R "app-v101\|app-runtime\|park-addresses-current\|park-details-extra" -n . --exclude-dir=.git
```

- [ ] **Step 4: Commit inventory**

```bash
git add docs/runtime-inventory.md
git commit -m "docs: map State Parks runtime sources"
```

---

### Task 3: Establish one canonical application entrypoint

**Files:**
- Modify the current HTML/server/static entrypoint and runtime files identified by Task 2.
- Tests: existing smoke/runtime tests.

**Interfaces:** Exactly one documented runtime entrypoint owns app startup.

- [ ] **Step 1: Write or extend smoke test to identify the expected canonical entry script**
- [ ] **Step 2: Route startup through that canonical entrypoint**
- [ ] **Step 3: Convert required compatibility layers into explicit imports/functions rather than accidental script ordering**
- [ ] **Step 4: Verify Explore, map, planner, collections all initialize once**
- [ ] **Step 5: Commit**

---

### Task 4: Consolidate park reference data into canonical sources

**Files:**
- Modify canonical park details/address/reference files identified in Task 2.
- Modify `park-reference-audit.js` tests/audits as needed.

**Interfaces:** One canonical source for address, official park page URL, official map URL, coordinates, and descriptive details per park.

- [ ] **Step 1: Add audit assertions that every supported park key resolves to at most one canonical address/reference record**
- [ ] **Step 2: Merge split/legacy address/detail sources into canonical records without changing park keys**
- [ ] **Step 3: Retain official DNR page/map fields requested for the park page**
- [ ] **Step 4: Run reference audit and fix all duplicate/conflicting entries**
- [ ] **Step 5: Commit**

---

### Task 5: Reframe navigation as Explore / Plan / Track

**Files:**
- Modify canonical navigation/app entry files and styles.
- Test: navigation/smoke tests.

**Interfaces:** Primary navigation exposes exactly the three user concepts plus an ecosystem link.

- [ ] **Step 1: Write navigation contract test**

Expected visible destinations:

```text
Explore
Plan
Track
preston.run
```

Implementation/internal concepts such as project, entry, decision runtime, or collection runtime must not appear as top-level user-facing labels unless they are genuinely user concepts.

- [ ] **Step 2: Map current screens into the three destinations**

```text
Explore: park discovery/list/map/park detail
Plan: trips, itinerary, unassigned-stop workflow, logistics
Track: visited/wishlist/collections/progress
```

- [ ] **Step 3: Implement responsive navigation**
- [ ] **Step 4: Verify deep links remain usable**
- [ ] **Step 5: Commit**

---

### Task 6: Finish park-detail information hierarchy

**Files:** canonical park detail renderer/styles/data.

**Interfaces:** Park detail consistently exposes key practical information.

- [ ] **Step 1: Add rendering tests for**

```text
park name
state
address
official park page link
official map link
visit/tracking status
planning/add-to-trip action
key notes/details
```

- [ ] **Step 2: Make official links visually distinct and open externally with `rel="noopener noreferrer"`**
- [ ] **Step 3: If an address/reference is unavailable, show an intentional unavailable state rather than a broken/empty link**
- [ ] **Step 4: Verify Minnesota and Wisconsin examples in UAT**
- [ ] **Step 5: Commit**

---

### Task 7: Preserve and polish the v1.17 unassigned-stop workflow

**Files:** planner runtime/UI files identified as canonical.

**Interfaces:** Unassigned section appears only when unassigned parks exist.

- [ ] **Step 1: Write regression tests for Assign to Day, Create New Day, Remove from Trip**
- [ ] **Step 2: Verify unassigned section disappears when empty**
- [ ] **Step 3: Ensure mobile controls are full-width/tappable without drag-and-drop dependency**
- [ ] **Step 4: Verify assignments persist after reload**
- [ ] **Step 5: Commit**

---

### Task 8: Consolidate trip-wide logistics presentation

**Files:** planner/trip detail UI.

**Interfaces:** Trip-wide details live in one coherent section; day-specific camping remains in day cards.

- [ ] **Step 1: Write tests for trip-wide fields**

```text
dates
start location
optional return/end location
emergency contact
lodging/general accommodation notes
resupply notes
general trip notes
```

- [ ] **Step 2: Ensure day-specific camping is not duplicated in the trip-wide logistics panel**
- [ ] **Step 3: Use progressive disclosure/edit mode so logistics do not dominate normal trip reading**
- [ ] **Step 4: Commit**

---

### Task 9: Optimize oversized web images

**Files:**
- Replace optimized derivatives under `public/images/`.
- Modify references as required.
- Add asset-size audit test/script.

**Interfaces:** Visual appearance preserved at intended display sizes.

- [ ] **Step 1: Add audit that flags ordinary page images over 2 MB unless explicitly allowlisted**
- [ ] **Step 2: Convert `public/images/cover-photo.png` (~9.7 MB) to a correctly sized WebP/AVIF derivative**
- [ ] **Step 3: Keep source-quality original outside the served web asset path only if needed for future design work**
- [ ] **Step 4: Verify no visible degradation at desktop hero dimensions**
- [ ] **Step 5: Run performance/network check and commit**

---

### Task 10: Accessibility and responsive sweep

**Files:** canonical styles/renderers.

**Interfaces:** Same ecosystem accessibility contract as preston.ai.

- [ ] **Step 1: Add visible `:focus-visible` style**
- [ ] **Step 2: Ensure form labels are associated with inputs**
- [ ] **Step 3: Ensure map/list/planner controls have accessible names**
- [ ] **Step 4: Verify no horizontal scrolling at 390px**
- [ ] **Step 5: Keyboard-test primary navigation and trip-planning controls**
- [ ] **Step 6: Commit**

---

### Task 11: Delete proven superseded files

**Files:** files marked `SUPERSEDED_CANDIDATE` in `docs/runtime-inventory.md`.

**Interfaces:** Runtime behavior must be unchanged after deletion.

- [ ] **Step 1: Re-run repository reference search for each deletion candidate**
- [ ] **Step 2: Delete only zero-reference candidates or intentionally migrated compatibility layers**
- [ ] **Step 3: Run full tests, reference audits, PDF/runtime audits where applicable**
- [ ] **Step 4: Update `docs/runtime-inventory.md` so only current canonical sources remain documented**
- [ ] **Step 5: Commit**

---

## UAT acceptance gate

- [ ] Explore / Plan / Track navigation works at 1440px, 768px, 390px.
- [ ] Park details expose address + official page + official map where available.
- [ ] Existing trip plans remain readable/editable after the runtime cleanup.
- [ ] Unassigned-stop workflow works and persists.
- [ ] Trip-wide logistics are consolidated without duplicating daily camping.
- [ ] Collections/visited/wishlist tracking works.
- [ ] Maps still load and select the correct parks.
- [ ] Cover image is web-sized and no ordinary served image exceeds the agreed audit threshold without justification.
- [ ] Canonical runtime/data ownership is documented.
- [ ] Superseded files are removed only after parity tests pass.
- [ ] Existing test/audit scripts are green.

## Production promotion

Merge `uat/v1.18-ux-cleanup` to `main` only after explicit UAT approval. Deploy `state-parks-web`, then smoke-test Explore, one MN park detail, one WI park detail, map, planner, unassigned-stop flow, and Track/collections. Roll back to the prior Railway deployment if any primary workflow fails.
