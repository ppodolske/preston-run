# Archive Navigation Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Archive navigation/discoverability and ecosystem consistency without disturbing the current story-reading, editing, import/export, media, and progression workflows.

**Architecture:** Keep the existing Next.js structure and components. Add intentional primary navigation to the existing private layout, simplify misleading copy/iconography, and make only light accessibility/responsive changes. Do not restructure Archive into a new framework because its current application architecture is already healthy.

**Tech Stack:** Next.js, React, Prisma/Postgres, Playwright/Vitest, Railway.

**Spec:** `docs/superpowers/plans/2026-09-13-ecosystem-ux-remediation.md`

## Global Constraints

- Work only on `uat/navigation-polish` in `ppodolske/archive`.
- Deploy only to `archive-uat` with `Postgres-UAT` until explicit production approval.
- Keep all existing story, gallery, progression, edit, import, export, activity and relay routes working.
- Do not point UAT import/media relay operations at production storage.
- Preserve existing story slugs/IDs in copied UAT data.

---

### Task 1: Provision and seed isolated Archive UAT

**Files:** Railway configuration only.

**Interfaces:** Produces isolated UAT app/database/storage targets.

- [ ] **Step 1: Create `archive-uat` from branch `uat/navigation-polish`**
- [ ] **Step 2: Create `Postgres-UAT` and set UAT database variables**
- [ ] **Step 3: Configure UAT auth/base URL variables for the UAT hostname**
- [ ] **Step 4: Configure UAT media/import relay credentials so writes cannot reach production storage**
- [ ] **Step 5: Seed representative stories**

Minimum UAT dataset:

```text
one ongoing story
one completed story
one story with multiple inline images
one story with progression data
one story with gallery content
```

- [ ] **Step 6: Edit/delete an UAT story and confirm production remains unchanged**

---

### Task 2: Add visible primary navigation

**Files:**
- Modify: `app/(private)/layout.tsx`
- Modify/create components under `components/site/`
- Modify: `app/globals.css` or `app/preston-theme.css`
- Test: Playwright/navigation tests

**Interfaces:** Primary navigation exposes Library, Activity, Random; utility menu retains Import, Export JSON, Log out.

- [ ] **Step 1: Write failing navigation tests**

Assert private pages expose:

```text
Archive brand -> /
Library -> /
Activity -> /activity
Random -> /random
preston.run -> https://preston.run
```

and the utility menu still exposes Import, Export JSON and Log out.

- [ ] **Step 2: Run tests and confirm failure**

```bash
npm test
npx playwright test
```

Use the repo's exact scripts if names differ.

- [ ] **Step 3: Implement desktop navigation**

Recommended layout:

```text
Archive | Library  Activity  Random                   preston.run ↗  ☰
```

- [ ] **Step 4: Keep compact mobile behavior**

At mobile width, collapse primary destinations into a touch-friendly menu if needed, but do not hide Activity entirely.

- [ ] **Step 5: Run tests and commit**

```bash
git add 'app/(private)/layout.tsx' components/site app/*.css tests
git commit -m "feat: expose Archive primary navigation"
```

---

### Task 3: Remove misleading internal external-link glyphs

**Files:**
- Modify: `app/(private)/page.tsx`
- Search other private components/pages.
- Test: library/page tests.

**Interfaces:** `↗` appears only for genuinely external navigation/new-site transitions.

- [ ] **Step 1: Write test that `/random` link text does not include `↗`**
- [ ] **Step 2: Change `Random story ↗` to `Random story` or `Surprise me`**
- [ ] **Step 3: Search for other internal links using `↗`**

```bash
grep -R "↗" -n app components
```

- [ ] **Step 4: Keep glyph only on destinations such as `preston.run` that actually leave Archive**
- [ ] **Step 5: Run tests and commit**

---

### Task 4: Simplify library copy and metadata hierarchy

**Files:**
- Modify: `app/(private)/page.tsx`
- Modify: `components/library/story-card.*` if required
- Test: library component/page tests

**Interfaces:** Library is reading-first; archive mechanics stay secondary.

- [ ] **Step 1: Write rendering tests for primary story metadata**

Story cards should prioritize, when data exists:

```text
title
ongoing/complete status
last updated
reading length or content length
image count or visual indicator
```

- [ ] **Step 2: Replace developer-oriented hero copy**

Use concise reader-facing wording. Do not foreground terms such as canonical reconciliation unless they are needed for a specific admin workflow.

- [ ] **Step 3: Keep correction/fidelity/archive mechanics available on edit/admin surfaces**
- [ ] **Step 4: Verify filters/sort/search continue to work**
- [ ] **Step 5: Commit**

---

### Task 5: Add active navigation states and keyboard accessibility

**Files:**
- Modify navigation component/layout/CSS.
- Tests: Playwright keyboard tests.

**Interfaces:** Current primary section is conveyed visually and via `aria-current="page"` where practical.

- [ ] **Step 1: Add tests for visible focus and keyboard menu operation**
- [ ] **Step 2: Add `:focus-visible` rules if current theme does not provide sufficient contrast**
- [ ] **Step 3: Ensure menu summary/button has an accessible name**
- [ ] **Step 4: Ensure menu links can be reached and activated using keyboard only**
- [ ] **Step 5: Commit**

---

### Task 6: Verify story sub-navigation consistency

**Files:**
- Inspect/modify:
  - `app/(private)/stories/[slug]/page.tsx`
  - `app/(private)/stories/[slug]/edit/page.tsx`
  - `app/(private)/stories/[slug]/gallery/page.tsx`
  - `app/(private)/stories/[slug]/progression/page.tsx`
- Related components/tests.

**Interfaces:** Story-level navigation uses consistent labels and preserves return path to Library/story reader.

- [ ] **Step 1: Write route-level navigation assertions**

Reader pages with available features should expose consistent destinations such as Reader, Gallery, Progression, Edit without differing terminology between pages.

- [ ] **Step 2: Ensure destructive/editing actions are visually secondary to reading navigation**
- [ ] **Step 3: Verify back-navigation does not discard unsaved edits without browser warning/expected form behavior**
- [ ] **Step 4: Run tests and commit**

---

### Task 7: Final responsive and regression sweep

**Files:** CSS/tests only as required by findings.

**Interfaces:** No functional route changes.

- [ ] **Step 1: Capture UAT screenshots at 1440px, 768px, 390px for Library, Reader, Gallery/Progression, Activity, Import**
- [ ] **Step 2: Verify no horizontal overflow at 390px**
- [ ] **Step 3: Verify long story titles and metadata wrap without overlapping navigation/cards**
- [ ] **Step 4: Verify image/gallery layouts preserve aspect ratio and remain tappable**
- [ ] **Step 5: Run full Vitest/Playwright suite**
- [ ] **Step 6: Commit final polish if required**

---

## UAT acceptance gate

- [ ] UAT database/media are isolated from production.
- [ ] Library, Activity and Random are discoverable from primary navigation.
- [ ] Import, Export JSON and Log out remain available in utility navigation.
- [ ] Internal links do not use misleading external-link glyphs.
- [ ] Library copy is reader-facing.
- [ ] Story reader/edit/gallery/progression routes all still work.
- [ ] Search/filter/sort/favourite behavior still works.
- [ ] Import/export still works against UAT.
- [ ] Keyboard navigation/focus is usable.
- [ ] No horizontal overflow at 390px.
- [ ] Full test suites pass.

## Production promotion

Merge `uat/navigation-polish` to `main` only after explicit UAT approval. Deploy the production `archive` service and smoke-test Library, one story reader, Gallery, Progression, Activity, Random, Import and Export. Roll back to the previous Railway deployment if any primary navigation or story-reading workflow fails.
