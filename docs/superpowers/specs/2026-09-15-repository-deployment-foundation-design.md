# Repository & Deployment Foundation Design

Date: 2026-09-15  
Status: Approved architecture — formal implementation design  
Scope: repository topology, branch strategy, CI gates, Railway deployment topology, migration to a core monorepo  
Current production repository: `ppodolske/preston-run`  
Current production Railway project: `Preston.run`

## 1. Purpose

Before preston.ai v0.15 begins, the repository and deployment model must be simplified so future work is not built on top of branch drift, cross-repository divergence, stale deployment hooks, or ambiguous production baselines.

This project is deliberately infrastructure/repository work rather than a feature release.

The target outcome is:

- one canonical source branch for the preston.ai + Form core platform;
- one private core monorepo containing preston.ai and Form/Dose & Scale;
- independent app deployments from that monorepo;
- CI as a mandatory production gate rather than an advisory signal;
- no long-lived version-number production branches;
- clean UAT/production separation;
- Archive and Parks remaining separate applications;
- a migration that preserves the current known-good production application while repository structure is changed.

## 2. Why this work is required now

The current topology has several compounding risks.

### 2.1 preston-run default branch is not the production line

GitHub default branch:

```text
main
```

Current Railway production branch:

```text
build/preston-ai-v0.11.0
```

At the design review, `build/preston-ai-v0.11.0` was 630 commits ahead of `main` and zero commits behind it.

The actual application reports v0.14.x-era functionality while the permanent production branch name remains v0.11.0.

This creates avoidable ambiguity around:

- which branch a new feature should start from;
- which branch PRs should target;
- which branch reflects production;
- whether a merge actually affects the deployed application;
- whether an older default branch can accidentally become active again.

### 2.2 Dose & Scale/Form has diverged development lines

Dose & Scale currently has:

```text
main
build/preston-ai-v0.11.0-integration
```

The two branches are diverged.

The preston.ai daily-context integration, including `lib/preston-context.js`, lives on the integration branch while subsequent Form changes exist on `main`.

This is already affecting a real production defect: the weight-trend numeric-parser bug exists in the preston context code on the integration line rather than a single canonical Form branch.

### 2.3 Production is not gated on GitHub CI

The Railway production hub currently sources:

```text
repo: ppodolske/preston-run
branch: build/preston-ai-v0.11.0
checkSuites: false
```

CI exists, but Railway does not wait for a successful GitHub check suite before deployment.

This means CI is informational rather than a hard production gate.

### 2.4 Permanent pre-deploy work is release-specific

The production hub currently runs:

```text
npm run job:gmail:booking-enrichment -- --dry-run
```

before every deploy.

That was useful during the v0.14 release gate, but it should not remain a dependency of unrelated future deploys. A transient Gmail/API problem should not block a UI, Search, Projects, or documentation deployment.

### 2.5 Branch protection is absent

The inspected `main` branches are not protected.

Direct writes are therefore technically possible even where PR + CI is the intended workflow.

### 2.6 Branch/PR graveyards make stale work easy to reuse accidentally

`preston-run` and `archive` currently retain large numbers of old build, fix, diagnostic, verify and ops branches. There are also stale open PRs that were superseded by later fixes.

This does not itself break Git, but it increases the chance that a human or automated agent starts from the wrong branch or assumes an obsolete PR is still active.

### 2.7 Public source is not the desired trust boundary for the core personal OS

`preston-run` is currently public.

The deployed website may remain publicly reachable/authenticated, but the source repository for a personal operating system with Gmail, Calendar, Drive, Supabase, health/fitness integrations and future Agent actions should be private.

No secret exposure was identified during this review, but the repository should not rely on perfect future operational discipline.

## 3. Chosen repository topology

Target repositories:

```text
preston-platform        PRIVATE
  ├── preston.ai
  └── Form / Dose & Scale

archive                 PRIVATE
  └── story archive

mnwistateparks          separate
  └── Parks
```

Archive and Parks remain separate.

## 4. Why preston.ai and Form belong together

Form is no longer merely an unrelated application that preston.ai happens to call.

It is the producer of shared fitness/recovery/training context consumed by preston.ai Today intelligence.

The relationship includes:

- a shared context schema;
- numeric parsing semantics;
- weight-trend calculation;
- recovery metrics;
- planned workout data;
- actual activity data;
- cache refresh behaviour;
- cross-application release validation.

These changes should be testable atomically.

A future change such as the weight-trend fix should be able to modify:

```text
apps/form/
packages/fitness-context/
apps/preston-ai/
```

in one pull request, with producer and consumer tests running before merge.

## 5. Why Archive remains separate

Archive is independently deployable and technologically distinct:

- Next.js/React;
- Prisma;
- PostgreSQL lifecycle separate from preston.ai Supabase;
- S3-compatible image storage;
- archive relay/import contract;
- Playwright/browser test suite;
- Docker image build.

Combining it into the core monorepo would increase CI and deployment coupling without solving an active dependency problem.

## 6. Why Parks remains separate

Parks has its own release cadence, public-site concerns, large data/assets footprint and independent audit suite.

Its main issues are branch protection and automatic CI, not cross-repository dependency with preston.ai.

A future shared design-system package could be considered separately if it becomes valuable, but Parks does not move into the core monorepo in this project.

## 7. Target core monorepo layout

```text
preston-platform/
├── apps/
│   ├── preston-ai/
│   │   ├── src/
│   │   ├── public/
│   │   ├── supabase/
│   │   ├── scripts/
│   │   ├── test/
│   │   └── package.json
│   │
│   └── form/
│       ├── lib/
│       ├── test/
│       ├── public/application files as applicable
│       └── package.json
│
├── packages/
│   └── fitness-context/
│       ├── parser / schema helpers
│       ├── contract tests
│       └── package.json
│
├── docs/
│   └── superpowers/
│       ├── specs/
│       └── plans/
│
├── package.json
├── package-lock.json or workspace lockfile
├── .gitignore
└── .github/
    └── workflows/
```

The exact build-system choice is intentionally conservative: npm workspaces are sufficient initially. No Turborepo/Nx requirement is introduced unless implementation evidence demonstrates a need.

## 8. Canonical branch strategy

The target branch model is:

```text
main                 canonical integrated source + production candidate
feature/*            normal feature work
fix/*                targeted bugfixes
ops/*                exceptional operational changes only
```

Permanent version branches are eliminated.

Do not create future branches such as:

```text
build/preston-ai-v0.15.0
build/preston-ai-v0.16.0
```

Version identity belongs in:

- package/app version metadata;
- Git tags;
- GitHub releases/release notes;
- deployment metadata.

A branch name must not become the permanent identity of production.

## 9. Main-branch protection

Target protection for the core monorepo `main`:

- pull request required;
- required approving reviews: zero, appropriate for the current single-user repository;
- required status checks must pass;
- branch must be up-to-date with `main` before merge where GitHub configuration permits;
- force pushes disabled;
- branch deletion disabled;
- normal direct pushes blocked;
- administrator bypass used only for explicit recovery, not routine releases.

Archive and Parks should receive equivalent CI-required protection appropriate to their workflows.

## 10. Merge strategy

Default merge method for normal feature/fix PRs:

```text
squash merge
```

Rationale:

Superpowers/TDD work frequently contains many deliberately small RED/GREEN/refactor commits. The PR preserves that development history, while `main` receives one coherent change.

Exceptional release/migration PRs may use a normal merge commit where preserving branch ancestry materially helps repository migration, but that is not the routine path.

Repository setting should delete feature branches automatically after merge.

## 11. Current production anchor

Before any structural repository mutation, record the exact currently deployed preston.ai production commit and create an immutable recovery reference.

Required references:

```text
production/pre-repository-foundation tag
repository-foundation backup branch or equivalent immutable recovery ref
```

The reference must point to the exact commit currently deployed by `preston-run-hub` immediately before cutover work begins.

Do not infer production from GitHub default branch.

Railway deployment metadata is the authority for the active production SHA during this migration.

## 12. Migration phases

### Phase 0 — freeze and capture

Before changing repository topology:

1. read current Railway production source and latest successful deployment SHA;
2. verify production health;
3. record exact production SHA;
4. create recovery tag/ref;
5. capture current Railway service source/config for hub and scheduled services;
6. capture current Dose & Scale main/integration branch heads;
7. stop creating new feature work on the old repository lines until migration is complete.

No production behaviour changes in Phase 0.

### Phase 1 — canonicalize preston-run history

Goal: eliminate the stale `main` vs production split.

Because the production branch is a strict descendant of current `main`, canonicalization should not require a content conflict.

Process:

1. validate production branch is still ahead-only of `main` at execution time;
2. run full preston.ai CI on the production head;
3. verify Railway production is healthy on that head;
4. move/promote canonical `main` to the known-good production head using a controlled fast-forward/equivalent operation;
5. verify `main` tree equals the production branch tree;
6. do not delete the old production branch until the new deployment model is proven.

If `main` has advanced independently before execution, stop and re-evaluate rather than force-overwriting unseen changes.

### Phase 2 — reconcile Form/Dose & Scale

Goal: produce one canonical Form tree before importing it.

Current divergent lines must be reconciled intentionally rather than choosing one and discarding the other.

Required merge inputs:

```text
main
build/preston-ai-v0.11.0-integration
```

The reconciliation must preserve:

- current Form application behaviour from `main`;
- preston context/gateway/service integration from the integration branch;
- both relevant test sets;
- runtime/start behaviour;
- subsequent weight-trend bugfix capability.

A reconciliation PR must be green before monorepo import.

Do not fix the weight-trend defect as an incidental merge-conflict edit. The defect remains an explicit v0.16/TDD change unless a minimal compatibility edit is strictly necessary to merge the branches.

### Phase 3 — create core monorepo

Create `ppodolske/preston-platform` as a private repository.

Import the canonical preston.ai and Form trees into:

```text
apps/preston-ai/
apps/form/
```

Preserve useful history where practical. The migration does not require perfect source-repository history rewriting if that increases risk materially; the old repositories remain available as immutable historical sources.

Add:

- npm workspace configuration;
- shared root CI;
- hardened `.gitignore`;
- repository documentation explaining app boundaries;
- explicit app version metadata;
- path-aware test/deploy contracts.

### Phase 4 — extract shared fitness-context contract

Move only genuinely shared context logic into:

```text
packages/fitness-context/
```

Initial shared responsibility should be narrow:

- numeric parser semantics;
- daily-context schema validation/types/contracts;
- contract fixtures consumed by both apps.

Do not prematurely move all Form business logic into a shared package.

Form remains responsible for producing fitness intelligence. preston.ai remains responsible for consuming/presenting it.

### Phase 5 — configure monorepo CI

PR CI must determine affected surfaces and run at least:

```text
preston.ai changed
→ preston.ai tests + syntax/static checks

Form changed
→ Form tests

fitness-context package changed
→ fitness-context tests + Form tests + preston.ai integration/contract tests

root/workspace/build config changed
→ all core tests
```

A full-core verification job should also be available and required for release-sensitive PRs.

CI must use clean installation (`npm ci` where compatible) and fail on test/syntax/build failures.

### Phase 6 — Railway cutover

Production services should move to:

```text
repo: ppodolske/preston-platform
branch: main
rootDirectory: apps/preston-ai
checkSuites: true
```

Form service should use:

```text
repo: ppodolske/preston-platform
branch: main
rootDirectory: apps/form
```

Watch patterns should prevent unrelated app changes from redeploying every service.

Examples:

```text
preston.ai services:
  /apps/preston-ai/**
  /packages/fitness-context/**
  root workspace/lockfile changes

Form:
  /apps/form/**
  /packages/fitness-context/**
  root workspace/lockfile changes
```

Exact Railway watch-pattern syntax is implementation detail and must be validated against the connected Railway service configuration before applying.

### Phase 7 — remove obsolete permanent pre-deploy gate

Remove the v0.14-specific booking-enrichment dry-run from the permanent hub pre-deploy command.

Target preston.ai hub start configuration:

```text
startCommand: npm start or app-specific workspace equivalent
preDeployCommand: only durable release-safe migrations/checks explicitly designed for every future deploy
```

One-time release diagnostics belong in controlled jobs, not the permanent application deployment path.

### Phase 8 — UAT separation

Create/use a true Railway UAT environment rather than treating UAT as another production-environment service.

Target:

```text
Railway project: Preston.run
  production environment
  uat environment
```

UAT should have:

- separate service deployments;
- separate Supabase/UAT credentials where applicable;
- no production Gmail mutation authority;
- clear environment-specific URLs;
- same monorepo branch/commit candidate being tested before production promotion.

The exact promotion model may remain manual initially.

### Phase 9 — repository settings and cleanup

After successful production cutover:

1. protect `main`;
2. enable required CI checks;
3. enable automatic deletion of merged head branches;
4. close stale/superseded PRs with explanatory comments;
5. delete obsolete merged diagnostic/build/fix branches after verifying they contain no unique work;
6. retain recovery refs/tags;
7. archive or clearly mark the old `preston-run` and `dose-and-scale` repositories as historical after the new monorepo has proven stable;
8. do not delete old repositories during the same cutover window.

## 13. Repository visibility and secret hygiene

The core monorepo must be private.

Root `.gitignore` must include at minimum:

```text
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

App-specific generated assets may add additional ignores.

Do not commit OAuth client secrets, Supabase service-role keys, API tokens or Google credentials.

A secret scan should be run across imported trees before the new repository is made canonical.

## 14. Deployment integrity rules

After migration:

- production deploys only from canonical `main`;
- Railway waits for required GitHub checks where supported;
- no production service deploys from feature/fix branches;
- one-shot ops branches do not remain wired to permanent services;
- release-specific diagnostics do not remain permanent pre-deploy dependencies;
- production SHA must be discoverable from Railway and GitHub;
- a production rollback must use a known-good commit/tag rather than branch-name guesswork.

## 15. Cross-repo changes after consolidation

Archive and Parks remain separate, so any future cross-repo change must have an explicit compatibility contract.

The main problem being solved here is the tightly coupled Form → preston.ai fitness-context flow.

Do not recreate that same coupling through undocumented HTTP payloads inside the monorepo. Shared contracts must be versioned/tested in code.

## 16. Archive hardening

Archive remains in `ppodolske/archive`.

Required repository hygiene work:

- protect `main`;
- require its existing CI before merge;
- close stale superseded open PRs;
- enable automatic deletion of merged branches;
- retain the existing test + Playwright + production Docker build gate;
- preserve current private visibility.

The previous GitHub 502 merge failure is treated as a transient platform/API failure, not a reason to bypass CI routinely.

## 17. Parks hardening

Parks remains in `ppodolske/mnwistateparks`.

Required work:

- add GitHub Actions CI to run its existing `npm test` audit suite on PRs/pushes to `main`;
- protect `main` after CI exists;
- enable automatic deletion of merged branches;
- keep deployment/release strategy independent from preston.ai.

Repository visibility may remain public if intentionally desired because Parks is itself a public-content application, but secrets must remain external.

## 18. Failure handling

### 18.1 GitHub merge endpoint failure

If GitHub returns a transient merge API error:

- do not copy unverified code directly into production as the default response;
- confirm the PR head SHA and CI state;
- retry the merge or use a controlled Git operation preserving the exact verified tree;
- verify resulting `main` tree/commit after merge;
- deploy only from the resulting canonical `main`.

### 18.2 Monorepo cutover failure

If a monorepo Railway deployment fails:

- leave the existing production deployment intact;
- do not repoint DNS/domain until the new service is healthy;
- use the pre-foundation production tag/ref as rollback anchor;
- restore old Railway source configuration if source cutover has already occurred.

### 18.3 Form reconciliation conflict

If Form main/integration reconciliation reveals incompatible runtime behaviour:

- stop before monorepo import;
- resolve/test in Dose & Scale first;
- do not import a knowingly ambiguous tree.

### 18.4 CI/check-suite integration unavailable

If Railway cannot enforce GitHub checks exactly as expected, production auto-deploy must be disabled or replaced with an explicit verified deploy workflow rather than silently reverting to ungated deployment.

## 19. Testing / verification

Repository migration must verify behaviour, not only Git operations.

### 19.1 preston.ai

Before and after migration:

- clean install;
- full test suite;
- syntax/static checks;
- `/health` response/version sanity;
- authenticated landing smoke test;
- Gmail/Calendar/fitness configuration can be loaded without credential leakage;
- scheduled job entry points still resolve.

### 19.2 Form

Before and after reconciliation/import:

- clean install;
- existing runtime-injection tests;
- Preston context/gateway/service tests;
- service endpoint contract;
- application startup smoke test.

### 19.3 Shared contract

- producer fixture accepted by preston.ai consumer;
- invalid schema rejected deterministically;
- missing numeric values remain distinguishable from legitimate zero values once the v0.16 parser fix is implemented;
- contract tests run whenever shared package changes.

### 19.4 Railway

For each production service moved:

- source repo/branch/root directory verified;
- expected watch patterns verified;
- successful deployment SHA matches intended `main` SHA;
- health status success;
- schedules preserved;
- custom domain preserved;
- no obsolete pre-deploy command remains unintentionally.

## 20. Explicit non-goals

This project does not:

- implement v0.15 Intelligence Foundation;
- fix the Morning Digest/Today weight-trend bug;
- redesign Today;
- add Drive integration;
- merge Archive into the monorepo;
- merge Parks into the monorepo;
- change Archive data/storage architecture;
- change Parks product functionality;
- introduce Nx/Turborepo unless required by implementation evidence;
- rewrite all historical Git commits into a perfect unified history;
- delete old source repositories during the initial cutover.

## 21. Release / cutover gates

The repository foundation is complete only when all of the following are true:

1. exact pre-migration production SHA is recorded and recoverable;
2. preston-run `main` has been reconciled with the actual production tree before import;
3. Form main/integration divergence is reconciled with all relevant tests retained;
4. the private core monorepo exists with preston.ai + Form app boundaries;
5. shared fitness-context contract tests exist;
6. CI passes from a clean checkout;
7. Railway preston.ai production services deploy from monorepo `main`;
8. Railway uses app root/watch boundaries appropriate to the monorepo;
9. production deployment is CI-gated or explicitly verified if check-suite gating cannot be enforced;
10. v0.14-specific permanent pre-deploy diagnostics are removed;
11. production and UAT are separated cleanly;
12. core `main` is protected;
13. stale PR/branch cleanup is complete or intentionally deferred with documented reason;
14. Archive `main` is CI-protected;
15. Parks has automatic CI and protected `main`;
16. the old repos/branches remain available long enough for rollback/history but are clearly non-canonical;
17. production smoke verification passes after cutover.

## 22. Locked design decisions

Unless this design is explicitly amended:

- preston.ai + Form move into one private core monorepo;
- Archive remains separate;
- Parks remains separate;
- core production source is `main`;
- future version-number build branches are not permanent production branches;
- normal changes merge through PR + required CI;
- squash merge is the default normal merge method;
- merged feature branches are deleted automatically;
- current production is anchored before migration;
- Form branch divergence is reconciled before import;
- production is not intentionally deployed from a failing/unverified commit;
- Railway app/service roots remain independently deployable inside the monorepo;
- `fitness-context` is the first shared core package and stays narrow;
- Archive/Parks are hardened but not folded into the core repository;
- old repositories are not deleted during initial cutover;
- the v0.15 feature implementation does not start until this foundation cutover is verified.

## 23. Implementation sequencing

The implementation plan should be split into safe checkpoints rather than one destructive migration:

```text
Checkpoint A
Capture/anchor current production + branch state

Checkpoint B
Canonicalize preston-run main safely

Checkpoint C
Reconcile Form branches and verify

Checkpoint D
Create/populate private core monorepo + CI

Checkpoint E
Validate monorepo apps without changing production

Checkpoint F
Cut UAT over to monorepo and verify

Checkpoint G
Cut production Railway services over and verify

Checkpoint H
Apply branch protections/settings and remove stale deploy hooks

Checkpoint I
Harden Archive/Parks repositories

Checkpoint J
Retire/mark old core repos and start v0.15 from clean monorepo main
```

No checkpoint should require destroying the previous working state before the replacement has been verified.
