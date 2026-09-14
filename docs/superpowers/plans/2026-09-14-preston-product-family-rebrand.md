# Preston Product Family Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the Preston product family to `preston.ai`, `Atlas`, `Form`, and `Archive`, add coherent cross-product navigation and metadata, and preserve all existing technical compatibility identifiers and access boundaries.

**Architecture:** Treat Preston as the umbrella brand and preston.ai as the orchestration/intelligence platform. Rebrand only user-visible product surfaces first: the current parks product becomes Atlas, Dose & Scale becomes Form, and Archive remains Archive with shared Preston family treatment. Keep repositories, domains, Railway resources, cookies/storage namespaces, database identifiers, APIs, and route topology stable.

**Tech Stack:** Existing per-repository stacks. preston.ai uses Node.js/CommonJS, server-rendered HTML, Supabase/PostgreSQL, and Railway. Form uses Node/Express plus the existing browser dashboard runtime. Atlas uses the existing `ppodolske/mnwistateparks` web runtime. Archive uses Next.js 16, React 19, TypeScript, Prisma/PostgreSQL, and Railway.

**Spec:** `docs/superpowers/specs/2026-09-14-preston-product-family-rebrand-design.md`

## Global Constraints

- Do not begin implementation until preston.ai v0.14.0 release gates are complete and its release branch is stable.
- Product names are exactly `preston.ai`, `Atlas`, `Form`, and `Archive`.
- Authenticated family navigation is exactly `Home · Atlas · Form · Archive`.
- `Parks` remains a valid feature/category label inside Atlas; it is no longer the overall product name.
- Historical release notes and historical references may retain old names when rewriting them would falsify history.
- Do not rename GitHub repositories: `ppodolske/preston-run`, `ppodolske/dose-and-scale`, `ppodolske/mnwistateparks`, `ppodolske/archive`.
- Do not rename Railway projects/services, deployed domains, environment variables, database identifiers, routes, cookies, localStorage/sessionStorage keys, object-storage identifiers, or APIs solely for branding.
- Preserve `dose_scale_session` and other compatibility identifiers containing the legacy D&S name.
- Do not move Morning Digest back into Form.
- Do not merge Atlas trip/planning data into preston.ai as part of this rebrand.
- Preserve public Atlas park pages and existing private/authenticated boundaries.
- Do not expose preston.ai, Form, Archive, private Trip, or Life Admin data on public Atlas pages.
- All affected repositories must pass their pre-existing automated suites before deployment.
- Use TDD for code paths that generate or validate visible branding/navigation; static-copy-only edits must be protected by focused regression tests or deterministic grep/static checks.

---

## Repository Map

| Product | Repository | Technical name retained |
| --- | --- | --- |
| preston.ai | `ppodolske/preston-run` | `preston-run` |
| Form | `ppodolske/dose-and-scale` | `dose-and-scale` |
| Atlas | `ppodolske/mnwistateparks` | `mnwistateparks` |
| Archive | `ppodolske/archive` | `archive` / `personal-story-archive` package |

## Version Targets

If no intervening release changes these baselines before implementation:

- preston.ai: **v0.15.0** after v0.14.0.
- Form: **v13.0.0**, reflecting the user-visible product rename from Dose & Scale.
- Atlas: **v2.0.0**, reflecting the user-visible expansion from Parks to Atlas.
- Archive: **v0.9.0**, for Preston-family navigation/branding with no product rename.

If an intervening release lands first, keep the same semantic intent: next preston.ai minor, next Form major, next Atlas major, next Archive minor.

---

### Task 1: Freeze compatibility identifiers and inventory visible branding

**Repositories:**
- `ppodolske/preston-run`
- `ppodolske/dose-and-scale`
- `ppodolske/mnwistateparks`
- `ppodolske/archive`

**Files:**
- Create in preston.ai: `docs/superpowers/rebrand/2026-09-14-product-family-brand-inventory.md`
- Read only during this task: all files matched by the commands below.

**Interfaces:**
- Produces a committed inventory distinguishing `VISIBLE_COPY` from `COMPATIBILITY_IDENTIFIER`.
- Later tasks may change only `VISIBLE_COPY` entries unless this plan explicitly says otherwise.

- [ ] **Step 1: Create working branches from each stable production/default branch**

Use one branch name consistently where repository conventions permit:

```bash
feature/preston-product-family-rebrand
```

For preston.ai, branch from the post-v0.14.0 stable production branch, not from the active v0.14.0 implementation branch.

- [ ] **Step 2: Inventory current visible and technical strings**

Run in `dose-and-scale`:

```bash
git grep -n -E 'Dose & Scale|dose[-_ ]and[-_ ]scale|dose_scale|D&S'
```

Run in `mnwistateparks`:

```bash
git grep -n -E 'Parks|State Parks|mnwistateparks|MN/WI|Minnesota|Wisconsin'
```

Run in `archive`:

```bash
git grep -n -E 'Archive|Private story archive|personal-story-archive|preston'
```

Run in `preston-run`:

```bash
git grep -n -E 'Dose & Scale|Parks|Archive|preston\.ai|Morning Digest'
```

- [ ] **Step 3: Write the inventory with two explicit tables**

The document must classify matches using this rule:

```text
VISIBLE_COPY
  Page titles, headings, nav labels, login copy, footer copy, manifest/app names,
  alt text, accessible product labels, current help copy.

COMPATIBILITY_IDENTIFIER
  Repository names, package names where operationally coupled, route paths,
  cookie names, local/session storage keys, database identifiers, environment
  variables, Railway identifiers, API identifiers, historical release records.
```

Required protected examples include:

```text
ppodolske/dose-and-scale         COMPATIBILITY_IDENTIFIER
ppodolske/mnwistateparks         COMPATIBILITY_IDENTIFIER
dose_scale_session               COMPATIBILITY_IDENTIFIER
personal-story-archive           COMPATIBILITY_IDENTIFIER
```

- [ ] **Step 4: Commit the inventory only**

```bash
git add docs/superpowers/rebrand/2026-09-14-product-family-brand-inventory.md
git commit -m "docs: inventory Preston product branding"
```

---

### Task 2: Add preston.ai family naming configuration and regression tests

**Repository:** `ppodolske/preston-run`

**Files:**
- Modify: `src/branding.js`
- Modify: `src/pages/home.js`
- Modify: the shared authenticated navigation partial/helper identified by Task 1
- Create: `test/product-family-branding.test.js`
- Modify: `test.js`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces canonical labels `preston.ai`, `Home`, `Atlas`, `Form`, `Archive`.
- Produces canonical external/cross-product links from configuration rather than hard-coded route assumptions.

- [ ] **Step 1: Write the failing branding test**

Create `test/product-family-branding.test.js` with assertions equivalent to:

```js
const assert = require('node:assert/strict');
const branding = require('../src/branding');

assert.equal(branding.productName, 'preston.ai');
assert.deepEqual(
  branding.productFamily.map(x => x.label),
  ['Home', 'Atlas', 'Form', 'Archive']
);
assert.equal(branding.productFamily[0].product, 'preston.ai');
assert.equal(branding.productFamily[1].product, 'Atlas');
assert.equal(branding.productFamily[2].product, 'Form');
assert.equal(branding.productFamily[3].product, 'Archive');
```

Also assert that family destinations are drawn from configuration/environment-backed canonical URLs rather than constructed by replacing the current hostname.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
node test/product-family-branding.test.js
```

Expected: FAIL because `productFamily` does not yet exist.

- [ ] **Step 3: Implement the minimal family branding contract**

Extend `src/branding.js` with a stable export shaped like:

```js
productFamily: [
  { key: 'home', product: 'preston.ai', label: 'Home', href: configuredPrestonUrl },
  { key: 'atlas', product: 'Atlas', label: 'Atlas', href: configuredAtlasUrl },
  { key: 'form', product: 'Form', label: 'Form', href: configuredFormUrl },
  { key: 'archive', product: 'Archive', label: 'Archive', href: configuredArchiveUrl }
]
```

Use the repo's established configuration/environment pattern for URLs. Do not invent hostnames inside page renderers.

- [ ] **Step 4: Render the family navigation on authenticated preston.ai pages**

Update the existing shared authenticated navigation path identified by Task 1. The selected state for the preston.ai dashboard is `Home`.

Do not add private summary data to the navigation itself.

- [ ] **Step 5: Update visible preston.ai version/metadata to v0.15.0**

Update the current version sources following the repository's existing release convention. Do not alter schema version unless an unrelated schema migration exists; this rebrand has no database migration.

- [ ] **Step 6: Run focused and full tests**

```bash
node test/product-family-branding.test.js
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/branding.js src/pages test package.json package-lock.json test.js
git commit -m "feat: add Preston product family navigation"
```

---

### Task 3: Rebrand Dose & Scale to Form without changing persistence/auth namespaces

**Repository:** `ppodolske/dose-and-scale`

**Files known from the current branding surface:**
- Modify: `login-wrapper.js`
- Modify: `public/formatting-v12.5.4.js` or its current successor at implementation time
- Modify: `public/insights-ia-v12.5.1.js` or its current successor at implementation time
- Modify: current dashboard HTML/runtime files returned by `git grep -l 'Dose & Scale'`
- Modify: PWA manifest file returned by `find public -maxdepth 2 -iname '*manifest*' -o -iname 'manifest.json'`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `test/form-branding.test.js`
- Modify: test runner wiring according to the repository's current convention

**Protected identifiers:**
- `dose_scale_session`
- existing browser storage keys
- repository name `dose-and-scale`
- existing routes/API paths

**Interfaces:**
- User-facing product name becomes `Form`.
- Descriptor may use `Training and progress` where secondary copy is useful.
- Authentication/persistence remains backward-compatible.

- [ ] **Step 1: Write RED static/runtime branding tests**

The test must verify at minimum:

```js
assert.equal(renderedLogin.includes('Form'), true);
assert.equal(renderedLogin.includes('Dose & Scale'), false);
assert.equal(source.includes("const COOKIE_NAME = 'dose_scale_session'"), true);
```

Also test the browser title generator so the result is:

```text
Form v13.0.0
```

not `Dose & Scale v13.0.0`.

- [ ] **Step 2: Run tests and verify RED**

```bash
npm test
node test/form-branding.test.js
```

Expected: the new branding assertions fail before implementation.

- [ ] **Step 3: Change visible login/header/footer/title copy**

In `login-wrapper.js`, change:

```text
Dose & Scale logo        -> Form logo
Dose & Scale             -> Form
Dose & Scale · private dashboard -> Form · training and progress
```

Keep:

```js
const COOKIE_NAME = 'dose_scale_session';
```

unchanged.

- [ ] **Step 4: Change dashboard title/version generators**

Every current visible title/version string should produce `Form` while legacy storage/runtime identifiers remain stable.

Historical comments such as old-version migration notes may remain unchanged when they describe historical artifacts.

- [ ] **Step 5: Update PWA metadata and install name**

Set manifest-facing names to:

```json
{
  "name": "Form",
  "short_name": "Form"
}
```

Keep current `start_url`, `scope`, icon paths, storage behavior, and service-worker behavior unless a path is broken independently of this rebrand.

- [ ] **Step 6: Bump the visible product version to v13.0.0**

Use the repository's existing version propagation mechanism. Do not reset schema/data versions merely because the product name changed.

- [ ] **Step 7: Run legacy-name safety checks**

```bash
git grep -n 'Dose & Scale'
git grep -n 'dose_scale_session'
```

Expected:

- remaining `Dose & Scale` matches are deliberate historical/migration references only;
- `dose_scale_session` remains present and unchanged.

- [ ] **Step 8: Run the full suite and commit**

```bash
npm test
git add .
git commit -m "feat: rebrand Dose & Scale as Form"
```

---

### Task 4: Rebrand the parks product to Atlas while retaining Parks as a content category

**Repository:** `ppodolske/mnwistateparks`

**Files:**
- Modify: `app-runtime.js`
- Modify: `app.js`
- Modify: current page/template files containing the top-level product lockup, as identified by Task 1
- Modify: current manifest/metadata files identified by Task 1
- Modify: current CSS only where needed for the longer/new lockup; do not perform an unrelated redesign
- Create: `test/atlas-branding.test.js` if the repository test layout supports Node tests; otherwise add the equivalent existing static test file and wire it into the repo's test command
- Modify: `package.json` if present/currently used for test/version scripts

**Interfaces:**
- Top-level product becomes `Atlas`.
- Park-specific labels continue to say `Park`, `Parks`, `State Park`, etc. where they describe actual park content.
- Public park routes remain public.

- [ ] **Step 1: Write a failing distinction test**

Test both sides of the naming rule:

```js
assert.match(appShell, /Atlas/);
assert.doesNotMatch(appShell, /class=["'][^"']*brand[^"']*["'][^>]*>\s*Parks\s*</i);
assert.match(parkDetail, /Park/);
```

Also assert that the public-route/access configuration is unchanged by the branding patch.

- [ ] **Step 2: Run RED**

Run the repository's current test command plus the focused branding test.

Expected: FAIL on the new Atlas branding assertions.

- [ ] **Step 3: Replace only top-level product identity copy**

Change app/header/browser/PWA identity from the current Parks branding to `Atlas`.

Do **not** mechanically replace every occurrence of `Parks`; park collection headings and park-domain language remain correct.

- [ ] **Step 4: Add descriptor only where the existing layout has secondary brand copy**

Preferred secondary copy:

```text
Places and journeys
```

Do not add a tagline where the current UI has no need for one.

- [ ] **Step 5: Preserve public/private behavior**

Run the existing public-page tests and add a regression proving a representative public park page remains accessible without an authenticated preston.ai session.

- [ ] **Step 6: Bump the Atlas-facing version to v2.0.0**

Follow the repo's existing version mechanism and release-note convention.

- [ ] **Step 7: Run the full suite and commit**

```bash
npm test
git add .
git commit -m "feat: rebrand Parks as Atlas"
```

If the repository does not expose `npm test`, run its actual existing verification command documented by the repo and record that command in the implementation PR.

---

### Task 5: Apply Preston-family treatment to Archive without renaming Archive

**Repository:** `ppodolske/archive`

**Files:**
- Modify: `app/layout.tsx`
- Modify: shared header/navigation component identified by `git grep -l 'Archive' app components`
- Modify: `app/preston-theme.css` only if required for the shared family nav/selected state
- Create: `test/archive-branding.test.tsx` or the repository's equivalent Vitest path
- Modify: package/version metadata in `package.json` and `package-lock.json`

**Interfaces:**
- Product remains `Archive`.
- Existing metadata continues to be `noindex`.
- Family navigation labels match `Home · Atlas · Form · Archive`.

- [ ] **Step 1: Write RED metadata/navigation tests**

Assert the existing metadata contract remains:

```ts
expect(metadata.title).toEqual({
  default: 'Archive',
  template: '%s · Archive',
});
expect(metadata.robots).toEqual({ index: false, follow: false });
```

Add a component-level assertion that the family navigation labels are exactly:

```ts
['Home', 'Atlas', 'Form', 'Archive']
```

and that Archive is selected on Archive pages.

- [ ] **Step 2: Run focused tests and verify RED only for the new family-navigation behavior**

```bash
npm test -- archive-branding
```

The existing Archive name/noindex assertions should already pass; family navigation should fail until implemented.

- [ ] **Step 3: Add the shared family navigation/lockup**

Keep the existing Archive title and private-story purpose. Do not rename `personal-story-archive` in `package.json`; it is a technical package identifier.

- [ ] **Step 4: Preserve privacy metadata**

`app/layout.tsx` must continue to contain:

```ts
robots: { index: false, follow: false }
```

- [ ] **Step 5: Bump Archive to v0.9.0**

Change only user/release version metadata; do not alter archive IDs, storage object keys, or Prisma schema names for branding.

- [ ] **Step 6: Run tests/build and commit**

```bash
npm test
npm run build
git add .
git commit -m "feat: align Archive with Preston product family"
```

---

### Task 6: Add configured cross-product destinations consistently

**Repositories:** all four

**Files:**
- preston.ai: existing config module plus `src/branding.js`
- Form: `login-wrapper.js` and current shared app-shell/runtime file
- Atlas: current shared app-shell/runtime file
- Archive: shared header/navigation component
- Environment example/documentation files in each repo if they already exist

**Interfaces:**
- Each app can link to canonical Preston family destinations without guessing hostnames.
- No app requires all four products to share a domain.

- [ ] **Step 1: Add failing tests for URL configuration fallback behavior**

For each repo, test that the app accepts configured destinations for:

```text
PRESTON_HOME_URL
PRESTON_ATLAS_URL
PRESTON_FORM_URL
PRESTON_ARCHIVE_URL
```

If a repository already has a naming convention for public runtime config, map these concepts into that existing convention instead of creating a competing configuration system.

- [ ] **Step 2: Implement URL configuration through each repo's established config boundary**

Do not expose secrets; these are public navigation destinations.

- [ ] **Step 3: Render family links using configured URLs**

Do not construct links by string replacement on `window.location.host`.

- [ ] **Step 4: Verify selected state and link behavior in each app**

Check:

```text
preston.ai -> Home selected
Atlas      -> Atlas selected
Form       -> Form selected
Archive    -> Archive selected
```

- [ ] **Step 5: Commit once per repository**

Use repository-specific commits such as:

```text
feat: configure Preston family links
```

---

### Task 7: Align metadata, icons, accessibility labels, and PWA names

**Repositories:** all four

**Files:**
- Current manifest files
- Current HTML/Next metadata definitions
- Current favicon/app-icon references
- Header logo `alt` text and accessible product labels

**Interfaces:**
- Visible metadata matches product identity.
- Existing icon files may be retained if already part of the approved Preston family; this task does not require new artwork.

- [ ] **Step 1: Add static metadata assertions**

Required user-facing values:

```text
preston.ai -> preston.ai
Atlas      -> Atlas
Form       -> Form
Archive    -> Archive
```

- [ ] **Step 2: Update manifest/browser titles and alt text**

Do not change icon URLs unless an actual replacement asset is part of the reviewed implementation.

- [ ] **Step 3: Verify installed-PWA labels for preston.ai/Form/Atlas where applicable**

Confirm manifests keep existing `start_url` and `scope` values unless a functional bug is separately demonstrated.

- [ ] **Step 4: Verify Archive remains noindex**

Run the Archive metadata test from Task 5.

- [ ] **Step 5: Commit per repository**

Keep commits narrow enough to revert metadata/icon work independently of application copy if needed.

---

### Task 8: Run legacy-name and compatibility regression gates

**Repositories:** all four

**Files:**
- No production files should be introduced in this task unless a gate exposes a defect.
- Add/update static safety tests in the affected repo when a defect is found.

**Interfaces:**
- Proves the rebrand changed identity without breaking storage/auth/routing.

- [ ] **Step 1: Search for unintended legacy visible names**

```bash
# Form
git grep -n 'Dose & Scale'

# Atlas
# Review top-level product lockups manually; do not ban the word Parks globally.
git grep -n -E '>[^<]*(Parks|State Parks)[^<]*<' -- '*.html' '*.js' '*.jsx' '*.ts' '*.tsx'
```

Every remaining match must be classified as one of:

```text
historical
feature/category language
compatibility identifier
bug
```

Fix every `bug` classification.

- [ ] **Step 2: Prove compatibility identifiers were not renamed**

At minimum verify:

```bash
# Form
git grep -n 'dose_scale_session'

# All repos
git diff <pre-rebrand-base>...HEAD -- package.json '*.sql' '.env*'
```

Review the diff for accidental database, cookie, route, API, storage, or infrastructure renames.

- [ ] **Step 3: Run all automated suites**

```text
preston-run       npm test
dose-and-scale    npm test
archive           npm test && npm run build
mnwistateparks    repository's current full verification command
```

- [ ] **Step 4: Do desktop/mobile/PWA smoke tests**

For every product verify:

- correct product name;
- correct selected family-nav item;
- all four family links resolve;
- no horizontal nav overflow at mobile width;
- authentication remains intact;
- back/forward navigation works across external product links;
- installed app/PWA name is correct where applicable.

For Atlas additionally verify:

- representative public park page works signed out;
- public page reveals no private Preston data.

For Form additionally verify:

- an existing authenticated session still works through the unchanged cookie namespace;
- existing local/browser data loads without migration.

For Archive additionally verify:

- story listing/detail/edit/archive behavior is unchanged;
- metadata remains noindex.

---

### Task 9: Stage deployment and release verification

**Repositories:** all four

**Files:**
- Release notes/changelog files according to each repository's current convention
- No schema migration files

**Interfaces:**
- Produces independently deployable releases with safe rollback.

- [ ] **Step 1: Confirm preston.ai v0.14.0 gates are complete**

Do not proceed if PR #28 or its successor is still mid-release or production is not stable.

- [ ] **Step 2: Deploy preston.ai family navigation first**

Target: v0.15.0 or the next minor if an intervening release moved the baseline.

Verify the old product links still work even before the peer apps are renamed.

- [ ] **Step 3: Deploy Form**

Target: v13.0.0 or the next major rebrand release.

Verify existing sessions/data before moving on.

- [ ] **Step 4: Deploy Atlas**

Target: v2.0.0 or the next major rebrand release.

Verify public signed-out park access before moving on.

- [ ] **Step 5: Deploy Archive**

Target: v0.9.0 or the next minor.

Verify noindex and story workflows.

- [ ] **Step 6: Run final cross-product smoke test from preston.ai Home**

Visit in order:

```text
Home -> Atlas -> Form -> Archive -> Home
```

Confirm labels, destinations, authentication behavior, and back navigation.

- [ ] **Step 7: Record final release mapping in preston.ai documentation**

Add a short table listing the live product family and deployed versions. Do not rename repositories in documentation; show product name and repository side-by-side.

---

## Release Gates

The rebrand may be considered complete only when all of the following are true:

- [ ] preston.ai v0.14.0 release gates were completed before rebrand deployment.
- [ ] `Home · Atlas · Form · Archive` appears consistently in authenticated family navigation.
- [ ] Form no longer presents itself as Dose & Scale in current user-facing UI.
- [ ] Atlas no longer presents Parks as the overall product name.
- [ ] Park-specific `Parks` language remains semantically correct.
- [ ] Archive is still Archive and remains `noindex`.
- [ ] `dose_scale_session` and other compatibility identifiers remain stable.
- [ ] No repository, Railway, database, API, route, cookie, or storage rename was performed solely for branding.
- [ ] Public Atlas park pages still work without authentication.
- [ ] All four repository test suites/build gates pass.
- [ ] Cross-product navigation works on desktop and mobile.
- [ ] Installed/PWA names are correct where applicable.
- [ ] Final release/version mapping is documented.

## Execution Recommendation

Use **subagent-driven development** after review because the work naturally separates by repository and each product can receive an independent implementation/review cycle. Keep deployment staged in the order defined above rather than combining all four products into one release event.
