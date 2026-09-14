# Repository & Deployment Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ambiguous multi-branch Preston deployment model with a private `ppodolske/preston-platform` monorepo whose canonical `main` contains preston.ai and Form, is CI-gated, deploys safely to Railway, and preserves explicit rollback paths throughout migration.

**Architecture:** First anchor the exact Railway production deployment and canonicalize the two existing source lines independently. Then import verified preston.ai and reconciled Form trees into an npm-workspaces monorepo, add a narrow shared `fitness-context` package and path-aware CI, prove the monorepo in UAT, and only then repoint production. Archive and Parks remain separate and are hardened after the core cutover is verified.

**Tech Stack:** Node.js 22, npm workspaces, GitHub Actions, GitHub branch/ruleset controls, Railway, Express, PostgreSQL, Supabase, existing Preston/Form test harnesses.

**Spec:** `docs/superpowers/specs/2026-09-15-repository-deployment-foundation-design.md`

## Global Constraints

- Do not begin preston.ai v0.15 implementation until this foundation is complete and stable.
- New core repository: `ppodolske/preston-platform`, private.
- Core layout: `apps/preston-ai`, `apps/form`, `packages/fitness-context`, `docs/superpowers`, `.github`.
- Core branch model: `main`, `feature/*`, `fix/*`, `ops/*`; no permanent version-number branches.
- Normal feature/fix merges use squash merge.
- Archive (`ppodolske/archive`) and Parks (`ppodolske/mnwistateparks`) remain separate repositories.
- npm workspaces are the initial build system; do not add Nx/Turborepo unless implementation evidence requires it.
- Production behavior must not change in Checkpoint A / Phase 0.
- Never force-overwrite an independently advanced `main`; stop and reconcile if ancestry changes.
- Do not fix the known weight-trend defect during repository reconciliation. Preserve it as a deliberate later TDD change.
- Do not delete old repos, production branches, rollback refs, or old Railway services before cutover verification.
- New root `.gitignore` must include `node_modules/`, `.env`, `.env.*`, `!.env.example`, `*.pem`, `*.key`, `credentials*.json`, `service-account*.json`, `coverage/`, `playwright-report/`, `test-results/`, `.DS_Store`, `.superpowers/`.
- Secret scan imported source before the new repository becomes canonical.
- Production Railway must be CI-gated (`checkSuites: true`) or auto-deploy must be disabled in favor of an explicit verified deployment workflow.
- Remove `npm run job:gmail:booking-enrichment -- --dry-run` only after the monorepo deployment path is verified.
- UAT must become a separate Railway environment with no production mutation authority.
- Every checkpoint ends with an explicit verification record before the next checkpoint starts.

## Planning-time observations (not rollback anchors)

These values were re-read while writing this plan and must be re-read at execution time:

- `preston-run/main`: `754d447bc5577b3d27cb275276e3e2b7ee6d5bed`.
- `preston-run/build/preston-ai-v0.11.0`: `bf55df6298b95b7523d2b004dfee4366f61e9080`.
- Current comparison: production branch is 630 commits ahead of `main`, 0 behind.
- `dose-and-scale/main`: `86ac6af8bca99cdd11ec27e6c53c0f32f7aad44f` at compare time.
- Form integration versus main: diverged, integration 17 ahead / 4 behind; merge base `2bad7e56ee1ab141afe52751116eb0590d8be268`.
- Main-only Form surface since divergence: `package.json`, `server.js`, `test/runtime-injection.test.js`.
- Integration-only Preston surface includes `.github/workflows/ci.yml`, `lib/preston-context.js`, `lib/preston-gateway.js`, `lib/preston-service.js`, gateway/server wiring, and three Preston tests plus `test/run.js`.

---

### Task 1: Checkpoint A — Freeze and capture exact production state

**Files:**
- Create: `docs/superpowers/release-notes/2026-09-15-repository-foundation-baseline.md` on the migration/docs branch.
- No production source files modified.

**Interfaces:**
- Consumes: Railway production project `52e3a022-86d8-4191-bf3b-e4250d484055`, environment `e7396e86-8acb-4f59-92c7-9a9e4554fecf`, hub service `5d24e3e7-ade6-4ab8-8e44-36863f698078`.
- Produces: immutable production recovery tag/ref, captured service source/config manifest, exact Form branch-head manifest, and a written baseline record used by every later checkpoint.

- [ ] **Step 1: Read Railway’s active hub source and latest successful production deployment SHA**

Record repo, branch, deployment commit SHA, deployment status, root directory, start command, pre-deploy command, watch paths, cron/schedule metadata, domains, and `checkSuites` state.

Expected: source is still `ppodolske/preston-run` / `build/preston-ai-v0.11.0`; do not infer the deployment SHA from the branch head.

- [ ] **Step 2: Verify production health before mutation**

Check the currently deployed hub health endpoint and Railway deployment health. Record the returned app version and deployment SHA.

Expected: healthy deployment. If unhealthy, stop foundation work and repair/understand production first.

- [ ] **Step 3: Re-read GitHub branch heads and ancestry**

```bash
PROD_BRANCH=build/preston-ai-v0.11.0
# Equivalent connector/API operations are acceptable.
git rev-parse origin/main
git rev-parse origin/$PROD_BRANCH
git merge-base origin/main origin/$PROD_BRANCH
git rev-list --left-right --count origin/main...origin/$PROD_BRANCH
```

Expected at execution start: merge-base equals `main`, left count `0`, right count positive. If not, stop before canonicalization.

- [ ] **Step 4: Create immutable recovery references at the exact Railway-deployed SHA**

Create both:

```text
production/pre-repository-foundation
repository-foundation/pre-cutover-backup
```

The tag is the immutable human-facing rollback anchor. The backup branch/ref is an operational convenience. Both must point to the Railway-deployed SHA, not merely the latest production-branch head.

- [ ] **Step 5: Capture Railway hub and scheduled-service source/config**

Record every active preston.ai production service/job that sources `ppodolske/preston-run`, including service ID, repo, branch, root, start/pre-deploy command, cron, watch paths, domains, and whether it mutates production data. Explicitly include the old `v0140-enrichment-apply-once`, UAT smoke services, and duplicate schedule candidates without deleting anything.

- [ ] **Step 6: Capture Form branch heads and divergence**

```bash
git rev-parse origin/main
git rev-parse origin/build/preston-ai-v0.11.0-integration
git merge-base origin/main origin/build/preston-ai-v0.11.0-integration
git rev-list --left-right --count origin/main...origin/build/preston-ai-v0.11.0-integration
```

- [ ] **Step 7: Write and commit the baseline record**

The record must include the exact production SHA, recovery refs, branch heads, compare counts, Railway service matrix, known permanent pre-deploy command, and a statement that no production behavior changed in Checkpoint A.

Commit:

```bash
git add docs/superpowers/release-notes/2026-09-15-repository-foundation-baseline.md
git commit -m "docs: capture repository foundation production baseline"
```

**Checkpoint A gate:** exact production SHA is written and recoverable; health is green; no deployment source/config has changed.

---

### Task 2: Checkpoint B — Canonicalize `preston-run/main` to the known-good production line

**Files:**
- Existing source tree unchanged in content.
- Git ref modified: `ppodolske/preston-run/main` only through a verified fast-forward.

**Interfaces:**
- Consumes: Checkpoint A deployed SHA and branch ancestry.
- Produces: `main` whose tree equals the verified production-branch tree, while the old production branch remains available.

- [ ] **Step 1: Re-check ahead-only ancestry immediately before promotion**

Expected:

```text
behind_by(main <- production) = 0
merge_base = main
```

If `main` has new independent commits, stop and create a reconciliation branch; never use force.

- [ ] **Step 2: Verify the production head with the existing clean CI contract**

Run from the exact production-branch head:

```bash
npm ci --no-audit --no-fund
npm test
node --check server.js
node --check src/data/fitness-context.js
node --check src/services/dose-scale-client.js
node --check src/services/fitness-context.js
node --check src/domain/morning-digest.js
node --check src/jobs/fitness-context-sync.js
node --check src/pages/home.js
node --check src/pages/calendar-view.js
node --check src/routes/site.js
node --check src/routes/calendars.js
node --check src/domain/calendars.js
node --check src/jobs/reminders.js
node --check src/jobs/calendar-sync.js
node --check src/routes/bookings.js
node --check src/domain/gmail-booking-extractor.js
node --check src/domain/trip-linker.js
node --check src/services/gmail-booking-actions.js
node --check src/services/gmail-trip-reconstruction.js
node --check src/jobs/gmail-trip-reconstruction.js
```

Also require the GitHub CI check for that SHA to be successful when available. If no reusable successful check exists, trigger a controlled CI verification without changing production behavior.

- [ ] **Step 3: Re-check Railway health on the same verified line**

Expected: currently deployed production SHA is healthy. A branch head newer than the deployed SHA must not silently become the recovery anchor.

- [ ] **Step 4: Fast-forward `main` to the verified production-branch head**

Equivalent Git operation:

```bash
git checkout main
git merge --ff-only origin/build/preston-ai-v0.11.0
git push origin main
```

Do not force push.

- [ ] **Step 5: Verify identity after promotion**

```bash
git rev-parse origin/main
git rev-parse origin/build/preston-ai-v0.11.0
git diff --exit-code origin/main origin/build/preston-ai-v0.11.0
```

Expected: same commit/tree, zero diff.

- [ ] **Step 6: Leave the old production branch intact**

Do not repoint Railway yet and do not delete `build/preston-ai-v0.11.0`.

**Checkpoint B gate:** `preston-run/main` is the canonical known-good tree and the old production branch remains a rollback/reference source.

---

### Task 3: Checkpoint C — Reconcile Form `main` and Preston integration deliberately

**Files:**
- Modify: `package.json`
- Modify: `server.js`
- Modify: `login-wrapper.js`
- Create/preserve: `lib/preston-context.js`
- Create/preserve: `lib/preston-gateway.js`
- Create/preserve: `lib/preston-service.js`
- Create/preserve: `.github/workflows/ci.yml`
- Preserve: `test/runtime-injection.test.js`
- Create/preserve: `test/preston-context.test.js`
- Create/preserve: `test/preston-gateway.test.js`
- Create/preserve: `test/preston-service.test.js`
- Modify/create: `test/run.js`

**Interfaces:**
- Consumes: Form `main` as the UI/runtime baseline and `build/preston-ai-v0.11.0-integration` as the Preston integration source.
- Produces: one green Form `main` with both behavior lines preserved and the weight-trend bug intentionally unchanged.

- [ ] **Step 1: Create reconciliation branch from Form `main`**

```text
ops/repository-foundation-form-reconcile
```

- [ ] **Step 2: Preserve main runtime behavior first**

Use current `main` as authoritative for the current application assets/runtime injection behavior. In particular, retain `test/runtime-injection.test.js` and the current `server.js` asset injection list rather than reverting to the older integration-line list.

- [ ] **Step 3: Add Preston service endpoint wiring from the integration line**

`server.js` must include:

```js
const { prestonBearerAuth, createPrestonContextHandler } = require('./lib/preston-service');
...
app.get(
  '/api/preston/daily-context',
  prestonBearerAuth(process.env.PRESTON_SERVICE_TOKEN || ''),
  createPrestonContextHandler({ pool })
);
```

Place this route before the normal Form Basic-auth middleware exactly as the integration contract requires.

- [ ] **Step 4: Add gateway pass-through logic without removing current login behavior**

`login-wrapper.js` keeps current cookie/login/session behavior and adds the integration branch’s `classifyGatewayRequest` / `buildProxyHeaders` behavior so `/api/preston/daily-context` can preserve the bearer `Authorization` header while normal Form traffic remains protected by the existing session/Basic path.

- [ ] **Step 5: Merge the test runners rather than choosing one**

Set `npm test` to a runner that executes:

```text
test/runtime-injection.test.js
test/preston-context.test.js
test/preston-gateway.test.js
test/preston-service.test.js
```

A concrete `test/run.js` implementation should require each test file or spawn Node for each and fail on the first non-zero exit. Do not drop the runtime-injection test.

- [ ] **Step 6: Keep the current numeric helper behavior unchanged during reconciliation**

`lib/preston-context.js` retains the current implementation:

```js
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
```

Do not add blank/null handling in this task. The later v0.16 TDD fix will change this deliberately.

- [ ] **Step 7: Run clean Form verification**

```bash
npm ci --no-audit --no-fund
npm test
node --check server.js
node --check login-wrapper.js
node --check lib/preston-context.js
node --check lib/preston-service.js
node --check lib/preston-gateway.js
```

Expected: all tests pass.

- [ ] **Step 8: Open a reconciliation PR to Form `main`, wait for green CI, and merge**

PR title:

```text
ops: reconcile Form main with Preston context integration
```

Use a normal merge commit if preserving both branch ancestries materially improves migration traceability; otherwise squash is acceptable. Record resulting canonical Form `main` SHA.

**Checkpoint C gate:** Form has one canonical green `main`; current UI/runtime behavior and Preston context/service/gateway tests all exist; weight-trend bug remains unchanged.

---

### Task 4: Checkpoint D — Create private `ppodolske/preston-platform` and workspace skeleton

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `.gitignore`
- Create: `README.md`
- Create: `apps/preston-ai/**` from canonical `preston-run/main`
- Create: `apps/form/**` from canonical Form `main`
- Create: `packages/fitness-context/package.json`
- Create: `packages/fitness-context/src/index.js`
- Create: `packages/fitness-context/test/contracts.test.js`
- Copy: `docs/superpowers/specs/2026-09-15-repository-deployment-foundation-design.md`
- Copy: `docs/superpowers/plans/2026-09-15-repository-deployment-foundation.md`

**Interfaces:**
- Consumes: canonical app SHAs from Checkpoints B/C.
- Produces: private monorepo candidate that can install and run each app independently from root workspaces.

- [ ] **Step 1: Create the new repository private with default branch `main`**

Repository: `ppodolske/preston-platform`.

Verify `private: true` before importing any source.

- [ ] **Step 2: Import canonical app trees under stable paths**

```text
apps/preston-ai/
apps/form/
```

Do not import `.git` metadata, local env files, credentials, node_modules, coverage, test artifacts, or `.superpowers/` scratch data.

- [ ] **Step 3: Add root npm workspace definition**

Root `package.json`:

```json
{
  "name": "preston-platform",
  "private": true,
  "workspaces": [
    "apps/preston-ai",
    "apps/form",
    "packages/fitness-context"
  ],
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "test:preston-ai": "npm test --workspace apps/preston-ai",
    "test:form": "npm test --workspace apps/form",
    "test:fitness-context": "npm test --workspace packages/fitness-context",
    "test": "npm run test:fitness-context && npm run test:form && npm run test:preston-ai"
  }
}
```

If npm requires workspace names rather than paths for a command on the actual imported package metadata, use the package names but preserve these three root script responsibilities.

- [ ] **Step 4: Harden root ignores**

Root `.gitignore` must contain at least:

```gitignore
node_modules/
.env
.env.*
!.env.example
*.pem
*.key
credentials*.json
service-account*.json
coverage/
playwright-report/
test-results/
.DS_Store
.superpowers/
```

- [ ] **Step 5: Add repository boundary documentation**

`README.md` must state:

```text
apps/preston-ai = personal OS consumer/presentation + integrations
apps/form = fitness/training producer
packages/fitness-context = narrow shared contract utilities/fixtures
archive = separate repo
parks = separate repo
main = only canonical production candidate
```

Also document `feature/*`, `fix/*`, `ops/*` and no permanent version branches.

- [ ] **Step 6: Generate one root lockfile from a clean workspace install**

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
npm install --package-lock-only
npm ci --no-audit --no-fund
```

Keep app lockfiles only if npm workspace behavior requires them; prefer one canonical root lockfile.

- [ ] **Step 7: Run the imported apps before shared refactoring**

```bash
npm run test:preston-ai
npm run test:form
```

Expected: migration import is behavior-preserving before shared-package changes.

- [ ] **Step 8: Run a secret scan over the imported candidate**

Use an available scanner such as Gitleaks or GitHub secret scanning over the working tree/history being introduced. Any positive match must be investigated before proceeding. Do not make the monorepo canonical with unresolved secrets.

Commit the import as a traceable migration commit including the two source SHAs in the body.

**Checkpoint D gate:** private monorepo exists, clean root install works, both imported app suites pass, secret scan has no unresolved findings.

---

### Task 5: Checkpoint D2 — Create the narrow `fitness-context` shared contract without fixing v0.16

**Files:**
- Create: `packages/fitness-context/package.json`
- Create: `packages/fitness-context/src/numeric.js`
- Create: `packages/fitness-context/src/schema.js`
- Create: `packages/fitness-context/src/fixtures.js`
- Create: `packages/fitness-context/src/index.js`
- Create: `packages/fitness-context/test/numeric.test.js`
- Create: `packages/fitness-context/test/schema.test.js`
- Modify: `apps/form/lib/preston-context.js`
- Add/modify: preston.ai contract test under `apps/preston-ai/test/fitness-context-contract.test.js`

**Interfaces:**
- Produces:
  - `coerceFiniteNumber(value): number|null` — migration-fidelity numeric coercion matching current Form semantics for this foundation release.
  - `validateDailyContext(value): { ok: true, value } | { ok: false, errors: string[] }`.
  - deterministic producer/consumer fixture objects.
- Consumes: Form daily-context shape and preston.ai consumer expectations.

- [ ] **Step 1: Write shared numeric migration-fidelity tests**

Test only the semantics required to move the existing helper without changing the known defect:

```js
assert.equal(coerceFiniteNumber('84.5'), 84.5);
assert.equal(coerceFiniteNumber(0), 0);
assert.equal(coerceFiniteNumber('not-a-number'), null);
```

Add a prominent comment in the test and implementation:

```text
Repository-foundation migration fidelity only. Blank/null coercion is a known defect tracked for v0.16 and is intentionally not corrected in this migration.
```

Do not add an assertion that legitimizes blank/null => 0 as desired behavior.

- [ ] **Step 2: Run the numeric test and verify it fails because the package does not exist**

```bash
npm run test:fitness-context
```

Expected: FAIL on missing implementation.

- [ ] **Step 3: Implement the minimal current-semantics helper**

```js
function coerceFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
```

This is intentionally the current behavior, not the v0.16 fix.

- [ ] **Step 4: Define schema validation around the existing daily-context contract**

Validate top-level `schemaVersion`, timestamps/nullability, `recovery`, `baseline`, `weightTrend`, `recentTraining`, `phase`, `intervention`, `plannedWorkouts`, and `actualActivities` with deterministic error strings. Do not introduce a new schema version in this migration unless the imported producer already requires it.

- [ ] **Step 5: Add one valid fixture and one invalid fixture used by both apps**

The valid fixture must include a legitimate numeric zero in at least one non-weight field to ensure zero remains representable. The invalid fixture must violate a required shape/type and be rejected deterministically.

- [ ] **Step 6: Wire Form’s daily-context helper to the shared numeric export**

Replace the local `num` implementation with a small import/alias, without changing call sites or resulting output.

- [ ] **Step 7: Add preston.ai consumer contract test against the shared valid fixture**

The consumer test must prove the fixture can flow through the current fitness-context presentation/service contract without schema drift.

- [ ] **Step 8: Run all affected suites**

```bash
npm run test:fitness-context
npm run test:form
npm run test:preston-ai
```

Expected: PASS and no weight-trend behavior change.

Commit:

```text
refactor: add shared fitness context contract
```

**Checkpoint D2 gate:** shared package exists and is consumed across the app boundary without changing the known weight bug.

---

### Task 6: Checkpoint D3 — Add path-aware monorepo CI and full-core verification

**Files:**
- Create: `.github/workflows/ci.yml`
- Optionally create: `scripts/ci/affected.mjs` only if workflow-native path filters are insufficient.

**Interfaces:**
- Consumes: npm workspace scripts from Task 4.
- Produces: required status jobs whose names can be referenced by branch protection and Railway check-suite gating.

- [ ] **Step 1: Create a path-classification job**

Classify changes into `preston_ai`, `form`, `fitness_context`, and `root`. Root includes at least root `package.json`, root lockfile, `.github/workflows/**`, and shared CI/build scripts.

- [ ] **Step 2: Add clean-install app jobs**

Each job begins with Node 22 and:

```bash
npm ci --no-audit --no-fund
```

Jobs:

```text
preston-ai-ci
form-ci
fitness-context-ci
full-core-ci
```

- [ ] **Step 3: Encode affected-surface rules**

```text
apps/preston-ai/** -> preston-ai-ci
apps/form/** -> form-ci
packages/fitness-context/** -> fitness-context-ci + form-ci + preston-ai-ci
root/workspace/build config -> full-core-ci
```

`full-core-ci` runs `npm test` plus the preston.ai syntax checks inherited from its current CI.

- [ ] **Step 4: Make skipped/irrelevant paths branch-protection-safe**

Required checks must resolve successfully for PRs even when an app is unaffected; do not configure a required job that simply never appears for docs-only PRs.

- [ ] **Step 5: Verify CI with one change in each path class**

Create temporary commits/PR updates touching docs/app/shared/root as needed and confirm only the intended suites run, while required aggregate status remains green.

**Checkpoint D3 gate:** clean-checkout GitHub CI is green and has stable required-check names suitable for protection and Railway gating.

---

### Task 7: Checkpoint E — Validate monorepo apps without changing production

**Files:**
- No production source/config mutation required.
- Update migration verification record in `docs/superpowers/release-notes/2026-09-15-repository-foundation-baseline.md` or a new cutover log in the monorepo.

**Interfaces:**
- Consumes: green monorepo `main` candidate.
- Produces: evidence that the new repo reproduces app behavior before any Railway source cutover.

- [ ] **Step 1: Clean install and full core suite**

```bash
npm ci --no-audit --no-fund
npm test
```

- [ ] **Step 2: Verify preston.ai app-specific smoke contract**

Run/start preston.ai from its workspace and verify `/health`, version sanity, authenticated landing behavior, job entry points, and config loading without printing secrets.

- [ ] **Step 3: Verify Form app-specific smoke contract**

Run/start Form from its workspace and verify `/health`, login gateway, `/api/preston/daily-context` bearer path, runtime asset injection, and existing state API behavior.

- [ ] **Step 4: Verify package resolution from the actual workspace root**

Both apps must resolve `packages/fitness-context` in the same layout Railway will build. No hidden local symlink/manual copy may be required.

**Checkpoint E gate:** candidate is green in repository CI and local/isolated app smoke tests; production still points to old repos.

---

### Task 8: Checkpoint F — Create true Railway UAT environment and cut UAT to monorepo first

**Files:**
- Railway environment/service configuration only.
- No production environment source change.

**Interfaces:**
- Consumes: verified monorepo `main` SHA.
- Produces: isolated `uat` environment using the new source layout and non-production credentials.

- [ ] **Step 1: Create or verify Railway `uat` environment under `Preston.run`**

Do not model UAT as another service inside production.

- [ ] **Step 2: Configure UAT preston.ai source**

```text
repo: ppodolske/preston-platform
branch: main
rootDirectory: apps/preston-ai
checkSuites: true
```

Set watch paths for `apps/preston-ai/**`, `packages/fitness-context/**`, and root workspace/lockfile files using Railway’s validated syntax.

- [ ] **Step 3: Configure UAT Form source**

```text
repo: ppodolske/preston-platform
branch: main
rootDirectory: apps/form
```

Watch `apps/form/**`, `packages/fitness-context/**`, and root workspace/lockfile files.

- [ ] **Step 4: Bind only UAT-safe credentials**

UAT Supabase/credentials must be distinct where applicable. Gmail mutation authority must be absent. Any integration requiring production credentials is either read-only by design or disabled in UAT.

- [ ] **Step 5: Deploy the same candidate SHA to UAT and verify**

Verify Railway reports the intended monorepo commit SHA, `/health` succeeds, app authentication works, Form context endpoint works, and no production data mutation occurred.

**Checkpoint F gate:** UAT runs successfully from monorepo `main`; production is still untouched.

---

### Task 9: Checkpoint G — Cut production Railway services to monorepo safely

**Files:**
- Railway production service source/config only.
- Old repo/branch/services remain intact.

**Interfaces:**
- Consumes: exact UAT-verified monorepo SHA and Checkpoint A recovery manifest.
- Produces: production services sourcing `preston-platform/main` with app roots/watch boundaries and verified commit identity.

- [ ] **Step 1: Re-verify production health and candidate SHA immediately before cutover**

Record old healthy deployment SHA and new monorepo target SHA side by side.

- [ ] **Step 2: Repoint the primary hub source without deleting the old service**

Target:

```text
repo: ppodolske/preston-platform
branch: main
rootDirectory: apps/preston-ai
checkSuites: true
```

Preserve domains, env vars, schedules, volumes/network settings, and start command semantics.

- [ ] **Step 3: Apply preston.ai watch boundaries**

Watch only preston.ai, shared fitness-context, and root workspace/lockfile paths. A Form-only commit must not redeploy the hub.

- [ ] **Step 4: Repoint each permanent preston.ai scheduled service deliberately**

For every service captured in Checkpoint A, preserve schedule and command while moving source/root to the monorepo. Do not move obsolete one-shot/duplicate services into the permanent set merely because they exist.

- [ ] **Step 5: Repoint production Form service**

Target `preston-platform/main`, root `apps/form`, Form/shared/root watch paths. Preserve its domain and runtime secrets.

- [ ] **Step 6: Verify deployed SHA identity and health per service**

For each moved service, Railway’s deployed commit must equal the intended monorepo `main` SHA. Verify primary domains and scheduled-entry commands resolve.

- [ ] **Step 7: Exercise rollback procedure without destructive deletion**

Document the exact source settings required to return hub/Form to their old repositories and the `production/pre-repository-foundation` anchor. Do not actually roll back a healthy cutover merely to prove deletion/recreation.

**Checkpoint G gate:** production is healthy on monorepo `main`, deployed SHA is known, domains/schedules are preserved, old sources still exist as rollback paths.

---

### Task 10: Checkpoint H — Remove obsolete v0.14 deploy gate and enforce canonical deployment integrity

**Files:**
- Railway hub pre-deploy configuration.
- Repository settings/rulesets for `ppodolske/preston-platform`.

**Interfaces:**
- Consumes: healthy production monorepo cutover.
- Produces: no permanent v0.14 diagnostic gate, protected canonical `main`, CI-gated production behavior.

- [ ] **Step 1: Remove the permanent booking-enrichment dry-run**

Delete:

```text
npm run job:gmail:booking-enrichment -- --dry-run
```

from permanent hub pre-deploy configuration.

Do not remove the job code itself if it remains useful for manual diagnostics.

- [ ] **Step 2: Redeploy/verify hub without the obsolete pre-deploy gate**

Expected: normal app start succeeds and deployment no longer depends on Gmail booking enrichment.

- [ ] **Step 3: Enable monorepo merge settings**

Configure normal default to squash merge and automatically delete merged head branches.

- [ ] **Step 4: Protect `main`**

Require PRs, zero approvals, required CI checks, up-to-date branch where supported, no force pushes, no branch deletion, no routine direct pushes.

- [ ] **Step 5: Verify Railway check-suite behavior**

Confirm a failing required check cannot auto-deploy production. If Railway cannot enforce this reliably, disable production auto-deploy and document/use an explicit verified deploy action instead.

**Checkpoint H gate:** canonical `main` is protected, normal deploys are gated, and the v0.14 permanent diagnostic is gone.

---

### Task 11: Checkpoint H2 — Clean obsolete Railway operational services only after verification

**Files:**
- Railway service inventory/configuration.

**Interfaces:**
- Consumes: Checkpoint A service capture and healthy post-cutover production.
- Produces: smaller permanent service inventory with no obsolete one-shot/UAT duplicates.

- [ ] **Step 1: Classify every candidate service**

At minimum review:

```text
v0140-enrichment-apply-once
old UAT smoke services
older duplicate scheduled services
```

For each, document current schedule, last deployment, mutation authority, and whether a permanent replacement exists.

- [ ] **Step 2: Disable before delete where supported**

For obsolete scheduled/mutating services, first stop scheduling/activation and confirm the replacement permanent service remains healthy.

- [ ] **Step 3: Delete only confirmed obsolete one-shot/duplicate services**

Do not delete any service with unique credentials, volume data, domain, or schedule until that dependency is explicitly migrated.

**Checkpoint H2 gate:** production inventory is intentional; no duplicate/obsolete service can continue mutating production unexpectedly.

---

### Task 12: Checkpoint I — Harden Archive independently

**Files:**
- Repository settings for `ppodolske/archive`.
- No application architecture changes.

**Interfaces:**
- Consumes: existing Archive CI with Postgres, Prisma, unit/integration, Playwright, production build, Docker build.
- Produces: protected Archive `main`, required CI, cleaned stale PR/branches where safe.

- [ ] **Step 1: Read current Archive `main`, open PRs, branch list, and latest CI state**

- [ ] **Step 2: Confirm existing CI is green on current main**

Do not weaken CI because of the historic GitHub merge-endpoint 502 incident.

- [ ] **Step 3: Protect Archive `main` and require its CI**

Use zero approvals, no force pushes, no routine direct pushes, and auto-delete merged branches.

- [ ] **Step 4: Close only clearly superseded stale PRs with explanatory comments**

- [ ] **Step 5: Remove obsolete merged branches only after verifying no unique commits remain**

**Checkpoint I-A gate:** Archive remains separate/private with green required CI and protected `main`.

---

### Task 13: Checkpoint I — Add Parks GitHub Actions CI and protect `main`

**Files:**
- Create: `ppodolske/mnwistateparks/.github/workflows/ci.yml`
- Repository settings for Parks.

**Interfaces:**
- Consumes: existing local `npm test` audit suite.
- Produces: automatic CI on PRs/pushes to `main` and protected Parks `main`.

- [ ] **Step 1: Confirm current Parks install/test commands from package metadata**

- [ ] **Step 2: Add minimal CI using the project’s supported Node version**

Workflow responsibilities:

```text
checkout
setup-node
clean install
npm test
```

Use `npm ci` when the current lockfile supports it.

- [ ] **Step 3: Open PR and require green CI before merge**

- [ ] **Step 4: Protect Parks `main` and enable merged-branch auto-deletion**

Keep repository/deployment strategy independent from preston.ai.

**Checkpoint I-B gate:** Parks has automatic required CI and protected `main`.

---

### Task 14: Checkpoint J — Mark old core repositories historical and close stale work

**Files:**
- Old repo descriptions/README notices/settings.
- Stale PR/branch metadata only after uniqueness checks.

**Interfaces:**
- Consumes: stable production running from `preston-platform/main` and retained recovery refs.
- Produces: unambiguous canonical source with old repos retained for history/rollback.

- [ ] **Step 1: Verify post-cutover stability one final time**

Require healthy production hub, Form, scheduled services, UAT, and green monorepo CI.

- [ ] **Step 2: Mark `preston-run` and `dose-and-scale` historical/non-canonical**

Add a clear repository notice pointing to `ppodolske/preston-platform`. Do not delete the repos.

- [ ] **Step 3: Close stale/superseded PRs with explanatory comments**

- [ ] **Step 4: Delete obsolete merged branches only after compare confirms no unique work**

Keep:

```text
production/pre-repository-foundation
repository-foundation/pre-cutover-backup
```

and any intentionally retained source-history branches required for rollback/reference.

- [ ] **Step 5: Confirm canonical branch/deployment matrix**

```text
preston-platform/main -> Railway production + UAT candidates
archive/main -> Archive deployment
mnwistateparks/main -> Parks deployment
```

No permanent production service may point at a feature/fix/version branch.

**Checkpoint J gate:** old repos are clearly non-canonical but still available, stale work is cleaned safely, and the Preston ecosystem has one obvious core source of truth.

---

### Task 15: Final release gate and handoff to preston.ai v0.15

**Files:**
- Create: `docs/superpowers/release-notes/2026-09-15-repository-deployment-foundation-complete.md` in `preston-platform`.

**Interfaces:**
- Consumes: evidence from Checkpoints A–J.
- Produces: explicit go/no-go record for starting v0.15.

- [ ] **Step 1: Re-run clean full-core verification from `preston-platform/main`**

```bash
npm ci --no-audit --no-fund
npm test
```

- [ ] **Step 2: Verify all 17 design release gates explicitly**

Record PASS/FAIL for:

1. exact pre-migration production SHA recoverable;
2. old preston-run `main` reconciled;
3. Form divergence reconciled;
4. private monorepo exists;
5. shared contract tests exist;
6. clean CI passes;
7. preston.ai production sources monorepo `main`;
8. correct roots/watch boundaries;
9. deployment is CI-gated/explicitly verified;
10. obsolete v0.14 pre-deploy diagnostic removed;
11. production/UAT separated;
12. core `main` protected;
13. stale cleanup completed or explicitly deferred with reason;
14. Archive `main` CI-protected;
15. Parks CI + protection active;
16. old repos retained and non-canonical;
17. production smoke verification passes.

- [ ] **Step 3: Record the known weight-trend defect as the next mandatory v0.16 item, not a migration regression**

Include the exact known root cause and observed production symptom so it cannot disappear during handoff:

```js
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
```

Known bad coercions: `null`, `''`, and whitespace become zero. Required future TDD fix must preserve legitimate numeric zero and cover weight, HRV, RHR, stress, sleep, duration, and distance, followed by context/cache/intelligence refresh and preston.ai sanity checking.

- [ ] **Step 4: Commit completion record and only then declare v0.15 unblocked**

Commit:

```text
docs: complete repository deployment foundation
```

**Final gate:** preston.ai v0.15 Intelligence Foundation may begin only when every non-deferred release gate above is PASS and any deferral is non-safety-critical and explicitly documented.

---

## Self-review against the approved spec

- Spec coverage: Checkpoints A–J map directly to the approved sequencing; Archive/Parks hardening, UAT separation, CI gating, branch protection, Railway cutover, pre-deploy cleanup, secret hygiene, rollback, and the v0.15 hold are all assigned to concrete tasks.
- Known weight bug: explicitly preserved during reconciliation/shared-package extraction and carried into final handoff; no incidental fix is planned.
- Destructive ordering: no old repo/service/branch is deleted before a verified replacement exists.
- Failure handling: ancestry drift, unhealthy production, ambiguous Form merge, secret findings, failed UAT, failed production cutover, and unavailable Railway check gating are all stop/rollback conditions rather than reasons to bypass controls.
- Placeholder scan: no implementation step depends on an unspecified future design decision; Railway watch syntax is intentionally validated from the connected service API immediately before applying because the approved spec explicitly leaves exact syntax as an implementation detail.
