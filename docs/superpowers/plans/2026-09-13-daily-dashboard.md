# preston.ai v0.11.0 Daily Briefing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the unreleased v0.11.0 daily dashboard by moving Morning Digest ownership to preston.ai, ingesting a constrained Dose & Scale fitness feed, showing planned workouts in dashboard/full-calendar context, and fixing the UAT layout/icon/naming issues.

**Architecture:** This is a coordinated two-repository change. `ppodolske/dose-and-scale` exposes one dedicated server-to-server read-only daily-context endpoint; `ppodolske/preston-run` fetches that endpoint on a 07:15 Australia/Sydney schedule, stores the last good snapshot in Supabase, generates/persists the Morning Digest locally, and merges cached planned workouts into its existing calendar view models. Normal preston.ai page loads remain cache-backed and never call Dose & Scale, Google, or Apple live.

**Tech Stack:** Node.js/CommonJS, Express, PostgreSQL (Dose & Scale), Supabase/Postgres (preston.ai), server-rendered HTML/CSS/vanilla JS, Railway scheduled services, Node `assert` tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-13-daily-dashboard-design.md`

## Global Constraints

- Feature version remains exactly `v0.11.0`; this is a UAT revision, not a new release line.
- preston.ai development branch remains `build/preston-ai-v0.11.0`.
- Create Dose & Scale branch `build/preston-ai-v0.11.0-integration`; do not write integration code directly to its `main` branch.
- No production merge/deploy for either repo without explicit approval after coordinated UAT.
- Use `preston.ai` exactly, all lowercase, for product references in touched UI copy.
- Dose & Scale browser Basic Auth credentials must never be reused for service-to-service auth.
- The D&S integration endpoint must return a constrained contract, never full `app_state`.
- preston.ai page requests must use local cached fitness context and must not make live D&S requests.
- Fitness-context refresh is scheduled for 07:15 Australia/Sydney with the same DST-safe local-time gating pattern used by existing jobs.
- Failed D&S refreshes never erase the last successful cached snapshot.
- Planned workouts remain read-only and are merged only at the preston.ai calendar view-model layer; never insert them into `calendar_events`, Google Calendar, Apple/iCloud, Life Admin, tasks, or reminder rows.
- Today and tomorrow planned workouts stay visible in dashboard context even when today is completed.
- Full `/calendar` shows all cached planned workouts in the visible month.
- Existing Google/Apple OAuth scopes remain unchanged.
- Existing 06:55 calendar sync, 07:05 Morning Summary, noon urgent, and 18:00 urgent behavior remain unchanged.
- Mobile dashboard/digest/admin cards must be 100% of available content width inside normal page padding.
- Parks launcher uses the tree asset; Archive launcher uses the book asset.

---

## File Structure and Responsibilities

### Dose & Scale (`ppodolske/dose-and-scale`)

**Create**
- `lib/preston-context.js` — pure contract builder from D&S state; no HTTP concerns.
- `test/preston-context.test.js` — contract minimization, planned workouts, recovery/training inputs.
- `test/preston-context-route.test.js` — service-token route/auth behavior.
- `test/run.js` — tiny test runner so the integration branch has one repeatable command.

**Modify**
- `server.js` — add `/api/preston/daily-context` before browser Basic Auth middleware and route it through dedicated bearer auth.
- `package.json` — add `test` script only; do not change application behavior/version merely for the integration branch.
- `public/morning-digest-v12.4.0.js` and `server.js` script injection list — remove/inactivate D&S Morning Digest only after preston.ai parity is proven in UAT (Task 10, not earlier).

### preston.ai (`ppodolske/preston-run`)

**Create**
- `supabase/migrations/20260913101500_v0110_fitness_context_digest.sql` — owner-scoped cache/digest tables and RLS.
- `src/data/fitness-context.js` — read/write last-good D&S snapshot and daily digest.
- `src/services/dose-scale-client.js` — server-only HTTP client for constrained D&S endpoint.
- `src/domain/morning-digest.js` — port of current D&S digest interpretation logic as pure functions.
- `src/services/fitness-context.js` — refresh orchestration: fetch, normalize, persist, generate digest.
- `src/jobs/fitness-context-sync.js` — 07:15 Sydney gated scheduled entrypoint.
- `test/fitness-context-migration.test.js`
- `test/fitness-context-data.test.js`
- `test/dose-scale-client.test.js`
- `test/morning-digest.test.js`
- `test/fitness-context-service.test.js`
- `test/fitness-context-job.test.js`

**Modify**
- `src/config.js` — D&S feed URL/token config available server-side only.
- `src/domain/calendars.js` — merge planned workouts into dashboard and month models.
- `src/routes/site.js` — load cached digest/context independently and pass planned workouts to dashboard.
- `src/routes/calendars.js` — load cached planned workouts for `/calendar` without live D&S calls.
- `src/pages/home.js` — full-width Morning Digest, Planned Workouts group, full-width mobile rules, restored Website Admin card structure.
- `src/pages/calendar-view.js` — planned-workout month rendering.
- `src/pages/calendars.js` — product-name copy cleanup.
- `src/branding.js` — stable launcher asset metadata (Parks tree, Archive book, D&S icon).
- `package.json` / `test.js` / `.github/workflows/ci.yml` — register new job/tests/syntax checks while retaining `0.11.0`.
- Existing dashboard/calendar/page tests — extend contracts rather than replace prior v0.11.0 coverage.

---

### Task 1: Dose & Scale constrained daily-context contract

**Repository:** `ppodolske/dose-and-scale`

**Files:**
- Create: `lib/preston-context.js`
- Create: `test/preston-context.test.js`
- Create: `test/run.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: current D&S `app_state` object.
- Produces: `buildPrestonDailyContext(state, now)` returning a JSON-safe object with `schemaVersion`, `generatedAt`, `garminSyncAt`, `recovery`, `baseline`, `weightTrend`, `recentTraining`, `phase`, `intervention`, `plannedWorkouts`, and `actualActivities`.

- [ ] **Step 1: Create the D&S integration branch**

```bash
git switch main
git pull --ff-only
git switch -c build/preston-ai-v0.11.0-integration
```

- [ ] **Step 2: Write the failing pure-contract test**

Create `test/preston-context.test.js`:

```js
const assert=require('node:assert/strict');
const {buildPrestonDailyContext}=require('../lib/preston-context');

const state={
  garminCloudLastImportedAt:'2026-09-13T20:55:00Z',
  garminSleep:[
    {date:'2026-09-13',sleepHours:7.2,sleepScore:81,restingHeartRate:51,hrvLastNightAvg:44,averageStressLevel:22},
    {date:'2026-09-12',sleepHours:6.9,restingHeartRate:52,hrvLastNightAvg:42,averageStressLevel:25}
  ],
  entries:[{date:'2026-09-01',weight:122.5},{date:'2026-09-13',weight:121.7}],
  training:[{date:'2026-09-13',type:'lift',name:'Workout A'}],
  plannedWorkouts:[
    {date:'2026-09-13',name:'Workout A',sport:'strength'},
    {date:'2026-09-14',name:'Easy Run',sport:'running'},
    {date:'2026-10-02',name:'Long Run',sport:'running'}
  ],
  phases:[{id:'p1',name:'Base',start:'2026-09-01',end:'2026-10-01'}],
  interventions:[]
};
const out=buildPrestonDailyContext(state,new Date('2026-09-13T21:00:00Z'));
assert.equal(out.schemaVersion,1);
assert.equal(out.garminSyncAt,state.garminCloudLastImportedAt);
assert.equal(out.plannedWorkouts.length,3);
assert.equal(out.recovery.date,'2026-09-13');
assert.equal(Object.hasOwn(out,'morningDigests'),false);
assert.equal(Object.hasOwn(out,'entries'),false);
assert.equal(Object.hasOwn(out,'appEvents'),false);
console.log('preston context contract tests passed');
```

- [ ] **Step 3: Run and verify red**

```bash
node test/preston-context.test.js
```

Expected: FAIL because `lib/preston-context.js` does not exist.

- [ ] **Step 4: Implement the pure contract builder**

Create `lib/preston-context.js` with focused helpers and this public shape:

```js
function buildPrestonDailyContext(state={},now=new Date()){
  const today=localDate(now);
  return {
    schemaVersion:1,
    generatedAt:now.toISOString(),
    garminSyncAt:state.garminCloudLastImportedAt||null,
    recovery:recoveryForDate(state,today),
    baseline:recoveryBaseline(state,today,14),
    weightTrend:weightTrend(state,today,28),
    recentTraining:recentTraining(state,today,7),
    phase:activePhase(state,today),
    intervention:recentIntervention(state,today,14),
    plannedWorkouts:normalizePlannedWorkouts(state.plannedWorkouts||[]),
    actualActivities:normalizeActualActivities(state.training||[],today,2)
  };
}
module.exports={buildPrestonDailyContext};
```

Normalize planned workouts to only:

```js
{id,date,name,sport,durationMinutes,distanceKm,description}
```

Normalize actual activities to only fields required for conservative completion matching:

```js
{date,name,type,durationMinutes,distanceKm}
```

Do not return raw arrays or full state.

- [ ] **Step 5: Add a minimization regression assertion**

Add:

```js
assert.deepEqual(Object.keys(out).sort(),[
  'actualActivities','baseline','generatedAt','garminSyncAt','intervention',
  'phase','plannedWorkouts','recentTraining','recovery','schemaVersion','weightTrend'
].sort());
```

- [ ] **Step 6: Add a test runner and package script**

`test/run.js`:

```js
require('./preston-context.test');
require('./preston-context-route.test');
```

Update `package.json` scripts:

```json
{"start":"node login-wrapper.js","test":"node test/run.js"}
```

- [ ] **Step 7: Run focused test**

```bash
node test/preston-context.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/preston-context.js test/preston-context.test.js test/run.js package.json
git commit -m "feat: build preston daily context feed"
```

---

### Task 2: Dose & Scale service-token endpoint

**Repository:** `ppodolske/dose-and-scale`

**Files:**
- Modify: `server.js`
- Create/Modify: `test/preston-context-route.test.js`

**Interfaces:**
- Consumes: `buildPrestonDailyContext(state, now)` from Task 1 and env `PRESTON_SERVICE_TOKEN`.
- Produces: `GET /api/preston/daily-context` authenticated by `Authorization: Bearer <token>`.

- [ ] **Step 1: Write failing auth/route tests**

Test the route handler through an exported app factory or isolated handler. Required assertions:

```js
assert.equal(await requestContext({authorization:null}).status,401);
assert.equal(await requestContext({authorization:'Basic abc'}).status,401);
assert.equal(await requestContext({authorization:'Bearer wrong'}).status,401);
const ok=await requestContext({authorization:'Bearer service-secret'});
assert.equal(ok.status,200);
assert.equal(ok.body.schemaVersion,1);
assert.equal(Object.hasOwn(ok.body,'morningDigests'),false);
```

- [ ] **Step 2: Verify red**

```bash
node test/preston-context-route.test.js
```

Expected: FAIL because the service endpoint/auth handler does not exist.

- [ ] **Step 3: Add dedicated bearer auth before browser Basic Auth**

In `server.js`, before `app.use(auth)`, add:

```js
function prestonServiceAuth(req,res,next){
  const expected=process.env.PRESTON_SERVICE_TOKEN||'';
  const header=req.headers.authorization||'';
  const token=header.startsWith('Bearer ')?header.slice(7):'';
  if(!expected||!safeEqual(token,expected))return res.status(401).json({error:'unauthorized'});
  next();
}

app.get('/api/preston/daily-context',prestonServiceAuth,async(_req,res,next)=>{
  try{
    const r=await pool.query('SELECT state FROM app_state WHERE id=1');
    const state=r.rows[0]?.state||{};
    res.json(buildPrestonDailyContext(state,new Date()));
  }catch(e){next(e)}
});
```

Import `buildPrestonDailyContext` at top. Do not let this route fall through browser Basic Auth.

- [ ] **Step 4: Run D&S tests**

```bash
npm test
node --check server.js
node --check lib/preston-context.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server.js test/preston-context-route.test.js
git commit -m "feat: expose preston context endpoint"
```

---

### Task 3: preston.ai fitness cache schema and data layer

**Repository:** `ppodolske/preston-run`

**Files:**
- Create: `supabase/migrations/20260913101500_v0110_fitness_context_digest.sql`
- Create: `src/data/fitness-context.js`
- Create: `test/fitness-context-migration.test.js`
- Create: `test/fitness-context-data.test.js`
- Modify: `test.js`

**Interfaces:**
- Produces:
  - `getFitnessContext(supabase,userId)`
  - `upsertFitnessContext(supabase,userId,{payload,sourceGeneratedAt,garminSyncAt,fetchedAt})`
  - `getMorningDigest(supabase,userId,dateKey)`
  - `upsertMorningDigest(supabase,userId,digest)`

- [ ] **Step 1: Write failing migration test**

Assert SQL defines exactly two owner-scoped tables:

```js
assert.match(sql,/create table if not exists public\.fitness_context_cache/i);
assert.match(sql,/create table if not exists public\.morning_digests/i);
assert.match(sql,/payload jsonb not null/i);
assert.match(sql,/unique\s*\(user_id,\s*digest_date\)/i);
assert.match(sql,/enable row level security/i);
```

- [ ] **Step 2: Verify red**

```bash
node test/fitness-context-migration.test.js
```

Expected: FAIL because migration is absent.

- [ ] **Step 3: Create migration**

Use this model:

```sql
create table if not exists public.fitness_context_cache (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  source_generated_at timestamptz,
  garmin_sync_at timestamptz,
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.morning_digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  digest_date date not null,
  schema_version integer not null default 1,
  source_generated_at timestamptz,
  garmin_sync_at timestamptz,
  status text not null,
  headline text not null,
  cards jsonb not null default '[]'::jsonb,
  bullets jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  unique(user_id,digest_date)
);
```

Enable RLS and add owner CRUD policies matching existing migration style. Revoke anon/public privileges consistently with v0.10 migrations.

- [ ] **Step 4: Write failing data tests**

Use the existing Supabase fake-chain style to assert `user_id` scoping and upsert conflict keys.

- [ ] **Step 5: Implement `src/data/fitness-context.js`**

All reads/writes must require a non-empty user ID. `upsertFitnessContext` must overwrite only after a successful fetch has produced a valid payload.

- [ ] **Step 6: Run focused tests**

```bash
node test/fitness-context-migration.test.js
node test/fitness-context-data.test.js
```

Expected: PASS.

- [ ] **Step 7: Register tests and commit**

```bash
git add supabase/migrations/20260913101500_v0110_fitness_context_digest.sql src/data/fitness-context.js test/fitness-context-migration.test.js test/fitness-context-data.test.js test.js
git commit -m "feat: add fitness context cache"
```

---

### Task 4: preston.ai D&S client and refresh service

**Repository:** `ppodolske/preston-run`

**Files:**
- Create: `src/services/dose-scale-client.js`
- Create: `src/services/fitness-context.js`
- Modify: `src/config.js`
- Create: `test/dose-scale-client.test.js`
- Create: `test/fitness-context-service.test.js`

**Interfaces:**
- Consumes env `DOSE_SCALE_CONTEXT_URL`, `DOSE_SCALE_SERVICE_TOKEN`.
- Produces `fetchDoseScaleContext({fetchImpl,url,token})` and `refreshFitnessContext({supabase,userId,fetchContext,now})`.

- [ ] **Step 1: Write failing client tests**

Assert bearer header, `cache:'no-store'`, bounded timeout/abort behavior, JSON validation, and non-2xx failure.

```js
const payload=await fetchDoseScaleContext({
  fetchImpl:async(url,opts)=>{assert.equal(opts.headers.Authorization,'Bearer secret');return {ok:true,json:async()=>({schemaVersion:1,plannedWorkouts:[]})}},
  url:'https://dose.test/api/preston/daily-context',token:'secret'
});
assert.equal(payload.schemaVersion,1);
```

- [ ] **Step 2: Verify red and implement client**

`fetchDoseScaleContext` must reject missing URL/token and reject payloads where `schemaVersion!==1` or `plannedWorkouts` is not an array.

- [ ] **Step 3: Write failing refresh-service test**

Assert successful fetch writes cache; failed fetch does not call `upsertFitnessContext` and returns `{ok:false}` while leaving prior data untouched.

- [ ] **Step 4: Implement refresh orchestration**

```js
async function refreshFitnessContext({supabase,userId,fetchContext=fetchConfiguredDoseScaleContext,now=new Date()}){
  try{
    const payload=await fetchContext();
    await upsertFitnessContext(supabase,userId,{
      payload,
      sourceGeneratedAt:payload.generatedAt||null,
      garminSyncAt:payload.garminSyncAt||null,
      fetchedAt:now.toISOString()
    });
    return {ok:true,payload};
  }catch(error){
    return {ok:false,error};
  }
}
```

- [ ] **Step 5: Run focused tests and commit**

```bash
node test/dose-scale-client.test.js
node test/fitness-context-service.test.js
git add src/services/dose-scale-client.js src/services/fitness-context.js src/config.js test/dose-scale-client.test.js test/fitness-context-service.test.js
git commit -m "feat: refresh dose scale context"
```

---

### Task 5: Port Morning Digest logic to preston.ai

**Repository:** `ppodolske/preston-run`

**Files:**
- Create: `src/domain/morning-digest.js`
- Create: `test/morning-digest.test.js`
- Modify: `src/services/fitness-context.js`
- Modify: `test/fitness-context-service.test.js`

**Interfaces:**
- Consumes D&S normalized context schema v1.
- Produces `buildMorningDigest(context,dateKey,now)` with `{schemaVersion,date,status,headline,cards,bullets,generatedAt,sourceGeneratedAt,garminSyncAt}`.

- [ ] **Step 1: Write parity tests from current D&S behavior**

At minimum cover:

```js
assert.equal(buildMorningDigest(noRecovery,'2026-09-13',now).status,'insufficient');
assert.equal(buildMorningDigest(healthy,'2026-09-13',now).status,'good');
assert.equal(buildMorningDigest(lowSleepHighRhr,'2026-09-13',now).status,'poor');
assert.match(buildMorningDigest(withPlan,'2026-09-13',now).bullets.join(' '),/Today.s plan/i);
```

Also assert structured cards include `recovery`, `training`, `weight`, `context` IDs when source data exists.

- [ ] **Step 2: Verify red**

```bash
node test/morning-digest.test.js
```

- [ ] **Step 3: Port interpretation logic, not D&S DOM code**

Move threshold/summary logic from `public/morning-digest-v12.4.0.js` into pure CommonJS helpers. Preserve substantive thresholds and status semantics; do not add calendar/Life Admin recommendations in v0.11.0.

- [ ] **Step 4: Make refresh persist digest after successful context write**

After cache upsert, compute Sydney date and persist digest. Only replace today's digest when there is no digest, source timestamps changed, or refresh was explicitly forced.

- [ ] **Step 5: Run focused tests and commit**

```bash
node test/morning-digest.test.js
node test/fitness-context-service.test.js
git add src/domain/morning-digest.js src/services/fitness-context.js test/morning-digest.test.js test/fitness-context-service.test.js
git commit -m "feat: move morning digest to preston ai"
```

---

### Task 6: Add 07:15 Sydney refresh job and manual refresh path

**Repository:** `ppodolske/preston-run`

**Files:**
- Create: `src/jobs/fitness-context-sync.js`
- Create: `test/fitness-context-job.test.js`
- Modify: `package.json`
- Modify: `src/routes/site.js`
- Modify: `test/routes.test.js`

**Interfaces:**
- Produces npm command `job:fitness:sync` and authenticated POST `/fitness-context/refresh`.

- [ ] **Step 1: Write failing job gating test**

Use fixed instants around AEDT/AEST and assert the job runs only when local Sydney time is 07:15, following existing calendar/reminder job gating conventions.

- [ ] **Step 2: Implement job entrypoint**

The job resolves the configured owner, obtains background Supabase, calls `refreshFitnessContext`, logs success/stale failure, and exits nonzero only for configuration/runtime failures that should alert Railway.

- [ ] **Step 3: Add npm script**

```json
"job:fitness:sync":"node src/jobs/fitness-context-sync.js"
```

- [ ] **Step 4: Write failing authenticated manual-refresh route test**

Unauthenticated POST must redirect/login; owner POST invokes refresh and redirects `/` with a compact flash query/status.

- [ ] **Step 5: Implement manual refresh route**

Do not expose D&S token to browser. Route calls server-side refresh only.

- [ ] **Step 6: Run tests and commit**

```bash
node test/fitness-context-job.test.js
node test/routes.test.js
git add src/jobs/fitness-context-sync.js test/fitness-context-job.test.js package.json src/routes/site.js test/routes.test.js
git commit -m "feat: schedule fitness context refresh"
```

---

### Task 7: Merge planned workouts into dashboard and full calendar models

**Repository:** `ppodolske/preston-run`

**Files:**
- Modify: `src/domain/calendars.js`
- Modify: `test/calendar-dashboard.test.js`
- Modify: `test/calendar-view.test.js`

**Interfaces:**
- `buildDashboardCalendar({events,sources,plannedWorkouts,actualActivities,now})`
- `buildCalendarMonth({events,sources,plannedWorkouts,monthKey})`

- [ ] **Step 1: Add failing dashboard planned-workout tests**

Fixture today + tomorrow + day-after-tomorrow. Assert only today/tomorrow appear in `plannedWorkouts`; today's stays even when completion matcher marks it completed.

```js
assert.equal(model.plannedWorkouts.length,2);
assert.equal(model.plannedWorkouts[0].day,'today');
assert.equal(model.plannedWorkouts[0].completed,true);
assert.equal(model.plannedWorkouts[1].day,'tomorrow');
```

- [ ] **Step 2: Implement conservative completion matching**

Match only when date matches and normalized sport/type plus normalized name are sufficiently exact. If ambiguous, return `completed:false`/`completionKnown:false`; never guess based solely on “an activity happened today”.

- [ ] **Step 3: Add failing full-month workout tests**

Assert September plan appears in September bucket; October plan does not; provider event behavior is unchanged; workout view model source is `Planned Workout` and has no provider ID/external provider URL.

- [ ] **Step 4: Implement month merge**

Project planned workouts by their local `date` directly into day buckets after provider projection. Keep them out of provider source arrays/tables.

- [ ] **Step 5: Run calendar regression tests and commit**

```bash
node test/calendar-dashboard.test.js
node test/calendar-view.test.js
node test/calendars-domain.test.js
node test/calendar-digest.test.js
git add src/domain/calendars.js test/calendar-dashboard.test.js test/calendar-view.test.js
git commit -m "feat: add planned workouts to calendar views"
```

---

### Task 8: Assemble cached digest/workout context into routes

**Repository:** `ppodolske/preston-run`

**Files:**
- Modify: `src/routes/site.js`
- Modify: `src/routes/calendars.js`
- Modify: `test/routes.test.js`
- Modify: `test/calendar-view-routes.test.js`

**Interfaces:**
- Home renderer receives `morningDigest`, `fitnessFreshness`, and calendar model including `plannedWorkouts`.
- Calendar renderer receives month model containing provider events + planned workouts.

- [ ] **Step 1: Add failing home-route cache-only test**

Stub `getFitnessContext`/`getMorningDigest`; provide a `fetch` stub that throws if called. Assert GET `/` renders successfully and no live D&S call occurs.

- [ ] **Step 2: Add failing no-cache isolation test**

Fitness data read throws/returns null while calendar/life/trips succeed. Assert status 200; digest/workouts show unavailable/empty states only.

- [ ] **Step 3: Wire home route**

Load fitness context/digest in its own try/catch. Pass `payload.plannedWorkouts` + `actualActivities` into `buildDashboardCalendar`.

- [ ] **Step 4: Add `/calendar` cache-only planned-workout route test**

Assert full month includes workout while no live D&S client is invoked.

- [ ] **Step 5: Wire calendar route**

Read cached fitness context independently of provider calendar read; if one source fails, render the other.

- [ ] **Step 6: Run tests and commit**

```bash
node test/routes.test.js
node test/calendar-view-routes.test.js
git add src/routes/site.js src/routes/calendars.js test/routes.test.js test/calendar-view-routes.test.js
git commit -m "feat: assemble fitness briefing context"
```

---

### Task 9: Redesign Morning Digest and fix UAT dashboard UI

**Repository:** `ppodolske/preston-run`

**Files:**
- Modify: `src/pages/home.js`
- Modify: `src/pages/calendar-view.js`
- Modify: `src/pages/calendars.js`
- Modify: `src/branding.js`
- Modify: `test/pages.test.js`
- Modify: `test/calendars-pages.test.js`
- Modify: `test/calendar-view.test.js` or page renderer test as appropriate

**Interfaces:**
- Consumes the view models from Tasks 7–8 only; no data fetching in renderers.

- [ ] **Step 1: Write failing renderer assertions for Morning Digest structure**

Assert HTML includes a full-width `data-section="morning-digest"`, headline/status/freshness, and detail cards with semantic IDs/classes for Recovery, Today's Training, Weight Trend, Recent Training / Context.

- [ ] **Step 2: Write failing launcher/admin/mobile/naming assertions**

Assert:

```js
assert.match(html,/park-favicon\.svg/);
assert.match(html,/\/icon\.svg/); // Archive book deployed path
assert.match(html,/class="website-admin-grid"/);
assert.match(html,/@media[\s\S]*max-width:[\s\S]*width:100%/);
assert.doesNotMatch(calendarSettingsHtml,/\bPreston may use\b/);
assert.match(calendarSettingsHtml,/preston\.ai may use/);
```

Also assert Website Admin has separate Site/GitHub/Railway actions rather than one short strip.

- [ ] **Step 3: Update stable app icon metadata**

Use deployed stable assets:

```js
Parks.icon = `${PARKS_URL}/park-favicon.svg`;
Archive.icon = `${ARCHIVE_URL}/icon.svg`;
```

Retain maintained D&S launcher icon. Keep fallback behavior.

- [ ] **Step 4: Implement full-width digest presentation**

Place digest immediately below header and above the 3-column dashboard. Use one headline/status card and responsive detail-card grid. Include generated time, source Garmin/context freshness, `Open Dose & Scale`, and authenticated Refresh form/button.

- [ ] **Step 5: Add Planned Workouts fourth calendar group**

Render today/tomorrow with day label and quiet Completed badge when completion is known true. Keep today visible after completion.

- [ ] **Step 6: Restore Website Admin card structure**

Use a full-width section with substantial cards. Desktop: row/grid. Mobile: stacked full-width cards. Preserve open/GitHub/Railway actions.

- [ ] **Step 7: Fix mobile width rules explicitly**

At mobile breakpoint set the main grid, each section/card, digest cards, launcher container, and admin cards to `width:100%; min-width:0; max-width:none;` as needed and prevent desktop grid-column sizing from carrying over.

- [ ] **Step 8: Audit touched product copy**

Replace product-reference “Preston” with `preston.ai`, including Calendar Settings lead text.

- [ ] **Step 9: Render planned workouts in `/calendar`**

Use dedicated `Planned Workout` styling/source label; no provider link.

- [ ] **Step 10: Run focused renderer tests and commit**

```bash
node test/pages.test.js
node test/calendars-pages.test.js
node test/calendar-view.test.js
git add src/pages/home.js src/pages/calendar-view.js src/pages/calendars.js src/branding.js test/pages.test.js test/calendars-pages.test.js test/calendar-view.test.js
git commit -m "fix: refine v0.11 daily dashboard UAT"
```

---

### Task 10: Prove digest parity, then remove D&S Morning Digest UI

**Repositories:** both

**Files:**
- Dose & Scale: modify `server.js`, `public/morning-digest-v12.4.0.js` only as needed to stop injection/execution.
- preston.ai: extend `test/morning-digest.test.js` with parity fixtures if gaps are found.

**Interfaces:** preston.ai is canonical digest owner after this task.

- [ ] **Step 1: Create shared parity fixtures manually from D&S current logic**

Use at least four fixture scenarios: healthy, low sleep, poor multi-signal recovery, no recovery data. For each, record expected D&S status/headline classification and critical recommendation wording/meaning.

- [ ] **Step 2: Run preston.ai digest tests against all parity fixtures**

```bash
node test/morning-digest.test.js
```

Expected: PASS for status/threshold/recommendation semantics.

- [ ] **Step 3: Only after parity passes, remove old D&S script injection**

From `server.js` injection tags remove:

```html
<script src="/morning-digest-v12.4.0.js"></script>
```

Do not delete the historical file in this release; leave it unreferenced for rollback/debug history.

- [ ] **Step 4: Add D&S regression assertion**

Test served app HTML does not inject `morning-digest-v12.4.0.js`, while `/api/preston/daily-context` still works.

- [ ] **Step 5: Run D&S suite and commit**

```bash
npm test
node --check server.js
git add server.js test/preston-context-route.test.js
git commit -m "refactor: move morning digest to preston ai"
```

---

### Task 11: CI, full regression, and security verification

**Repositories:** both

**Files:**
- preston.ai: modify `.github/workflows/ci.yml`, `test.js` as needed.
- Dose & Scale: add `.github/workflows/ci.yml` only if no CI exists; otherwise modify existing CI.

**Interfaces:** both candidate SHAs must be independently green before UAT.

- [ ] **Step 1: Register every new preston.ai test in `test.js`**

Ensure suite includes fitness migration/data/client/service/job/digest plus all existing calendar/reminder tests.

- [ ] **Step 2: Add syntax checks**

At minimum:

```bash
node --check src/data/fitness-context.js
node --check src/services/dose-scale-client.js
node --check src/services/fitness-context.js
node --check src/domain/morning-digest.js
node --check src/jobs/fitness-context-sync.js
node --check src/pages/home.js
node --check src/pages/calendar-view.js
```

- [ ] **Step 3: Ensure D&S CI runs `npm test` and syntax checks**

If adding workflow, use checkout + Node 22 + `npm ci --no-audit --no-fund` + `npm test` + `node --check server.js` + `node --check lib/preston-context.js`.

- [ ] **Step 4: Run full preston.ai suite locally/CI**

```bash
npm ci --no-audit --no-fund
npm test
```

Explicitly verify `calendar-digest`, `reminder-engine`, `reminder-job`, and `calendar-sync-job` remain green.

- [ ] **Step 5: Run full D&S suite locally/CI**

```bash
npm ci --no-audit --no-fund
npm test
```

- [ ] **Step 6: Security review assertions**

Confirm from code/tests:
- D&S service token never appears in HTML or browser JS;
- browser Basic Auth does not authorize service endpoint;
- D&S endpoint does not return full app state;
- preston.ai renderer never imports/calls D&S client directly;
- failed refresh preserves existing cache;
- no planned workout is inserted into `calendar_events` or reminder tables.

- [ ] **Step 7: Commit CI/test registration**

Use separate commits in each repo, e.g.:

```bash
git commit -m "test: verify v0.11 fitness briefing integration"
```

---

### Task 12: Coordinated UAT deployment and acceptance

**Repositories/Infrastructure:** both + Supabase + Railway

**Interfaces:** verified candidate SHAs only; no production promotion.

- [ ] **Step 1: Apply preston.ai migration to Supabase**

Apply `20260913101500_v0110_fitness_context_digest.sql` and verify both tables, RLS, and owner policies.

- [ ] **Step 2: Configure shared service secret**

Generate one strong random secret. Set the same value as:
- Dose & Scale: `PRESTON_SERVICE_TOKEN`
- preston.ai UAT web + fitness sync worker: `DOSE_SCALE_SERVICE_TOKEN`

Set preston.ai `DOSE_SCALE_CONTEXT_URL` to the D&S internal/public endpoint base as appropriate. Never print the token in logs/chat.

- [ ] **Step 3: Deploy D&S integration branch to a safe test/UAT target**

If D&S has no separate UAT service, do not replace production automatically. Create/use a temporary Railway service or branch deployment for contract verification first. Verify endpoint returns 401 without token and schema v1 with token.

- [ ] **Step 4: Deploy preston.ai candidate to `preston-run-uat`**

Pin the exact green SHA and keep production `preston-run-hub` untouched.

- [ ] **Step 5: Create/configure UAT fitness sync worker**

Command:

```text
npm run job:fitness:sync
```

Schedule with the existing dual-UTC-hour + Sydney-local gate so execution occurs at 07:15 local across DST. Restart policy NEVER, same region convention as other scheduled workers.

- [ ] **Step 6: Trigger one manual refresh in UAT**

Verify cache row exists, digest row exists for Sydney date, and source timestamps/freshness are sensible.

- [ ] **Step 7: Desktop acceptance**

Check:
- Morning Digest spans full content width and uses preston.ai card styling;
- dashboard still has compact three-column structure below it;
- Calendar has Personal, Holidays, Reminders, Planned Workouts;
- today + tomorrow plans remain visible, including completed today plan;
- Parks uses tree icon; Archive uses book icon;
- Website Admin has substantial cards/actions;
- product copy says `preston.ai`;
- freshness text is quiet but visible.

- [ ] **Step 8: Mobile acceptance**

Check all digest/dashboard/admin cards occupy full available width; Parks/Archive icons and Website Admin structure match desktop intent; no horizontal overflow; order matches spec.

- [ ] **Step 9: Full calendar acceptance**

Check current month includes imported events + planned workouts, month navigation works, planned workouts have dedicated styling, provider IDs are not exposed, and normal render does not trigger sync/live D&S calls.

- [ ] **Step 10: Failure acceptance**

Temporarily point UAT D&S context URL to an unreachable test URL or use a mocked failure path; run refresh; verify last good snapshot/digest remains, only freshness becomes stale, and other dashboard domains remain usable. Restore URL afterward.

- [ ] **Step 11: Stop at release gate**

Document exact green SHAs, Railway deployment IDs, migration status, and acceptance results. Do **not** merge either repo to production or change production D&S behavior beyond an explicitly approved release.

---

## Execution Order / Dependency Map

1. **D&S Tasks 1–2** establish the constrained contract.
2. **preston.ai Tasks 3–6** establish cache, digest ownership, and refresh mechanics.
3. **preston.ai Tasks 7–9** integrate workouts and UAT visual fixes.
4. **Task 10** removes the old D&S Morning Digest only after parity is proven.
5. **Task 11** creates green release candidates in both repos.
6. **Task 12** performs coordinated UAT and stops for explicit release approval.

Do not reorder Task 10 ahead of parity verification. Do not make the preston.ai dashboard depend on a live D&S response to render.

## Self-Review Checklist

- Every revised spec requirement maps to a task: D&S constrained feed (1–2), cache/failure retention (3–4), preston.ai digest ownership/parity (5,10), 07:15 refresh/manual refresh (6), planned workouts dashboard/month view/completion context (7–8), UAT visual fixes/naming/icons/mobile/admin (9), security/regression (11), coordinated UAT (12).
- No task inserts planned workouts into `calendar_events`, Google/Apple, reminder rows, Life Admin, or tasks.
- D&S browser Basic Auth and service bearer auth are explicitly separate.
- The cache schema and function/property names are consistent across Tasks 3–9.
- Morning Digest removal from D&S is explicitly gated on parity and occurs late.
- No production deployment is part of the plan.
