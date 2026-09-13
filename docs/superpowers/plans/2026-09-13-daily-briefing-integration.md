# preston.ai v0.11.0 Daily Briefing Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the unreleased v0.11.0 dashboard by making preston.ai own the Morning Digest, ingesting a constrained Dose & Scale context feed, adding planned workouts to dashboard/full-calendar context, and resolving the UAT layout/icon/naming issues.

**Architecture:** `ppodolske/dose-and-scale` exposes one dedicated bearer-authenticated read-only endpoint backed by a pure context builder. `ppodolske/preston-run` fetches that endpoint only from a scheduled/manual server-side refresh, stores the last successful context in Supabase, generates/persists the Morning Digest locally, and merges cached planned workouts into existing calendar view models. Normal dashboard and `/calendar` requests remain cache-backed and never call D&S, Google, or Apple live.

**Tech Stack:** Node.js/CommonJS, Express, PostgreSQL, Supabase/Postgres, server-rendered HTML/CSS/vanilla JS, Railway scheduled services, Node `assert`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-13-daily-dashboard-design.md`

## Global Constraints

- Feature version stays exactly `v0.11.0`.
- preston.ai branch stays `build/preston-ai-v0.11.0`.
- Create D&S branch `build/preston-ai-v0.11.0-integration` from current `main` before code changes.
- No production merge/deploy in either repo without explicit approval after coordinated UAT.
- User-facing product references use `preston.ai` exactly, lowercase.
- D&S browser Basic Auth credentials are never reused as service credentials.
- D&S endpoint returns a constrained schema, never full `app_state`.
- preston.ai page renders use only local cached fitness context; no live D&S request on GET `/` or GET `/calendar`.
- Scheduled fitness refresh targets 07:15 Australia/Sydney and uses DST-safe local gating.
- A failed refresh never deletes/replaces the last successful cache row.
- Planned workouts are read-only view-model items only: never write them to `calendar_events`, Google, Apple, Life Admin, tasks, or reminders.
- Today and tomorrow planned workouts stay visible even if today is completed.
- `/calendar` shows all cached planned workouts that fall in the visible month.
- Existing calendar OAuth scopes and existing 06:55/07:05/noon/18:00 scheduled behaviors stay unchanged.
- Parks launcher uses its tree asset; Archive launcher uses its book asset.
- Mobile digest/dashboard/admin cards are 100% width within standard page padding.

---

## File Map

### Dose & Scale

Create:
- `lib/preston-context.js` — pure normalization/aggregation from D&S state.
- `lib/preston-service.js` — dedicated bearer auth + HTTP handler factory, independent of server bootstrap.
- `test/preston-context.test.js` — contract/minimization tests.
- `test/preston-service.test.js` — service auth/handler tests.
- `test/run.js` — sequential local test runner.

Modify:
- `server.js` — wire the service route before `app.use(auth)`; later stop injecting the old Morning Digest script after parity.
- `package.json` — add `test` script.

### preston.ai

Create:
- `supabase/migrations/20260913101500_v0110_fitness_context_digest.sql`
- `src/data/fitness-context.js`
- `src/services/dose-scale-client.js`
- `src/domain/morning-digest.js`
- `src/services/fitness-context.js`
- `src/jobs/fitness-context-sync.js`
- `test/fitness-context-migration.test.js`
- `test/fitness-context-data.test.js`
- `test/dose-scale-client.test.js`
- `test/morning-digest.test.js`
- `test/fitness-context-service.test.js`
- `test/fitness-context-job.test.js`

Modify:
- `src/config.js`
- `src/domain/calendars.js`
- `src/routes/site.js`
- `src/routes/calendars.js`
- `src/pages/home.js`
- `src/pages/calendar-view.js`
- `src/pages/calendars.js`
- `src/branding.js`
- `package.json`
- `test.js`
- `.github/workflows/ci.yml`
- existing dashboard/calendar/page tests.

---

### Task 1: Build the constrained D&S context contract

**Repository:** `ppodolske/dose-and-scale`

**Files:**
- Create: `lib/preston-context.js`
- Create: `test/preston-context.test.js`
- Create: `test/run.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: D&S state object.
- Produces: `buildPrestonDailyContext(state, now)`.

- [ ] **Step 1: Create branch**

```bash
git switch main
git pull --ff-only
git switch -c build/preston-ai-v0.11.0-integration
```

- [ ] **Step 2: Write failing contract test**

`test/preston-context.test.js`:

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
assert.equal(out.recovery.date,'2026-09-13');
assert.equal(out.plannedWorkouts.length,3);
assert.deepEqual(Object.keys(out).sort(),[
  'actualActivities','baseline','generatedAt','garminSyncAt','intervention',
  'phase','plannedWorkouts','recentTraining','recovery','schemaVersion','weightTrend'
].sort());
assert.equal(Object.hasOwn(out,'entries'),false);
assert.equal(Object.hasOwn(out,'morningDigests'),false);
console.log('preston context contract tests passed');
```

- [ ] **Step 3: Verify red**

```bash
node test/preston-context.test.js
```

Expected: FAIL with module-not-found.

- [ ] **Step 4: Implement pure builder**

Public shape:

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

Planned workout output is limited to:

```js
{id,date,name,sport,durationMinutes,distanceKm,description}
```

Actual activity output is limited to:

```js
{date,name,type,durationMinutes,distanceKm}
```

- [ ] **Step 5: Create runner with only existing test**

`test/run.js`:

```js
require('./preston-context.test');
```

`package.json` scripts become:

```json
{"start":"node login-wrapper.js","test":"node test/run.js"}
```

- [ ] **Step 6: Verify green**

```bash
npm test
node --check lib/preston-context.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/preston-context.js test/preston-context.test.js test/run.js package.json
git commit -m "feat: build preston daily context feed"
```

---

### Task 2: Add D&S service bearer auth and endpoint

**Repository:** `ppodolske/dose-and-scale`

**Files:**
- Create: `lib/preston-service.js`
- Create: `test/preston-service.test.js`
- Modify: `test/run.js`
- Modify: `server.js`

**Interfaces:**
- Consumes: `buildPrestonDailyContext`, PostgreSQL pool, `PRESTON_SERVICE_TOKEN`.
- Produces: `createPrestonContextHandler({pool,token,now})` and `prestonBearerAuth(expectedToken)`; route `GET /api/preston/daily-context`.

- [ ] **Step 1: Write failing service-module test**

```js
const assert=require('node:assert/strict');
const {prestonBearerAuth,createPrestonContextHandler}=require('../lib/preston-service');

function response(){
  return {statusCode:200,body:null,status(n){this.statusCode=n;return this},json(v){this.body=v;return this}};
}

const auth=prestonBearerAuth('service-secret');
let nextCalled=false;
auth({headers:{authorization:'Basic abc'}},response(),()=>{nextCalled=true});
assert.equal(nextCalled,false);
const bad=response();auth({headers:{authorization:'Bearer wrong'}},bad,()=>{});assert.equal(bad.statusCode,401);
const good=response();auth({headers:{authorization:'Bearer service-secret'}},good,()=>{nextCalled=true});assert.equal(nextCalled,true);

const pool={query:async()=>({rows:[{state:{plannedWorkouts:[]}}]})};
const handler=createPrestonContextHandler({pool,now:()=>new Date('2026-09-13T21:00:00Z')});
const res=response();await handler({},res,e=>{throw e});
assert.equal(res.body.schemaVersion,1);
console.log('preston service tests passed');
```

- [ ] **Step 2: Verify red**

```bash
node test/preston-service.test.js
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement isolated service module**

`lib/preston-service.js`:

```js
const crypto=require('crypto');
const {buildPrestonDailyContext}=require('./preston-context');

function safeEqual(a,b){
  const aa=Buffer.from(String(a||'')),bb=Buffer.from(String(b||''));
  return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);
}
function prestonBearerAuth(expectedToken){
  return (req,res,next)=>{
    const header=req.headers.authorization||'';
    const token=header.startsWith('Bearer ')?header.slice(7):'';
    if(!expectedToken||!safeEqual(token,expectedToken))return res.status(401).json({error:'unauthorized'});
    next();
  };
}
function createPrestonContextHandler({pool,now=()=>new Date()}){
  return async(_req,res,next)=>{
    try{
      const r=await pool.query('SELECT state FROM app_state WHERE id=1');
      return res.json(buildPrestonDailyContext(r.rows[0]?.state||{},now()));
    }catch(error){return next(error)}
  };
}
module.exports={prestonBearerAuth,createPrestonContextHandler};
```

- [ ] **Step 4: Wire route before browser Basic Auth**

In `server.js`, before `app.use(auth)`:

```js
const {prestonBearerAuth,createPrestonContextHandler}=require('./lib/preston-service');
app.get(
  '/api/preston/daily-context',
  prestonBearerAuth(process.env.PRESTON_SERVICE_TOKEN||''),
  createPrestonContextHandler({pool})
);
```

This route must appear before `app.use(auth)` so browser Basic Auth is neither required nor sufficient.

- [ ] **Step 5: Register service test**

`test/run.js`:

```js
require('./preston-context.test');
require('./preston-service.test');
```

- [ ] **Step 6: Verify green**

```bash
npm test
node --check server.js
node --check lib/preston-service.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/preston-service.js test/preston-service.test.js test/run.js server.js
git commit -m "feat: expose preston context endpoint"
```

---

### Task 3: Add preston.ai cache/digest persistence

**Repository:** `ppodolske/preston-run`

**Files:**
- Create: `supabase/migrations/20260913101500_v0110_fitness_context_digest.sql`
- Create: `src/data/fitness-context.js`
- Create: `test/fitness-context-migration.test.js`
- Create: `test/fitness-context-data.test.js`
- Modify: `test.js`

**Interfaces:**
- `getFitnessContext(supabase,userId)`
- `upsertFitnessContext(supabase,userId,{payload,sourceGeneratedAt,garminSyncAt,fetchedAt})`
- `getMorningDigest(supabase,userId,dateKey)`
- `upsertMorningDigest(supabase,userId,digest)`

- [ ] **Step 1: Write failing migration test**

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

- [ ] **Step 3: Implement schema**

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

Enable RLS; add owner CRUD policies and privilege restrictions matching existing project migration style.

- [ ] **Step 4: Write failing data-layer tests**

Use the existing fake Supabase chain style. Assert every read/write scopes by `user_id`; context upsert conflicts on `user_id`; digest upsert conflicts on `user_id,digest_date`.

- [ ] **Step 5: Implement data module**

`getFitnessContext` returns the one owner row or null. `upsertFitnessContext` accepts only a validated payload from the service layer. `getMorningDigest` selects by owner + `digest_date`.

- [ ] **Step 6: Verify and commit**

```bash
node test/fitness-context-migration.test.js
node test/fitness-context-data.test.js
git add supabase/migrations/20260913101500_v0110_fitness_context_digest.sql src/data/fitness-context.js test/fitness-context-migration.test.js test/fitness-context-data.test.js test.js
git commit -m "feat: add fitness context cache"
```

---

### Task 4: Add preston.ai D&S client and last-good refresh orchestration

**Repository:** `ppodolske/preston-run`

**Files:**
- Create: `src/services/dose-scale-client.js`
- Create: `src/services/fitness-context.js`
- Modify: `src/config.js`
- Create: `test/dose-scale-client.test.js`
- Create: `test/fitness-context-service.test.js`

**Interfaces:**
- Config: `DOSE_SCALE_CONTEXT_URL`, `DOSE_SCALE_SERVICE_TOKEN`.
- `fetchDoseScaleContext({fetchImpl,url,token,timeoutMs})`
- `refreshFitnessContext({supabase,userId,fetchContext,now,forceDigest})`

- [ ] **Step 1: Write failing client test**

```js
const payload=await fetchDoseScaleContext({
  fetchImpl:async(url,opts)=>{
    assert.equal(opts.headers.Authorization,'Bearer secret');
    assert.equal(opts.cache,'no-store');
    return {ok:true,json:async()=>({schemaVersion:1,plannedWorkouts:[]})};
  },
  url:'https://dose.test/api/preston/daily-context',token:'secret'
});
assert.equal(payload.schemaVersion,1);
```

Also assert missing token/URL, non-2xx, invalid schemaVersion, and non-array plannedWorkouts reject.

- [ ] **Step 2: Implement client**

Use AbortController with bounded timeout. Do not log token or Authorization header.

- [ ] **Step 3: Write failing last-good service test**

```js
let writes=0;
const failed=await refreshFitnessContext({
  supabase,userId:'u1',fetchContext:async()=>{throw new Error('down')},now:new Date()
});
assert.equal(failed.ok,false);
assert.equal(writes,0);
```

In the success fixture assert exactly one cache upsert occurs.

- [ ] **Step 4: Implement orchestration**

```js
async function refreshFitnessContext({supabase,userId,fetchContext=fetchConfiguredDoseScaleContext,now=new Date(),forceDigest=false}){
  try{
    const payload=await fetchContext();
    await upsertFitnessContext(supabase,userId,{
      payload,
      sourceGeneratedAt:payload.generatedAt||null,
      garminSyncAt:payload.garminSyncAt||null,
      fetchedAt:now.toISOString()
    });
    return {ok:true,payload,forceDigest};
  }catch(error){
    return {ok:false,error};
  }
}
```

Digest persistence is added in Task 5; keep this task green independently.

- [ ] **Step 5: Verify and commit**

```bash
node test/dose-scale-client.test.js
node test/fitness-context-service.test.js
git add src/services/dose-scale-client.js src/services/fitness-context.js src/config.js test/dose-scale-client.test.js test/fitness-context-service.test.js
git commit -m "feat: refresh dose scale context"
```

---

### Task 5: Port Morning Digest ownership to preston.ai

**Repository:** `ppodolske/preston-run`

**Files:**
- Create: `src/domain/morning-digest.js`
- Create: `test/morning-digest.test.js`
- Modify: `src/services/fitness-context.js`
- Modify: `test/fitness-context-service.test.js`

**Interfaces:**
- `buildMorningDigest(context,dateKey,now)` -> `{schemaVersion,date,status,headline,cards,bullets,generatedAt,sourceGeneratedAt,garminSyncAt}`.

- [ ] **Step 1: Write parity tests**

```js
assert.equal(buildMorningDigest(noRecovery,'2026-09-13',now).status,'insufficient');
assert.equal(buildMorningDigest(healthy,'2026-09-13',now).status,'good');
assert.equal(buildMorningDigest(lowSleepHighRhr,'2026-09-13',now).status,'poor');
assert.match(buildMorningDigest(withPlan,'2026-09-13',now).bullets.join(' '),/Today.s plan/i);
```

Assert card IDs include `recovery`, `training`, `weight`, `context` when those sources exist.

- [ ] **Step 2: Verify red**

```bash
node test/morning-digest.test.js
```

- [ ] **Step 3: Port current D&S interpretation logic**

Copy the substantive thresholds/meaning from `public/morning-digest-v12.4.0.js`, not its DOM code. Preserve status semantics and training/weight/context recommendations. Do not add calendar/Life Admin recommendations yet.

- [ ] **Step 4: Extend refresh service to persist digest**

After successful context upsert:
1. resolve Sydney `dateKey`;
2. load current digest for date;
3. regenerate only if absent, source timestamp changed, or `forceDigest===true`;
4. upsert digest.

A failed D&S fetch must not regenerate from an empty payload and must not overwrite cache/digest.

- [ ] **Step 5: Verify and commit**

```bash
node test/morning-digest.test.js
node test/fitness-context-service.test.js
git add src/domain/morning-digest.js src/services/fitness-context.js test/morning-digest.test.js test/fitness-context-service.test.js
git commit -m "feat: move morning digest to preston ai"
```

---

### Task 6: Schedule 07:15 refresh and add manual refresh

**Repository:** `ppodolske/preston-run`

**Files:**
- Create: `src/jobs/fitness-context-sync.js`
- Create: `test/fitness-context-job.test.js`
- Modify: `package.json`
- Modify: `src/routes/site.js`
- Modify: `test/routes.test.js`

**Interfaces:**
- npm script: `job:fitness:sync`.
- POST `/fitness-context/refresh` authenticated owner action.

- [ ] **Step 1: Write failing Sydney-gate job test**

Use fixed AEDT and AEST instants. Assert refresh runs only when local Sydney time is 07:15. Reuse the pattern from existing `calendar-sync.js`/`reminders.js` rather than creating a new scheduler abstraction.

- [ ] **Step 2: Implement job**

Resolve owner/background Supabase, call `refreshFitnessContext`, log success or retained-stale-cache failure. Do not log secrets or the full fitness payload.

- [ ] **Step 3: Add script**

```json
"job:fitness:sync":"node src/jobs/fitness-context-sync.js"
```

- [ ] **Step 4: Write failing manual route test**

Assert unauthenticated POST is rejected/redirected; owner POST calls server refresh and redirects to `/` with a compact status query/flash.

- [ ] **Step 5: Implement manual route**

Call `refreshFitnessContext({forceDigest:true})` server-side. No client JS receives D&S credentials.

- [ ] **Step 6: Verify and commit**

```bash
node test/fitness-context-job.test.js
node test/routes.test.js
git add src/jobs/fitness-context-sync.js test/fitness-context-job.test.js package.json src/routes/site.js test/routes.test.js
git commit -m "feat: schedule fitness context refresh"
```

---

### Task 7: Add planned workouts to both calendar models

**Repository:** `ppodolske/preston-run`

**Files:**
- Modify: `src/domain/calendars.js`
- Modify: `test/calendar-dashboard.test.js`
- Modify: `test/calendar-view.test.js`

**Interfaces:**
- `buildDashboardCalendar({events,sources,plannedWorkouts=[],actualActivities=[],now})`
- `buildCalendarMonth({events,sources,plannedWorkouts=[],monthKey})`

- [ ] **Step 1: Write failing dashboard tests**

Fixture one today, one tomorrow, one later workout. Assert only today/tomorrow in dashboard and today remains present when completed.

```js
assert.equal(model.plannedWorkouts.length,2);
assert.equal(model.plannedWorkouts[0].day,'today');
assert.equal(model.plannedWorkouts[0].completed,true);
assert.equal(model.plannedWorkouts[1].day,'tomorrow');
```

- [ ] **Step 2: Implement conservative completion matching**

Only mark completed when same date plus normalized sport/type and normalized workout/activity name match reliably. Return `completionKnown:false` when ambiguous; never infer from “some activity occurred today”.

- [ ] **Step 3: Write failing month tests**

September plan appears in September day bucket; October plan does not. Planned workout item uses source label `Planned Workout`, has no provider calendar ID, and has no provider URL.

- [ ] **Step 4: Implement month projection**

Project workouts by local `date` into day buckets after imported provider events. Do not add them to provider source lists or data tables.

- [ ] **Step 5: Verify calendar regressions and commit**

```bash
node test/calendar-dashboard.test.js
node test/calendar-view.test.js
node test/calendars-domain.test.js
node test/calendar-digest.test.js
git add src/domain/calendars.js test/calendar-dashboard.test.js test/calendar-view.test.js
git commit -m "feat: add planned workouts to calendar views"
```

---

### Task 8: Route cached digest/workouts into home and `/calendar`

**Repository:** `ppodolske/preston-run`

**Files:**
- Modify: `src/routes/site.js`
- Modify: `src/routes/calendars.js`
- Modify: `test/routes.test.js`
- Modify: `test/calendar-view-routes.test.js`

**Interfaces:**
- Home renderer gets `morningDigest`, `fitnessContext`, `fitnessUnavailable`.
- Calendar renderer gets a month model already merged with planned workouts.

- [ ] **Step 1: Write cache-only home route test**

Inject/stub cache readers. Make any D&S client stub throw if invoked. Assert GET `/` still returns 200 and includes digest/workout data from cache.

- [ ] **Step 2: Write no-cache failure-isolation test**

Fitness cache/digest unavailable while calendar/life/trips work. Assert 200 and only digest/planned-workout surfaces degrade.

- [ ] **Step 3: Implement home assembly**

Load fitness cache + digest in their own try/catch. Feed cached `plannedWorkouts` and `actualActivities` into `buildDashboardCalendar`.

- [ ] **Step 4: Write `/calendar` cache-only test**

Assert cached plan appears in month view and no D&S fetch function is called.

- [ ] **Step 5: Implement calendar assembly**

Load provider calendar cache and fitness cache independently. One may render even if the other fails.

- [ ] **Step 6: Verify and commit**

```bash
node test/routes.test.js
node test/calendar-view-routes.test.js
git add src/routes/site.js src/routes/calendars.js test/routes.test.js test/calendar-view-routes.test.js
git commit -m "feat: assemble fitness briefing context"
```

---

### Task 9: Apply UAT visual fixes and full-width Morning Digest

**Repository:** `ppodolske/preston-run`

**Files:**
- Modify: `src/pages/home.js`
- Modify: `src/pages/calendar-view.js`
- Modify: `src/pages/calendars.js`
- Modify: `src/branding.js`
- Modify: `test/pages.test.js`
- Modify: `test/calendars-pages.test.js`
- Modify: relevant calendar page tests.

**Interfaces:** renderers consume only already-built models.

- [ ] **Step 1: Write failing Morning Digest markup test**

Assert `data-section="morning-digest"`, headline/status/freshness, and detail cards for Recovery, Today's Training, Weight Trend, and Recent Training / Context.

- [ ] **Step 2: Write failing UAT regression assertions**

```js
assert.match(html,/park-favicon\.svg/);
assert.match(html,/\/icon\.svg/); // Archive book path
assert.match(html,/website-admin-grid/);
assert.doesNotMatch(calendarSettingsHtml,/\bPreston may use\b/);
assert.match(calendarSettingsHtml,/preston\.ai may use/);
```

Also assert mobile CSS explicitly sets relevant cards/containers to full available width and Website Admin renders separate action cards.

- [ ] **Step 3: Correct stable launcher icon metadata**

```js
parks.icon=`${parks.url.replace(/\/$/,'')}/park-favicon.svg`;
archive.icon=`${archive.url.replace(/\/$/,'')}/icon.svg`;
```

Keep D&S maintained icon and existing fallback.

- [ ] **Step 4: Render full-width digest**

Place immediately under header, above three-column dashboard. Render one full-width status/headline card plus responsive detail-card grid. Include digest generated time, source/Garmin freshness, `Open Dose & Scale`, and manual Refresh form.

- [ ] **Step 5: Render Planned Workouts group**

Fourth dashboard calendar group, today/tomorrow. Completed today plan gets a quiet Completed badge but remains visible.

- [ ] **Step 6: Restore Website Admin cards**

Full-width section; substantial cards with site/open, GitHub, Railway actions. Desktop grid; mobile stacked full-width.

- [ ] **Step 7: Fix mobile width**

At mobile breakpoint ensure dashboard grid, each card, digest cards, app container, and admin cards have `width:100%; min-width:0; max-width:none` where required and remove inherited grid-column constraints.

- [ ] **Step 8: Clean product naming**

Change Calendar Settings copy and touched UI product references from `Preston` to `preston.ai`.

- [ ] **Step 9: Render planned workouts in `/calendar`**

Dedicated visual treatment labeled `Planned Workout`; no provider link.

- [ ] **Step 10: Verify and commit**

```bash
node test/pages.test.js
node test/calendars-pages.test.js
node test/calendar-view.test.js
git add src/pages/home.js src/pages/calendar-view.js src/pages/calendars.js src/branding.js test/pages.test.js test/calendars-pages.test.js test/calendar-view.test.js
git commit -m "fix: refine v0.11 daily dashboard UAT"
```

---

### Task 10: Prove digest parity, then stop D&S from rendering it

**Repositories:** both

**Files:**
- D&S: Modify `server.js`, `test/preston-service.test.js` or add served-HTML regression test.
- preston.ai: Extend `test/morning-digest.test.js` if parity fixtures expose gaps.

**Interfaces:** preston.ai becomes sole canonical Morning Digest owner.

- [ ] **Step 1: Define four parity fixtures**

Use existing D&S logic for: healthy recovery, low sleep/watch, multi-signal poor recovery, no recovery data. Record expected status, headline meaning, and critical recommendation semantics.

- [ ] **Step 2: Verify preston.ai parity**

```bash
node test/morning-digest.test.js
```

Expected: all fixtures pass without changing substantive thresholds.

- [ ] **Step 3: Remove old D&S script injection only after parity passes**

Delete this tag from the `sendAppHtml` injection list:

```html
<script src="/morning-digest-v12.4.0.js"></script>
```

Leave the historical JS file in repository for rollback/history; do not execute it.

- [ ] **Step 4: Add D&S regression test**

Assert served/injection tag list no longer includes `morning-digest-v12.4.0.js`, while service context tests remain green.

- [ ] **Step 5: Verify and commit D&S change**

```bash
npm test
node --check server.js
git add server.js test
git commit -m "refactor: move morning digest to preston ai"
```

---

### Task 11: Full CI and security regression gate

**Repositories:** both

**Files:**
- preston.ai: Modify `test.js`, `.github/workflows/ci.yml`.
- D&S: Create `.github/workflows/ci.yml` only if still absent.

**Interfaces:** two independently green candidate SHAs.

- [ ] **Step 1: Register all preston.ai tests**

`test.js` must execute fitness migration/data/client/digest/service/job tests in addition to all existing tests.

- [ ] **Step 2: Add syntax checks to preston.ai CI**

```bash
node --check src/data/fitness-context.js
node --check src/services/dose-scale-client.js
node --check src/services/fitness-context.js
node --check src/domain/morning-digest.js
node --check src/jobs/fitness-context-sync.js
node --check src/pages/home.js
node --check src/pages/calendar-view.js
```

- [ ] **Step 3: Ensure D&S CI exists and runs**

Workflow steps: Node 22, `npm ci --no-audit --no-fund`, `npm test`, `node --check server.js`, `node --check lib/preston-context.js`, `node --check lib/preston-service.js`.

- [ ] **Step 4: Run full preston.ai suite**

```bash
npm ci --no-audit --no-fund
npm test
```

Explicitly confirm `calendar-digest`, `reminder-engine`, `reminder-job`, and `calendar-sync-job` remain green.

- [ ] **Step 5: Run full D&S suite**

```bash
npm ci --no-audit --no-fund
npm test
```

- [ ] **Step 6: Security/code-path review**

Verify:
- service token appears only server-side;
- Basic Auth cannot authorize D&S service route;
- constrained endpoint excludes raw app state;
- home/calendar renderers do not import D&S client;
- refresh failure preserves cache;
- no workout write targets `calendar_events` or reminder tables.

- [ ] **Step 7: Commit CI registration in each repo**

Use concise repo-specific commits such as:

```bash
git commit -m "test: verify v0.11 fitness briefing integration"
```

---

### Task 12: Coordinated UAT and release gate

**Systems:** Supabase + Railway + both repos.

- [ ] **Step 1: Apply migration**

Apply `20260913101500_v0110_fitness_context_digest.sql`; verify both tables, RLS enabled, owner policies present.

- [ ] **Step 2: Configure service secret without exposing it**

Generate a strong random secret. Set:
- D&S test/UAT service: `PRESTON_SERVICE_TOKEN`
- preston.ai UAT web + fitness worker: `DOSE_SCALE_SERVICE_TOKEN`
- preston.ai UAT: `DOSE_SCALE_CONTEXT_URL`

Do not paste/log the secret.

- [ ] **Step 3: Verify D&S integration on non-production target**

Prefer a temporary Railway service/branch deployment if D&S lacks UAT. Verify 401 without bearer token and schema v1 with correct token. Do not replace D&S production yet.

- [ ] **Step 4: Deploy exact green preston.ai SHA to `preston-run-uat`**

Production `preston-run-hub` remains untouched.

- [ ] **Step 5: Create/configure UAT fitness worker**

Start command:

```text
npm run job:fitness:sync
```

Use dual UTC cron coverage plus app-local Sydney gate for 07:15 across DST; restart NEVER; same region convention as existing jobs.

- [ ] **Step 6: Trigger one UAT manual refresh**

Verify one context-cache row and one current-Sydney-date digest row. Check generated/source/Garmin timestamps.

- [ ] **Step 7: Desktop visual acceptance**

Verify full-width digest, existing three-column dashboard below it, four calendar groups, today/tomorrow plans retained, tree/book icons, substantial Website Admin cards, `preston.ai` naming, and freshness cues.

- [ ] **Step 8: Mobile visual acceptance**

Verify every digest/dashboard/admin card uses full available width, no horizontal overflow, correct order, and desktop icon/admin structure survives mobile.

- [ ] **Step 9: Full calendar acceptance**

Verify provider events + all cached planned workouts for visible month, dedicated Planned Workout styling, working month navigation, no provider IDs, no live D&S/provider request on page load.

- [ ] **Step 10: Failure acceptance**

Use a safe mocked/unreachable UAT context URL for one refresh attempt; verify refresh reports failure while last-good cache/digest remains and other dashboard domains still work. Restore URL immediately afterward.

- [ ] **Step 11: Stop**

Record both green SHAs, Railway deployment IDs, migration status, and UAT results. Do not merge/deploy production until the user explicitly approves release.

---

## Dependency Order

1. Tasks 1–2: D&S contract and service endpoint.
2. Tasks 3–6: preston.ai cache, client, digest ownership, refresh schedule.
3. Tasks 7–9: planned-workout calendar integration and UAT UI fixes.
4. Task 10: remove D&S digest UI only after parity.
5. Task 11: two-repo green CI gate.
6. Task 12: coordinated UAT, then stop for release approval.

## Self-Review Results

- Spec coverage: D&S feed/auth, local cache, last-good behavior, Morning Digest ownership/parity, 07:15 refresh/manual refresh, planned workouts dashboard/month calendar, completed-today context, tree/book icons, Website Admin restoration, mobile full width, `preston.ai` naming, freshness, independent failures, and coordinated UAT are all assigned to explicit tasks.
- Placeholder scan: no TBD/TODO/“implement later” steps remain.
- Interface consistency: `schemaVersion`, `generatedAt`, `garminSyncAt`, `plannedWorkouts`, `actualActivities`, `buildMorningDigest`, cache/digest data functions, and calendar function arguments are consistent across producer/consumer tasks.
- Intermediate-green check: Task 1 test runner references only Task 1 tests; Task 2 registers its own test only after the file exists. D&S server bootstrap does not need to be imported by tests because service auth/handler logic is isolated in `lib/preston-service.js`.
- Safety check: Task 10 cannot remove the D&S Morning Digest UI before parity tests pass; Task 12 explicitly forbids production promotion.
