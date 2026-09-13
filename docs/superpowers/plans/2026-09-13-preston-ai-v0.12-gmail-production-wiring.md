# preston.ai v0.12 Gmail Production Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the `v0.12 Gmail Foundation` production wiring so the existing Gmail settings page, OAuth callback, and manual scan controls work with real server-side dependencies instead of only test-injected stubs.

**Architecture:** Keep the current dependency-injected Gmail route shape for tests, but provide real default production dependencies from focused service modules. `src/services/gmail-oauth.js` owns readonly OAuth URL construction, token exchange, and account-profile lookup; `src/services/gmail-manual-scan.js` owns connection lookup, token decryption, Gmail provider creation, persistence adapters, and manual scan execution. `src/app.js` wires these defaults into `handleGmailRoute` while preserving test overrides.

**Tech Stack:** Node.js/CommonJS, existing preston.ai route style, existing credential crypto, native `fetch`, Supabase data modules, Gmail REST API, native Node tests using `assert`.

**Spec:** `docs/superpowers/specs/2026-09-13-preston-ai-v0.12-gmail-foundation-design.md`

## Global Constraints

- Product name is always `preston.ai`, never `Preston` in touched UI copy.
- Base branch is `build/preston-ai-v0.12.0` after the first Gmail Foundation implementation pass.
- This plan fixes production wiring only; it must not add `v0.13` broad Life Admin intelligence or `v0.14` scheduled Gmail automation.
- Gmail access remains read-only.
- Do not add Gmail modify/send/compose/archive/delete/mark-read behavior.
- OAuth callback must not start the 12-month Gmail scan automatically.
- Manual `Scan Gmail now` must either start a real scan or fail visibly; it must not pretend success when dependencies are missing.
- Tokens must be encrypted using the existing credential crypto pattern before persistence.
- Page requests must continue rendering from persisted preston.ai state and must not perform live Gmail scans.
- Full local verification is required before Railway deploy; connector-only implementation is not sufficient for production release approval.

---

## File Structure and Responsibilities

### Create

- `src/services/gmail-oauth.js` — Gmail readonly OAuth auth URL, token exchange, token refresh if needed, and Gmail profile/account-email lookup.
- `src/services/gmail-manual-scan.js` — production manual scan dependency builder and scan execution using the existing Gmail runner.
- `test/gmail-oauth.test.js` — unit tests for readonly-only scope, auth URL parameters, exchange/profile parsing, and no write scopes.
- `test/gmail-manual-scan.test.js` — unit tests for manual scan wiring, decrypted token use, persistence adapters, and fail-loud missing config behavior.
- `test/gmail-app-wiring.test.js` — verifies `createApp` supplies production Gmail dependencies unless overridden.

### Modify

- `src/app.js` — pass `gmailDeps` into `handleGmailRoute`, using production defaults merged with optional test overrides.
- `src/routes/gmail.js` — consume default production deps cleanly, preserve injected overrides, and distinguish missing config from successful scan start.
- `src/config.js` — ensure Gmail config has all values needed by production OAuth and scan wiring.
- `src/data/gmail-connections.js` — expose any missing token/account helper needed by manual scan service without returning secrets to pages.
- `src/data/gmail-scans.js` — expose recent scan list helper here or keep route-local helper; choose one source of truth.
- `src/data/gmail-sources.js` — expose persistence helpers needed by production scan runner.
- `test.js` — register the three new hardening tests.

---

### Task 1: Gmail OAuth production service

**Files:**
- Create: `src/services/gmail-oauth.js`
- Create: `test/gmail-oauth.test.js`
- Modify: `test.js`

**Interfaces:**
- Produces:
  - `GMAIL_READONLY_SCOPE`
  - `buildGmailAuthUrl(config, options = {})`
  - `exchangeGmailCode(config, code, options = {})`
  - `fetchGmailProfile(accessToken, options = {})`
  - `createGmailOAuth(config, options = {})`

- [ ] **Step 1: Write the failing OAuth service test**

Create `test/gmail-oauth.test.js`:

```js
const assert=require('node:assert/strict');
const {
  GMAIL_READONLY_SCOPE,
  buildGmailAuthUrl,
  fetchGmailProfile,
  exchangeGmailCode,
  createGmailOAuth
}=require('../src/services/gmail-oauth');

const config={gmail:{clientId:'client1',clientSecret:'secret1',redirectUri:'https://preston.run/me/settings/gmail/callback'}};

const authUrl=buildGmailAuthUrl(config,{state:'state1'});
const parsed=new URL(authUrl);
assert.equal(parsed.hostname,'accounts.google.com');
assert.equal(parsed.searchParams.get('client_id'),'client1');
assert.equal(parsed.searchParams.get('redirect_uri'),config.gmail.redirectUri);
assert.equal(parsed.searchParams.get('response_type'),'code');
assert.equal(parsed.searchParams.get('access_type'),'offline');
assert.equal(parsed.searchParams.get('prompt'),'consent');
assert.equal(parsed.searchParams.get('scope'),GMAIL_READONLY_SCOPE);
assert.equal(parsed.searchParams.get('scope').includes('gmail.modify'),false);
assert.equal(parsed.searchParams.get('scope').includes('gmail.send'),false);

(async()=>{
  const calls=[];
  const profile=await fetchGmailProfile('access1',{fetch:async(url,opts)=>{
    calls.push({url,opts});
    return {ok:true,json:async()=>({emailAddress:'me@example.com',messagesTotal:10,threadsTotal:3})};
  }});
  assert.equal(profile.emailAddress,'me@example.com');
  assert.match(calls[0].url,/gmail\/v1\/users\/me\/profile/);
  assert.equal(calls[0].opts.headers.Authorization,'Bearer access1');

  const exchanged=await exchangeGmailCode(config,'code1',{fetch:async(url,opts)=>{
    assert.match(url,/oauth2\/v4\/token/);
    assert.equal(opts.method,'POST');
    assert.match(String(opts.body),/code=code1/);
    return {ok:true,json:async()=>({access_token:'access1',refresh_token:'refresh1',scope:GMAIL_READONLY_SCOPE,expires_in:3600,token_type:'Bearer'})};
  },fetchProfile:async(accessToken)=>({emailAddress:`${accessToken}@example.com`,id:'sub1'})});
  assert.equal(exchanged.accessToken,'access1');
  assert.equal(exchanged.refreshToken,'refresh1');
  assert.equal(exchanged.scope,GMAIL_READONLY_SCOPE);
  assert.equal(exchanged.accountEmail,'access1@example.com');

  const oauth=createGmailOAuth(config,{fetch:async()=>({ok:true,json:async()=>({access_token:'a',refresh_token:'r',scope:GMAIL_READONLY_SCOPE})}),fetchProfile:async()=>({emailAddress:'me@example.com'})});
  assert.equal(typeof oauth.buildAuthUrl,'function');
  assert.equal(typeof oauth.exchangeCode,'function');
  assert.equal(oauth.buildAuthUrl({state:'x'}).includes('gmail.readonly'),true);
  console.log('gmail oauth tests passed');
})();
```

- [ ] **Step 2: Verify red**

Run:

```bash
node test/gmail-oauth.test.js
```

Expected: FAIL because `src/services/gmail-oauth.js` does not exist.

- [ ] **Step 3: Implement Gmail OAuth service**

Create `src/services/gmail-oauth.js`:

```js
const GMAIL_READONLY_SCOPE='https://www.googleapis.com/auth/gmail.readonly';
const GOOGLE_AUTH_URL='https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL='https://www.googleapis.com/oauth2/v4/token';
const GMAIL_PROFILE_URL='https://gmail.googleapis.com/gmail/v1/users/me/profile';

function requireGmailConfig(config){
  const gmail=config&&config.gmail||{};
  for(const key of ['clientId','clientSecret','redirectUri']){
    if(!gmail[key])throw new Error(`Gmail OAuth config missing ${key}`);
  }
  return gmail;
}

function buildGmailAuthUrl(config,options={}){
  const gmail=requireGmailConfig(config);
  const url=new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id',gmail.clientId);
  url.searchParams.set('redirect_uri',gmail.redirectUri);
  url.searchParams.set('response_type','code');
  url.searchParams.set('access_type','offline');
  url.searchParams.set('prompt','consent');
  url.searchParams.set('scope',GMAIL_READONLY_SCOPE);
  if(options.state)url.searchParams.set('state',options.state);
  return url.toString();
}

async function readJson(response,label){
  const body=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(body.error_description||body.error?.message||`${label} failed`);
    error.status=response.status;
    error.body=body;
    throw error;
  }
  return body;
}

async function fetchGmailProfile(accessToken,options={}){
  const fetchImpl=options.fetch||global.fetch;
  if(!fetchImpl)throw new Error('fetch is required');
  const body=await readJson(await fetchImpl(GMAIL_PROFILE_URL,{method:'GET',headers:{Authorization:`Bearer ${accessToken}`}}),'Gmail profile lookup');
  return {emailAddress:body.emailAddress||'',messagesTotal:body.messagesTotal||0,threadsTotal:body.threadsTotal||0,id:body.emailAddress||''};
}

async function exchangeGmailCode(config,code,options={}){
  if(!code)throw new Error('OAuth code is required');
  const gmail=requireGmailConfig(config);
  const fetchImpl=options.fetch||global.fetch;
  if(!fetchImpl)throw new Error('fetch is required');
  const body=new URLSearchParams({
    code,
    client_id:gmail.clientId,
    client_secret:gmail.clientSecret,
    redirect_uri:gmail.redirectUri,
    grant_type:'authorization_code'
  });
  const token=await readJson(await fetchImpl(GOOGLE_TOKEN_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:body.toString()}),'Gmail token exchange');
  const profile=await (options.fetchProfile||fetchGmailProfile)(token.access_token,{fetch:fetchImpl});
  return {
    accountEmail:String(profile.emailAddress||'').trim().toLowerCase(),
    googleSubject:profile.id||profile.emailAddress||null,
    accessToken:token.access_token,
    refreshToken:token.refresh_token||'',
    scope:token.scope||GMAIL_READONLY_SCOPE,
    expiresIn:token.expires_in||null,
    tokenType:token.token_type||'Bearer'
  };
}

function createGmailOAuth(config,options={}){
  return {
    buildAuthUrl(args={}){return buildGmailAuthUrl(config,args);},
    exchangeCode(code){return exchangeGmailCode(config,code,options);}
  };
}

module.exports={GMAIL_READONLY_SCOPE,buildGmailAuthUrl,fetchGmailProfile,exchangeGmailCode,createGmailOAuth};
```

- [ ] **Step 4: Register and verify**

Add `test/gmail-oauth.test.js` to `test.js` near `test/gmail-provider.test.js`.

Run:

```bash
node test/gmail-oauth.test.js
npm test
node --check src/services/gmail-oauth.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/gmail-oauth.js test/gmail-oauth.test.js test.js
git commit -m "feat: add production gmail oauth service"
```

---

### Task 2: Manual scan production service

**Files:**
- Create: `src/services/gmail-manual-scan.js`
- Create: `test/gmail-manual-scan.test.js`
- Modify: `test.js`

**Interfaces:**
- Consumes:
  - `getGmailConnection(supabase,userId)`
  - `decryptCredential(envelope,key)`
  - `createGmailProvider({fetch,accessToken})`
  - `runGmailScan({supabase,userId,connection,provider,config,existingTrips,persistence,actions,pdfParse})`
- Produces:
  - `createGmailPersistenceAdapters()`
  - `startManualGmailScan(supabase,userId,config,options = {})`
  - `createGmailManualScanDeps(config, options = {})`

- [ ] **Step 1: Write the failing manual scan service test**

Create `test/gmail-manual-scan.test.js`:

```js
const assert=require('node:assert/strict');
const {startManualGmailScan,createGmailPersistenceAdapters,createGmailManualScanDeps}=require('../src/services/gmail-manual-scan');

(async()=>{
  await assert.rejects(()=>startManualGmailScan({},'user1',{gmail:{}},{getGmailConnection:async()=>null}),/No connected Gmail account/);

  let providerToken=null;
  let runnerArgs=null;
  const result=await startManualGmailScan({db:true},'user1',{gmail:{scannerVersion:'scanner1',parserVersion:'parser1',initialLookbackMonths:12},calendarCredentialKey:'key1'}, {
    getGmailConnection:async()=>({id:'conn1',status:'connected',gmail_account_email:'me@example.com',access_token_ciphertext:'enc-access'}),
    decryptCredential:(envelope,key)=>{assert.equal(envelope,'enc-access');assert.equal(key,'key1');return {accessToken:'access1'};},
    createGmailProvider:args=>{providerToken=args.accessToken;return {provider:true};},
    listTrips:async()=>[{id:'trip1',bookingReferences:['ABC123']}],
    runGmailScan:async(args)=>{runnerArgs=args;return {status:'succeeded',processedCount:1};}
  });
  assert.equal(result.status,'succeeded');
  assert.equal(providerToken,'access1');
  assert.equal(runnerArgs.connection.id,'conn1');
  assert.equal(runnerArgs.existingTrips[0].id,'trip1');
  assert.equal(typeof runnerArgs.persistence.startScan,'function');
  assert.equal(typeof runnerArgs.actions.createGmailReviewItem,'function');

  const adapters=createGmailPersistenceAdapters();
  for(const key of ['startScan','upsertSource','insertFacts','finishScan','failScan'])assert.equal(typeof adapters[key],'function');
  const deps=createGmailManualScanDeps({gmail:{scannerVersion:'scanner1',parserVersion:'parser1',initialLookbackMonths:12},calendarCredentialKey:'key1'});
  assert.equal(typeof deps.startScanNow,'function');
  console.log('gmail manual scan tests passed');
})();
```

- [ ] **Step 2: Verify red**

Run:

```bash
node test/gmail-manual-scan.test.js
```

Expected: FAIL because `src/services/gmail-manual-scan.js` does not exist.

- [ ] **Step 3: Implement manual scan service**

Create `src/services/gmail-manual-scan.js`:

```js
const {decodeCredentialKey,decryptCredential}=require('../security/credential-crypto');
const {getGmailConnection}=require('../data/gmail-connections');
const {startGmailScanRun,updateGmailScanProgress,finishGmailScanRun,failGmailScanRun}=require('../data/gmail-scans');
const {upsertGmailSourceRecord,upsertGmailAttachmentRecord,insertExtractedFacts,findGmailSourceRecord,markGmailSourceStatus,markGmailAttachmentStatus,recordGmailActivity}=require('../data/gmail-sources');
const {listTrips}=require('../data/trips');
const {createGmailProvider}=require('./gmail-provider');
const {runGmailScan}=require('./gmail-scan-runner');
const {createGmailTripActions}=require('./gmail-trip-actions');

function normalizeDecryptedAccessToken(value){
  if(typeof value==='string')return value;
  if(value&&typeof value.accessToken==='string')return value.accessToken;
  if(value&&typeof value.access_token==='string')return value.access_token;
  throw new Error('Decrypted Gmail credential is missing access token');
}

function createGmailPersistenceAdapters(){
  return {
    startScan:startGmailScanRun,
    updateProgress:updateGmailScanProgress,
    upsertSource:async(normalized,scanRunId,ctx)=>upsertGmailSourceRecord(ctx.supabase,ctx.userId,ctx.connection.id,scanRunId,normalized),
    findSource:async(normalized,ctx)=>findGmailSourceRecord(ctx.supabase,ctx.userId,normalized.gmail_account_email,normalized.gmail_message_id),
    markSourceStatus:async(sourceId,status,reason,ctx)=>markGmailSourceStatus(ctx.supabase,ctx.userId,sourceId,status,reason),
    upsertAttachment:async(sourceRecordId,attachment,ctx)=>upsertGmailAttachmentRecord(ctx.supabase,ctx.userId,sourceRecordId,attachment),
    markAttachmentStatus:async(attachmentId,status,reason,ctx)=>markGmailAttachmentStatus(ctx.supabase,ctx.userId,attachmentId,status,reason),
    insertFacts:async(facts,ctx)=>insertExtractedFacts(ctx.supabase,ctx.userId,facts),
    finishScan:finishGmailScanRun,
    failScan:failGmailScanRun,
    recordActivity:async(entry,ctx)=>recordGmailActivity(ctx.supabase,ctx.userId,entry)
  };
}

async function startManualGmailScan(supabase,userId,config,options={}){
  const loadConnection=options.getGmailConnection||getGmailConnection;
  const connection=await loadConnection(supabase,userId);
  if(!connection||connection.status==='disconnected')throw new Error('No connected Gmail account');
  if(!connection.access_token_ciphertext)throw new Error('Connected Gmail account is missing encrypted access token');
  const decrypt=options.decryptCredential||((envelope,key)=>decryptCredential(envelope,decodeCredentialKey(key)));
  const accessToken=normalizeDecryptedAccessToken(decrypt(connection.access_token_ciphertext,config.calendarCredentialKey));
  const provider=(options.createGmailProvider||createGmailProvider)({fetch:options.fetch||global.fetch,accessToken});
  const trips=options.listTrips?await options.listTrips(supabase,{id:userId}):await listTrips(supabase,{id:userId});
  const persistence=options.persistence||createGmailPersistenceAdapters();
  const actions=options.actions||createGmailTripActions({supabase,userId,recordActivity:persistence.recordActivity});
  return (options.runGmailScan||runGmailScan)({supabase,userId,connection,provider,config,existingTrips:trips,persistence,actions,pdfParse:options.pdfParse});
}

function createGmailManualScanDeps(config,options={}){
  return {
    startScanNow(supabase,userId){return startManualGmailScan(supabase,userId,config,options);},
    retryFailedGmailItems(supabase,userId){return startManualGmailScan(supabase,userId,config,{...options,retryFailedOnly:true});}
  };
}

module.exports={normalizeDecryptedAccessToken,createGmailPersistenceAdapters,startManualGmailScan,createGmailManualScanDeps};
```

- [ ] **Step 4: Verify required persistence functions exist**

If `findGmailSourceRecord`, `markGmailSourceStatus`, `markGmailAttachmentStatus`, or `recordGmailActivity` are missing from `src/data/gmail-sources.js`, add them with focused tests in `test/gmail-sources-data.test.js` before completing this task.

Required signatures:

```js
async function findGmailSourceRecord(supabase,userId,gmailAccountEmail,gmailMessageId)
async function markGmailSourceStatus(supabase,userId,sourceRecordId,status,reason=null)
async function markGmailAttachmentStatus(supabase,userId,attachmentRecordId,status,reason=null)
async function recordGmailActivity(supabase,userId,entry)
```

- [ ] **Step 5: Register and verify**

Add `test/gmail-manual-scan.test.js` to `test.js` near `test/gmail-scan-runner.test.js`.

Run:

```bash
node test/gmail-manual-scan.test.js
npm test
node --check src/services/gmail-manual-scan.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/gmail-manual-scan.js src/data/gmail-sources.js test/gmail-manual-scan.test.js test/gmail-sources-data.test.js test.js
git commit -m "feat: wire manual gmail scan service"
```

---

### Task 3: App-level Gmail dependency wiring

**Files:**
- Modify: `src/app.js`
- Modify: `src/routes/gmail.js`
- Create: `test/gmail-app-wiring.test.js`
- Modify: `test/gmail-routes.test.js`
- Modify: `test.js`

**Interfaces:**
- Consumes:
  - `createGmailOAuth(config, options = {})`
  - `createGmailManualScanDeps(config, options = {})`
  - `upsertGmailConnection(supabase,userId,input)`
  - `getGmailConnection(supabase,userId)`
  - `markGmailDisconnected(supabase,userId,connectionId)`
- Produces:
  - `createGmailDeps(config, overrides = {})`
  - `createApp(config, dependencies = {})` passes `gmailDeps:createGmailDeps(config, dependencies.gmailDeps)` into route context.

- [ ] **Step 1: Write app wiring test**

Create `test/gmail-app-wiring.test.js`:

```js
const assert=require('node:assert/strict');
const {createGmailDeps}=require('../src/app');
const {GMAIL_READONLY_SCOPE}=require('../src/services/gmail-oauth');

const config={gmail:{clientId:'client1',clientSecret:'secret1',redirectUri:'https://preston.run/me/settings/gmail/callback',scannerVersion:'scanner1',parserVersion:'parser1',initialLookbackMonths:12},calendarCredentialKey:'credential-key'};
const deps=createGmailDeps(config,{encrypt:value=>`enc:${value}`});
assert.equal(typeof deps.googleOAuth.buildAuthUrl,'function');
assert.equal(typeof deps.googleOAuth.exchangeCode,'function');
assert.equal(typeof deps.startScanNow,'function');
assert.equal(typeof deps.retryFailedGmailItems,'function');
assert.equal(typeof deps.upsertGmailConnection,'function');
assert.equal(deps.googleOAuth.buildAuthUrl({}).includes(encodeURIComponent(GMAIL_READONLY_SCOPE))||deps.googleOAuth.buildAuthUrl({}).includes('gmail.readonly'),true);

const override=()=>{};
const merged=createGmailDeps(config,{startScanNow:override});
assert.equal(merged.startScanNow,override);
assert.equal(typeof merged.googleOAuth.buildAuthUrl,'function');
console.log('gmail app wiring tests passed');
```

- [ ] **Step 2: Verify red**

Run:

```bash
node test/gmail-app-wiring.test.js
```

Expected: FAIL because `createGmailDeps` is not exported yet.

- [ ] **Step 3: Implement `createGmailDeps` in `src/app.js`**

Modify `src/app.js`:

```js
const { createGmailOAuth } = require('./services/gmail-oauth');
const { createGmailManualScanDeps } = require('./services/gmail-manual-scan');
const { upsertGmailConnection, getGmailConnection, markGmailDisconnected } = require('./data/gmail-connections');
const { decodeCredentialKey, encryptCredential } = require('./security/credential-crypto');

function createGmailDeps(config, overrides = {}) {
  const encrypt = overrides.encrypt || ((value) => encryptCredential({accessToken:value}, decodeCredentialKey(config.calendarCredentialKey)));
  const defaults = {
    googleOAuth:createGmailOAuth(config, overrides.oauthOptions || {}),
    encrypt,
    upsertGmailConnection,
    getGmailConnection,
    markGmailDisconnected,
    ...createGmailManualScanDeps(config, overrides.manualScanOptions || {})
  };
  return {...defaults, ...overrides};
}
```

Then update app context creation:

```js
const context = {
  config,
  supabase,
  calendarDeps: dependencies.calendarDeps,
  gmailDeps: createGmailDeps(config, dependencies.gmailDeps || {})
};
```

Export it:

```js
module.exports = { createApp, createGmailDeps };
```

- [ ] **Step 4: Make route failures honest**

Modify `src/routes/gmail.js` so:

- missing OAuth config returns `501 Gmail OAuth is not configured`;
- missing scan deps returns `501 Gmail scan is not configured`;
- successful `POST /scan-now` only redirects with `?scan=1` after `startScanNow` resolves;
- `POST /retry-failed` only redirects after `retryFailedGmailItems` resolves.

Do not add background scheduling.

- [ ] **Step 5: Register and verify**

Add `test/gmail-app-wiring.test.js` to `test.js` near route tests.

Run:

```bash
node test/gmail-app-wiring.test.js
node test/gmail-routes.test.js
npm test
node --check src/app.js
node --check src/routes/gmail.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app.js src/routes/gmail.js test/gmail-app-wiring.test.js test/gmail-routes.test.js test.js
git commit -m "feat: wire gmail dependencies into app"
```

---

### Task 4: Final production-readiness verification

**Files:**
- Modify: files required by verification failures only.

**Interfaces:**
- Produces verified `v0.12` Gmail Foundation candidate.

- [ ] **Step 1: Run full local tests**

Run in a real checkout of `build/preston-ai-v0.12.0`:

```bash
npm test
find src test -name '*.js' -print0 | xargs -0 -n1 node --check
```

Expected: PASS.

- [ ] **Step 2: Run forbidden Gmail write scan**

```bash
grep -R "gmail.modify\|gmail.send\|gmail.compose\|messages.modify\|messages.trash\|messages.send" -n src test package.json || true
```

Expected: no Gmail write scopes or Gmail write API calls.

- [ ] **Step 3: Run no-scheduled-Gmail scan**

```bash
grep -R "job:gmail\|gmail.*cron\|scheduled.*gmail\|stale.*gmail" -n package.json src test .github || true
```

Expected: no scheduled Gmail automation in `v0.12`.

- [ ] **Step 4: Run no-persisted-body/binary scan**

```bash
grep -R "email_body\|raw_body\|attachment_bytes\|pdf_binary\|message_body" -n supabase src test || true
```

Expected: no persisted full email body or PDF binary fields.

- [ ] **Step 5: Manual production-wiring UAT**

Perform against a staging/Railway preview:

```text
1. Open /me/settings/gmail as the owner account.
2. Confirm page renders without injected test deps.
3. Click Connect Gmail.
4. Confirm the Google consent screen requests readonly Gmail access only.
5. Complete callback.
6. Confirm Gmail connection is saved and the first scan does not auto-start.
7. Click Scan Gmail now.
8. Confirm the manual scan creates a gmail_scan_runs row.
9. Confirm scan either succeeds or displays a real error; it must not silently no-op.
10. Confirm repeated Scan Gmail now is idempotent.
11. Confirm Disconnect Gmail marks connection disconnected and preserves derived data.
```

- [ ] **Step 6: Commit final fixes only if needed**

```bash
git add src test package.json supabase
 git commit -m "chore: harden gmail production wiring"
```

If verification passes without file changes, do not create an empty commit.

---

## Self-Review

- Spec coverage: This supplemental plan directly covers the identified production-wiring gap: real OAuth deps, real manual scan deps, app-level default dependency construction, honest scan failure behavior, and final verification.
- Scope check: It does not broaden extraction intelligence, add scheduled scans, add notification automation, or change Gmail permissions.
- Placeholder scan: No `TBD`, `TODO`, or vague implementation placeholders remain. The final verification task intentionally says to modify only files required by actual failures.
- Type consistency: Function names are introduced once and reused consistently: `createGmailOAuth`, `createGmailManualScanDeps`, `startManualGmailScan`, and `createGmailDeps`.
- Risk note: The encryption example stores `{accessToken:value}` for both access and refresh token call sites if reused blindly. During implementation, either make the route pass token-specific payloads or adjust `createGmailDeps.encrypt` to accept explicit token envelope names. Add a test before changing this behavior.
