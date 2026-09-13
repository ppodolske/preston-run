# preston.ai v0.12 Gmail Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `v0.12 Gmail Foundation` release so preston.ai can connect one read-only Gmail account, explicitly scan the last 12 months of eligible received mail, extract trip-first evidence, create safe trip records, and route uncertainty through Action Needed without storing full email bodies or PDF binaries as source of truth.

**Architecture:** Gmail becomes an ingestion source feeding normalized source records, immutable extracted facts, decision/matching rules, Life Admin/trip updates, Action Needed, scan history, and audit activity. This release keeps scans manual and observable; background scheduling, stale-on-open scans, broader Life Admin intelligence, and urgent alerts remain deferred to `v0.13`/`v0.14`. Page requests render from persisted preston.ai state and never depend on live Gmail reads.

**Tech Stack:** Node.js/CommonJS, Express-style routes, Supabase/Postgres with RLS migrations, Google OAuth/Gmail REST via server-side provider module, native Node tests using `assert`, Railway deployment conventions already used by preston.ai.

**Spec:** `docs/superpowers/specs/2026-09-13-preston-ai-v0.12-gmail-foundation-design.md`

## Global Constraints

- Product name is always `preston.ai`, never `Preston` in touched UI copy.
- Base production context is deployed `v0.11.0`; implementation branch is `build/preston-ai-v0.12.0`.
- Release version becomes exactly `0.12.0` only when release/version tasks explicitly say so.
- Gmail starts with one connected Gmail account only.
- Gmail access is read-only.
- preston.ai may read received Gmail messages and native-text PDF attachments.
- preston.ai must not label, archive, delete, mark read, draft, or send Gmail messages.
- Gmail scanning includes all received mail, including archived messages.
- Gmail scanning excludes Spam, Trash, Drafts, and Sent Mail.
- First scan looks back 12 months and runs newest-to-oldest.
- After first scan, scans process eligible messages received since the last successful checkpoint.
- Checkpoints advance only after successful processing boundaries.
- Retries and idempotency must avoid duplicate records.
- Review items do not block checkpoint progress.
- `v0.12` is trips-first for structured extraction.
- `v0.12` builds upcoming and completed trips from the first 12-month scan.
- Completed trips are quiet history and must not create noisy overdue tasks or retrospective reminders.
- `v0.12` captures generic Gmail source records for likely future Life Admin categories, but does not broadly classify them yet.
- Native-text PDFs only; OCR/image-only PDFs are deferred.
- Manual preston.ai edits are authoritative.
- Gmail must never silently overwrite a user-edited field.
- Use links and IDs as primary evidence; do not persist full email bodies or attachment binaries as source of truth.
- No Google Calendar or Apple Calendar writes in `v0.12`.
- No background scheduled Gmail scans in `v0.12`; automation is deferred to `v0.14`.
- Existing `v0.11.0` dashboard, reminders, calendar sync, fitness sync, push, routes, and PWA behavior must remain intact.

---

## File Structure and Responsibilities

### Create

- `supabase/migrations/20260913120000_v0120_gmail_foundation.sql` — Gmail connection, scan runs, source records, attachment records, extracted facts, decisions/activity, review links, RLS.
- `src/data/gmail-connections.js` — CRUD for one Gmail connection per user and connection status.
- `src/data/gmail-scans.js` — scan run lifecycle, checkpoint persistence, progress counters, degraded/error state.
- `src/data/gmail-sources.js` — idempotent source/attachment/fact persistence and lookup helpers.
- `src/domain/gmail-eligibility.js` — pure Gmail label/metadata eligibility decisions.
- `src/domain/gmail-normalize.js` — normalize Gmail API message metadata into internal source shape.
- `src/domain/gmail-facts.js` — immutable fact builder/version helpers.
- `src/domain/gmail-trip-extractor.js` — deterministic trip-first extraction from message/PDF text envelopes.
- `src/domain/gmail-trip-matcher.js` — ranked trip/source matching rules.
- `src/domain/gmail-decisions.js` — decide create/update/review/ignore outcomes from facts and match results.
- `src/services/gmail-provider.js` — server-side read-only Gmail API wrapper.
- `src/services/gmail-pdf.js` — native-text PDF extraction wrapper with safe status results.
- `src/services/gmail-scan-runner.js` — orchestration for first and incremental scans.
- `src/routes/gmail.js` — authenticated Gmail settings, connect/callback/disconnect, scan-now endpoints.
- `src/pages/gmail-settings.js` — Gmail integration page UI.
- `test/gmail-foundation-migration.test.js`
- `test/gmail-eligibility.test.js`
- `test/gmail-normalize.test.js`
- `test/gmail-connections-data.test.js`
- `test/gmail-sources-data.test.js`
- `test/gmail-scans-data.test.js`
- `test/gmail-provider.test.js`
- `test/gmail-pdf.test.js`
- `test/gmail-trip-extractor.test.js`
- `test/gmail-trip-matcher.test.js`
- `test/gmail-decisions.test.js`
- `test/gmail-scan-runner.test.js`
- `test/gmail-pages.test.js`
- `test/gmail-routes.test.js`

### Modify

- `package.json` — bump version to `0.12.0`; add Gmail job/script only if needed for manual scan worker execution; do not add scheduled Gmail script yet.
- `test.js` — register new Gmail tests while preserving existing v0.11.0 suite.
- `src/config.js` — add server-only Gmail OAuth config and parser/scanner version constants.
- `src/app.js` — mount Gmail routes.
- `src/routes/site.js` or settings route module if present — link Gmail integration page from authenticated admin/settings area.
- `src/pages/home.js` — surface Action Needed/recent Gmail-derived changes only through existing Life Admin/dashboard data, not live Gmail.
- `src/pages/notifications.js` or relevant settings page — avoid implying Gmail scheduled notifications exist in v0.12.
- Existing trip/Life Admin data modules as narrowly required for provenance/activity/review linking.

---

### Task 1: Version, config, and migration contract

**Files:**
- Modify: `package.json`
- Modify: `src/config.js`
- Create: `supabase/migrations/20260913120000_v0120_gmail_foundation.sql`
- Create: `test/gmail-foundation-migration.test.js`
- Modify: `test.js`

**Interfaces:**
- Produces config constants:
  - `config.gmail.clientId`
  - `config.gmail.clientSecret`
  - `config.gmail.redirectUri`
  - `config.gmail.scannerVersion`
  - `config.gmail.parserVersion`
  - `config.gmail.initialLookbackMonths`
- Produces DB tables used by later tasks:
  - `gmail_connections`
  - `gmail_scan_runs`
  - `gmail_source_records`
  - `gmail_attachment_records`
  - `gmail_extracted_facts`
  - `gmail_activity_entries`
  - `gmail_review_links`

- [ ] **Step 1: Write the failing migration test**

Create `test/gmail-foundation-migration.test.js`:

```js
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const migration=path.join(__dirname,'..','supabase','migrations','20260913120000_v0120_gmail_foundation.sql');
assert.equal(fs.existsSync(migration),true,'gmail foundation migration must exist');
const sql=fs.readFileSync(migration,'utf8');

for(const table of [
  'gmail_connections',
  'gmail_scan_runs',
  'gmail_source_records',
  'gmail_attachment_records',
  'gmail_extracted_facts',
  'gmail_activity_entries',
  'gmail_review_links'
]){
  assert.match(sql,new RegExp(`create table if not exists public\\.${table}`,'i'),`${table} table missing`);
  assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`,'i'),`${table} RLS missing`);
}

assert.match(sql,/unique\s*\(user_id,\s*gmail_account_email\)/i,'one account uniqueness should be explicit');
assert.match(sql,/unique\s*\(user_id,\s*gmail_account_email,\s*gmail_message_id\)/i,'message idempotency constraint missing');
assert.match(sql,/unique\s*\(source_record_id,\s*gmail_attachment_id\)/i,'attachment idempotency constraint missing');
assert.match(sql,/fact_schema_version integer not null/i,'fact schema version missing');
assert.match(sql,/parser_version text not null/i,'parser version missing');
assert.match(sql,/scanner_version text not null/i,'scanner version missing');
assert.match(sql,/manual_authority/i,'manual authority marker missing');
console.log('gmail foundation migration contract passed');
```

- [ ] **Step 2: Verify the test fails**

Run:

```bash
node test/gmail-foundation-migration.test.js
```

Expected: FAIL because the migration does not exist yet.

- [ ] **Step 3: Create the migration**

Create `supabase/migrations/20260913120000_v0120_gmail_foundation.sql` with these tables and constraints:

```sql
create table if not exists public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_account_email text not null,
  google_subject text,
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  scope text not null default '',
  status text not null default 'connected' check (status in ('connected','degraded','disconnected')),
  last_successful_scan_at timestamptz,
  last_attempted_scan_at timestamptz,
  last_error text,
  first_scan_completed_at timestamptz,
  checkpoint_received_at timestamptz,
  checkpoint_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, gmail_account_email)
);

create table if not exists public.gmail_scan_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.gmail_connections(id) on delete cascade,
  scan_type text not null check (scan_type in ('initial','manual_incremental','retry')),
  status text not null check (status in ('running','succeeded','failed','partial')),
  scanner_version text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  lookback_start_at timestamptz,
  checkpoint_before_at timestamptz,
  checkpoint_after_at timestamptz,
  discovered_count integer not null default 0,
  processed_count integer not null default 0,
  ignored_count integer not null default 0,
  relevant_count integer not null default 0,
  facts_created_count integer not null default 0,
  records_created_count integer not null default 0,
  records_updated_count integer not null default 0,
  review_items_created_count integer not null default 0,
  pdf_unreadable_count integer not null default 0,
  error_summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.gmail_source_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.gmail_connections(id) on delete cascade,
  scan_run_id uuid references public.gmail_scan_runs(id) on delete set null,
  source_system text not null default 'gmail',
  gmail_account_email text not null,
  gmail_message_id text not null,
  gmail_thread_id text,
  sender text,
  subject text,
  received_at timestamptz not null,
  label_ids jsonb not null default '[]'::jsonb,
  source_link text,
  classification_hint text,
  processing_status text not null default 'pending' check (processing_status in ('pending','processed','ignored','skipped','retry')),
  processing_reason text,
  scanner_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, gmail_account_email, gmail_message_id)
);

create table if not exists public.gmail_attachment_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_record_id uuid not null references public.gmail_source_records(id) on delete cascade,
  gmail_attachment_id text not null,
  filename text,
  mime_type text,
  source_link text,
  processing_status text not null default 'pending' check (processing_status in ('pending','processed','ignored','skipped','retry')),
  processing_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_record_id, gmail_attachment_id)
);

create table if not exists public.gmail_extracted_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_record_id uuid not null references public.gmail_source_records(id) on delete cascade,
  attachment_record_id uuid references public.gmail_attachment_records(id) on delete set null,
  fact_type text not null,
  fact_value jsonb not null,
  fact_schema_version integer not null default 1,
  parser_version text not null,
  classification_confidence numeric,
  extraction_confidence numeric,
  entity_match_confidence numeric,
  urgency_confidence numeric,
  is_current_candidate boolean not null default true,
  supersedes_fact_id uuid references public.gmail_extracted_facts(id) on delete set null,
  rejected_for_entity_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.gmail_activity_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_record_id uuid references public.gmail_source_records(id) on delete set null,
  fact_id uuid references public.gmail_extracted_facts(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  field_name text,
  old_value jsonb,
  new_value jsonb,
  action text not null check (action in ('create','update','undo','reject','skip')),
  automatic boolean not null default true,
  manual_authority boolean not null default false,
  rule_version text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.gmail_review_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_record_id uuid references public.gmail_source_records(id) on delete cascade,
  fact_id uuid references public.gmail_extracted_facts(id) on delete set null,
  review_item_id uuid not null,
  review_type text not null check (review_type in ('confirm_new_item','resolve_conflict','confirm_match','review_unreadable_source')),
  recommended_action text,
  current_value jsonb,
  gmail_value jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, source_record_id, fact_id, review_type)
);

alter table public.gmail_connections enable row level security;
alter table public.gmail_scan_runs enable row level security;
alter table public.gmail_source_records enable row level security;
alter table public.gmail_attachment_records enable row level security;
alter table public.gmail_extracted_facts enable row level security;
alter table public.gmail_activity_entries enable row level security;
alter table public.gmail_review_links enable row level security;
```

Add owner-scoped `select/insert/update/delete` policies matching existing project policy style. Use `auth.uid() = user_id` for all tables.

- [ ] **Step 4: Add Gmail config constants**

Modify `src/config.js` so it exports server-only Gmail configuration. Preserve all existing exports.

```js
const gmail={
  clientId:process.env.GMAIL_CLIENT_ID||'',
  clientSecret:process.env.GMAIL_CLIENT_SECRET||'',
  redirectUri:process.env.GMAIL_REDIRECT_URI||'',
  scannerVersion:'gmail-scanner-v0.12.0',
  parserVersion:'gmail-parser-v0.12.0',
  initialLookbackMonths:12
};
```

- [ ] **Step 5: Bump release version**

Modify `package.json`:

```json
"version": "0.12.0"
```

Do not add scheduled Gmail scripts yet.

- [ ] **Step 6: Register the migration test**

Modify `test.js` and insert `test/gmail-foundation-migration.test.js` near the other migration tests.

- [ ] **Step 7: Verify**

Run:

```bash
node test/gmail-foundation-migration.test.js
npm test
node --check src/config.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json src/config.js supabase/migrations/20260913120000_v0120_gmail_foundation.sql test/gmail-foundation-migration.test.js test.js
git commit -m "feat: add gmail foundation schema"
```

---

### Task 2: Gmail connection data layer

**Files:**
- Create: `src/data/gmail-connections.js`
- Create: `test/gmail-connections-data.test.js`
- Modify: `test.js`

**Interfaces:**
- Produces:
  - `getGmailConnection(supabase,userId)`
  - `upsertGmailConnection(supabase,userId,input)`
  - `markGmailDisconnected(supabase,userId,connectionId)`
  - `updateGmailConnectionStatus(supabase,userId,connectionId,statusPatch)`

- [ ] **Step 1: Write the failing data-layer test**

Create `test/gmail-connections-data.test.js` with a fake Supabase client:

```js
const assert=require('node:assert/strict');
const {
  getGmailConnection,
  upsertGmailConnection,
  markGmailDisconnected,
  updateGmailConnectionStatus
}=require('../src/data/gmail-connections');

function fakeSupabase(){
  const calls=[];
  const chain={
    select(cols){calls.push(['select',cols]);return chain;},
    eq(col,val){calls.push(['eq',col,val]);return chain;},
    maybeSingle(){calls.push(['maybeSingle']);return Promise.resolve({data:{id:'conn1',status:'connected'},error:null});},
    upsert(row,opts){calls.push(['upsert',row,opts]);return chain;},
    update(row){calls.push(['update',row]);return chain;},
    single(){calls.push(['single']);return Promise.resolve({data:{id:'conn1'},error:null});}
  };
  return {calls,from(table){calls.push(['from',table]);return chain;}};
}

(async()=>{
  const supabase=fakeSupabase();
  const row=await getGmailConnection(supabase,'user1');
  assert.equal(row.id,'conn1');
  assert.deepEqual(supabase.calls.slice(0,4),[
    ['from','gmail_connections'],
    ['select','*'],
    ['eq','user_id','user1'],
    ['maybeSingle']
  ]);

  const supabase2=fakeSupabase();
  await upsertGmailConnection(supabase2,'user1',{
    gmailAccountEmail:'me@example.com',
    googleSubject:'sub1',
    accessTokenCiphertext:'enc-access',
    refreshTokenCiphertext:'enc-refresh',
    scope:'gmail.readonly'
  });
  assert.equal(supabase2.calls[1][0],'upsert');
  assert.equal(supabase2.calls[1][1].user_id,'user1');
  assert.equal(supabase2.calls[1][1].gmail_account_email,'me@example.com');
  assert.equal(supabase2.calls[1][1].status,'connected');

  const supabase3=fakeSupabase();
  await markGmailDisconnected(supabase3,'user1','conn1');
  assert.equal(supabase3.calls[1][1].status,'disconnected');

  const supabase4=fakeSupabase();
  await updateGmailConnectionStatus(supabase4,'user1','conn1',{lastError:'boom'});
  assert.equal(supabase4.calls[1][1].last_error,'boom');
  console.log('gmail connection data tests passed');
})();
```

- [ ] **Step 2: Verify red**

Run:

```bash
node test/gmail-connections-data.test.js
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the data layer**

Create `src/data/gmail-connections.js`:

```js
function throwIfError(error){if(error)throw error;}
function nowIso(){return new Date().toISOString();}

async function getGmailConnection(supabase,userId){
  const {data,error}=await supabase.from('gmail_connections').select('*').eq('user_id',userId).maybeSingle();
  throwIfError(error);
  return data||null;
}

async function upsertGmailConnection(supabase,userId,input){
  const row={
    user_id:userId,
    gmail_account_email:input.gmailAccountEmail,
    google_subject:input.googleSubject||null,
    access_token_ciphertext:input.accessTokenCiphertext||null,
    refresh_token_ciphertext:input.refreshTokenCiphertext||null,
    scope:input.scope||'',
    status:'connected',
    last_error:null,
    updated_at:nowIso()
  };
  const {data,error}=await supabase.from('gmail_connections').upsert(row,{onConflict:'user_id,gmail_account_email'}).select('*').single();
  throwIfError(error);
  return data;
}

async function markGmailDisconnected(supabase,userId,connectionId){
  const patch={status:'disconnected',updated_at:nowIso()};
  const {data,error}=await supabase.from('gmail_connections').update(patch).eq('user_id',userId).eq('id',connectionId).select('*').single();
  throwIfError(error);
  return data;
}

async function updateGmailConnectionStatus(supabase,userId,connectionId,statusPatch){
  const patch={updated_at:nowIso()};
  if(statusPatch.status)patch.status=statusPatch.status;
  if(Object.hasOwn(statusPatch,'lastError'))patch.last_error=statusPatch.lastError;
  if(statusPatch.lastSuccessfulScanAt)patch.last_successful_scan_at=statusPatch.lastSuccessfulScanAt;
  if(statusPatch.lastAttemptedScanAt)patch.last_attempted_scan_at=statusPatch.lastAttemptedScanAt;
  if(statusPatch.firstScanCompletedAt)patch.first_scan_completed_at=statusPatch.firstScanCompletedAt;
  if(statusPatch.checkpointReceivedAt)patch.checkpoint_received_at=statusPatch.checkpointReceivedAt;
  if(statusPatch.checkpointMessageId)patch.checkpoint_message_id=statusPatch.checkpointMessageId;
  const {data,error}=await supabase.from('gmail_connections').update(patch).eq('user_id',userId).eq('id',connectionId).select('*').single();
  throwIfError(error);
  return data;
}

module.exports={getGmailConnection,upsertGmailConnection,markGmailDisconnected,updateGmailConnectionStatus};
```

- [ ] **Step 4: Register and verify**

Add `test/gmail-connections-data.test.js` to `test.js` near other data tests.

Run:

```bash
node test/gmail-connections-data.test.js
npm test
node --check src/data/gmail-connections.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/gmail-connections.js test/gmail-connections-data.test.js test.js
git commit -m "feat: add gmail connection data layer"
```

---

### Task 3: Gmail eligibility and normalization domain

**Files:**
- Create: `src/domain/gmail-eligibility.js`
- Create: `src/domain/gmail-normalize.js`
- Create: `test/gmail-eligibility.test.js`
- Create: `test/gmail-normalize.test.js`
- Modify: `test.js`

**Interfaces:**
- Produces:
  - `isEligibleReceivedMessage(message)`
  - `classifyGmailSourceHint(normalized)`
  - `normalizeGmailMessage(message,accountEmail,scannerVersion)`

- [ ] **Step 1: Write eligibility tests**

Create `test/gmail-eligibility.test.js`:

```js
const assert=require('node:assert/strict');
const {isEligibleReceivedMessage}=require('../src/domain/gmail-eligibility');

assert.equal(isEligibleReceivedMessage({labelIds:['INBOX']}),true);
assert.equal(isEligibleReceivedMessage({labelIds:['CATEGORY_PERSONAL']}),true,'archived received mail without INBOX can still be eligible');
assert.equal(isEligibleReceivedMessage({labelIds:['SENT']}),false);
assert.equal(isEligibleReceivedMessage({labelIds:['DRAFT']}),false);
assert.equal(isEligibleReceivedMessage({labelIds:['SPAM']}),false);
assert.equal(isEligibleReceivedMessage({labelIds:['TRASH']}),false);
assert.equal(isEligibleReceivedMessage({labelIds:['INBOX','TRASH']}),false);
console.log('gmail eligibility tests passed');
```

Create `test/gmail-normalize.test.js`:

```js
const assert=require('node:assert/strict');
const {normalizeGmailMessage,classifyGmailSourceHint}=require('../src/domain/gmail-normalize');

const message={
  id:'msg1',
  threadId:'thr1',
  labelIds:['CATEGORY_PERSONAL'],
  internalDate:String(Date.parse('2026-09-13T04:00:00Z')),
  payload:{headers:[
    {name:'From',value:'Airline <bookings@example.com>'},
    {name:'Subject',value:'Your flight booking confirmation'},
    {name:'Date',value:'Sun, 13 Sep 2026 14:00:00 +1000'}
  ]}
};
const out=normalizeGmailMessage(message,'me@example.com','scanner1');
assert.equal(out.gmail_message_id,'msg1');
assert.equal(out.gmail_thread_id,'thr1');
assert.equal(out.gmail_account_email,'me@example.com');
assert.equal(out.sender,'Airline <bookings@example.com>');
assert.equal(out.subject,'Your flight booking confirmation');
assert.equal(out.received_at,'2026-09-13T04:00:00.000Z');
assert.equal(out.scanner_version,'scanner1');
assert.equal(classifyGmailSourceHint(out),'trip_candidate');
console.log('gmail normalization tests passed');
```

- [ ] **Step 2: Verify red**

Run:

```bash
node test/gmail-eligibility.test.js
node test/gmail-normalize.test.js
```

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement eligibility**

Create `src/domain/gmail-eligibility.js`:

```js
const EXCLUDED_LABELS=new Set(['SENT','DRAFT','SPAM','TRASH']);
function isEligibleReceivedMessage(message){
  const labels=message&&Array.isArray(message.labelIds)?message.labelIds:[];
  return !labels.some(label=>EXCLUDED_LABELS.has(label));
}
module.exports={isEligibleReceivedMessage,EXCLUDED_LABELS};
```

- [ ] **Step 4: Implement normalization**

Create `src/domain/gmail-normalize.js`:

```js
function headerValue(message,name){
  const headers=message?.payload?.headers||[];
  const found=headers.find(h=>String(h.name||'').toLowerCase()===name.toLowerCase());
  return found?found.value||'':null;
}

function receivedAt(message){
  if(message.internalDate)return new Date(Number(message.internalDate)).toISOString();
  const date=headerValue(message,'Date');
  return date?new Date(date).toISOString():new Date(0).toISOString();
}

function sourceLink(accountEmail,messageId){
  return `https://mail.google.com/mail/u/${encodeURIComponent(accountEmail)}/#all/${encodeURIComponent(messageId)}`;
}

function classifyGmailSourceHint(normalized){
  const text=`${normalized.sender||''} ${normalized.subject||''}`.toLowerCase();
  if(/flight|hotel|booking|itinerary|reservation|airline|train|ferry|cruise|tour|ticket|check-in|car hire|rental car/.test(text))return 'trip_candidate';
  if(/invoice|bill|payment|receipt|renewal|subscription|appointment|deadline|statement|policy|warranty/.test(text))return 'future_life_admin_candidate';
  return 'none';
}

function normalizeGmailMessage(message,accountEmail,scannerVersion){
  const row={
    source_system:'gmail',
    gmail_account_email:accountEmail,
    gmail_message_id:message.id,
    gmail_thread_id:message.threadId||null,
    sender:headerValue(message,'From'),
    subject:headerValue(message,'Subject'),
    received_at:receivedAt(message),
    label_ids:message.labelIds||[],
    source_link:sourceLink(accountEmail,message.id),
    scanner_version:scannerVersion,
    processing_status:'pending'
  };
  row.classification_hint=classifyGmailSourceHint(row);
  return row;
}

module.exports={normalizeGmailMessage,classifyGmailSourceHint,headerValue,sourceLink};
```

- [ ] **Step 5: Register and verify**

Add both tests to `test.js` near other domain tests.

Run:

```bash
node test/gmail-eligibility.test.js
node test/gmail-normalize.test.js
npm test
node --check src/domain/gmail-eligibility.js
node --check src/domain/gmail-normalize.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/gmail-eligibility.js src/domain/gmail-normalize.js test/gmail-eligibility.test.js test/gmail-normalize.test.js test.js
git commit -m "feat: normalize eligible gmail messages"
```

---

### Task 4: Gmail source and fact persistence

**Files:**
- Create: `src/data/gmail-sources.js`
- Create: `src/domain/gmail-facts.js`
- Create: `test/gmail-sources-data.test.js`
- Modify: `test.js`

**Interfaces:**
- Produces:
  - `upsertGmailSourceRecord(supabase,userId,connectionId,scanRunId,normalized)`
  - `upsertGmailAttachmentRecord(supabase,userId,sourceRecordId,attachment)`
  - `insertExtractedFacts(supabase,userId,facts)`
  - `buildFact(input)`

- [ ] **Step 1: Write tests**

Create `test/gmail-sources-data.test.js`:

```js
const assert=require('node:assert/strict');
const {buildFact}=require('../src/domain/gmail-facts');
const {upsertGmailSourceRecord,upsertGmailAttachmentRecord,insertExtractedFacts}=require('../src/data/gmail-sources');

function fakeSupabase(){
  const calls=[];
  const chain={
    upsert(row,opts){calls.push(['upsert',row,opts]);return chain;},
    insert(rows){calls.push(['insert',rows]);return chain;},
    select(cols){calls.push(['select',cols]);return chain;},
    single(){calls.push(['single']);return Promise.resolve({data:{id:'row1'},error:null});}
  };
  return {calls,from(table){calls.push(['from',table]);return chain;}};
}

(async()=>{
  const fact=buildFact({
    sourceRecordId:'src1',
    factType:'trip.flight',
    factValue:{provider:'Qantas',flightNumber:'QF401'},
    parserVersion:'parser1',
    classificationConfidence:0.95,
    extractionConfidence:0.9
  });
  assert.equal(fact.fact_type,'trip.flight');
  assert.equal(fact.fact_schema_version,1);
  assert.equal(fact.parser_version,'parser1');
  assert.equal(fact.classification_confidence,0.95);

  const supabase=fakeSupabase();
  await upsertGmailSourceRecord(supabase,'user1','conn1','scan1',{
    gmail_account_email:'me@example.com',gmail_message_id:'msg1',gmail_thread_id:'thr1',received_at:'2026-09-13T00:00:00Z',label_ids:[],scanner_version:'scanner1'
  });
  assert.equal(supabase.calls[0][1],'gmail_source_records');
  assert.equal(supabase.calls[1][2].onConflict,'user_id,gmail_account_email,gmail_message_id');

  const supabase2=fakeSupabase();
  await upsertGmailAttachmentRecord(supabase2,'user1','src1',{gmailAttachmentId:'att1',filename:'itinerary.pdf',mimeType:'application/pdf'});
  assert.equal(supabase2.calls[1][2].onConflict,'source_record_id,gmail_attachment_id');

  const supabase3=fakeSupabase();
  await insertExtractedFacts(supabase3,'user1',[fact]);
  assert.equal(supabase3.calls[0][1],'gmail_extracted_facts');
  assert.equal(supabase3.calls[1][1][0].user_id,'user1');
  console.log('gmail source/fact data tests passed');
})();
```

- [ ] **Step 2: Verify red**

Run:

```bash
node test/gmail-sources-data.test.js
```

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement fact builder**

Create `src/domain/gmail-facts.js`:

```js
function buildFact(input){
  return {
    source_record_id:input.sourceRecordId,
    attachment_record_id:input.attachmentRecordId||null,
    fact_type:input.factType,
    fact_value:input.factValue,
    fact_schema_version:input.factSchemaVersion||1,
    parser_version:input.parserVersion,
    classification_confidence:input.classificationConfidence??null,
    extraction_confidence:input.extractionConfidence??null,
    entity_match_confidence:input.entityMatchConfidence??null,
    urgency_confidence:input.urgencyConfidence??null,
    is_current_candidate:true,
    supersedes_fact_id:input.supersedesFactId||null
  };
}
module.exports={buildFact};
```

- [ ] **Step 4: Implement source persistence**

Create `src/data/gmail-sources.js`:

```js
function throwIfError(error){if(error)throw error;}
function nowIso(){return new Date().toISOString();}

async function upsertGmailSourceRecord(supabase,userId,connectionId,scanRunId,normalized){
  const row={...normalized,user_id:userId,connection_id:connectionId,scan_run_id:scanRunId,updated_at:nowIso()};
  const {data,error}=await supabase.from('gmail_source_records').upsert(row,{onConflict:'user_id,gmail_account_email,gmail_message_id'}).select('*').single();
  throwIfError(error);
  return data;
}

async function upsertGmailAttachmentRecord(supabase,userId,sourceRecordId,attachment){
  const row={
    user_id:userId,
    source_record_id:sourceRecordId,
    gmail_attachment_id:attachment.gmailAttachmentId,
    filename:attachment.filename||null,
    mime_type:attachment.mimeType||null,
    source_link:attachment.sourceLink||null,
    processing_status:attachment.processingStatus||'pending',
    processing_reason:attachment.processingReason||null,
    updated_at:nowIso()
  };
  const {data,error}=await supabase.from('gmail_attachment_records').upsert(row,{onConflict:'source_record_id,gmail_attachment_id'}).select('*').single();
  throwIfError(error);
  return data;
}

async function insertExtractedFacts(supabase,userId,facts){
  if(!facts.length)return [];
  const rows=facts.map(f=>({...f,user_id:userId}));
  const {data,error}=await supabase.from('gmail_extracted_facts').insert(rows).select('*');
  throwIfError(error);
  return data||[];
}

module.exports={upsertGmailSourceRecord,upsertGmailAttachmentRecord,insertExtractedFacts};
```

- [ ] **Step 5: Register and verify**

Add test to `test.js` near data tests.

Run:

```bash
node test/gmail-sources-data.test.js
npm test
node --check src/data/gmail-sources.js
node --check src/domain/gmail-facts.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/gmail-sources.js src/domain/gmail-facts.js test/gmail-sources-data.test.js test.js
git commit -m "feat: persist gmail sources and facts"
```

---

### Task 5: Scan run lifecycle and checkpoints

**Files:**
- Create: `src/data/gmail-scans.js`
- Create: `test/gmail-scans-data.test.js`
- Modify: `test.js`

**Interfaces:**
- Produces:
  - `startGmailScanRun(supabase,userId,connection,scanType,options)`
  - `updateGmailScanProgress(supabase,userId,scanRunId,patch)`
  - `finishGmailScanRun(supabase,userId,connectionId,scanRunId,result)`
  - `failGmailScanRun(supabase,userId,connectionId,scanRunId,errorSummary)`

- [ ] **Step 1: Write scan lifecycle test**

Create `test/gmail-scans-data.test.js`:

```js
const assert=require('node:assert/strict');
const {startGmailScanRun,finishGmailScanRun,failGmailScanRun}=require('../src/data/gmail-scans');

function fakeSupabase(){
  const calls=[];
  const chain={
    insert(row){calls.push(['insert',row]);return chain;},
    update(row){calls.push(['update',row]);return chain;},
    select(cols){calls.push(['select',cols]);return chain;},
    eq(col,val){calls.push(['eq',col,val]);return chain;},
    single(){calls.push(['single']);return Promise.resolve({data:{id:'scan1'},error:null});}
  };
  return {calls,from(table){calls.push(['from',table]);return chain;}};
}

(async()=>{
  const supabase=fakeSupabase();
  await startGmailScanRun(supabase,'user1',{id:'conn1'},'initial',{scannerVersion:'scanner1',lookbackStartAt:'2025-09-13T00:00:00Z'});
  assert.equal(supabase.calls[0][1],'gmail_scan_runs');
  assert.equal(supabase.calls[1][1].scan_type,'initial');
  assert.equal(supabase.calls[1][1].status,'running');

  const supabase2=fakeSupabase();
  await finishGmailScanRun(supabase2,'user1','conn1','scan1',{checkpointReceivedAt:'2026-09-13T00:00:00Z',checkpointMessageId:'msg9',firstScanCompleted:true});
  assert.equal(supabase2.calls[1][1].status,'succeeded');
  assert.equal(supabase2.calls[6][1].checkpoint_message_id,'msg9');
  assert.equal(Boolean(supabase2.calls[6][1].first_scan_completed_at),true);

  const supabase3=fakeSupabase();
  await failGmailScanRun(supabase3,'user1','conn1','scan1','google timeout');
  assert.equal(supabase3.calls[1][1].status,'failed');
  assert.equal(supabase3.calls[6][1].last_error,'google timeout');
  console.log('gmail scan lifecycle tests passed');
})();
```

- [ ] **Step 2: Verify red**

Run:

```bash
node test/gmail-scans-data.test.js
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement scan lifecycle**

Create `src/data/gmail-scans.js` with focused helpers. Required behavior:

```js
function throwIfError(error){if(error)throw error;}
function nowIso(){return new Date().toISOString();}

async function startGmailScanRun(supabase,userId,connection,scanType,options={}){
  const row={
    user_id:userId,
    connection_id:connection.id,
    scan_type:scanType,
    status:'running',
    scanner_version:options.scannerVersion,
    lookback_start_at:options.lookbackStartAt||null,
    checkpoint_before_at:connection.checkpoint_received_at||null
  };
  const {data,error}=await supabase.from('gmail_scan_runs').insert(row).select('*').single();
  throwIfError(error);
  return data;
}

async function updateGmailScanProgress(supabase,userId,scanRunId,patch){
  const {data,error}=await supabase.from('gmail_scan_runs').update(patch).eq('user_id',userId).eq('id',scanRunId).select('*').single();
  throwIfError(error);
  return data;
}

async function finishGmailScanRun(supabase,userId,connectionId,scanRunId,result={}){
  const finishedAt=nowIso();
  const {data,error}=await supabase.from('gmail_scan_runs').update({
    status:'succeeded',
    finished_at:finishedAt,
    checkpoint_after_at:result.checkpointReceivedAt||null,
    error_summary:null
  }).eq('user_id',userId).eq('id',scanRunId).select('*').single();
  throwIfError(error);
  const connectionPatch={
    status:'connected',
    last_successful_scan_at:finishedAt,
    last_attempted_scan_at:finishedAt,
    last_error:null,
    updated_at:finishedAt
  };
  if(result.checkpointReceivedAt)connectionPatch.checkpoint_received_at=result.checkpointReceivedAt;
  if(result.checkpointMessageId)connectionPatch.checkpoint_message_id=result.checkpointMessageId;
  if(result.firstScanCompleted)connectionPatch.first_scan_completed_at=finishedAt;
  const conn=await supabase.from('gmail_connections').update(connectionPatch).eq('user_id',userId).eq('id',connectionId).select('*').single();
  throwIfError(conn.error);
  return data;
}

async function failGmailScanRun(supabase,userId,connectionId,scanRunId,errorSummary){
  const finishedAt=nowIso();
  const {data,error}=await supabase.from('gmail_scan_runs').update({status:'failed',finished_at:finishedAt,error_summary:errorSummary}).eq('user_id',userId).eq('id',scanRunId).select('*').single();
  throwIfError(error);
  const conn=await supabase.from('gmail_connections').update({status:'degraded',last_attempted_scan_at:finishedAt,last_error:errorSummary,updated_at:finishedAt}).eq('user_id',userId).eq('id',connectionId).select('*').single();
  throwIfError(conn.error);
  return data;
}

module.exports={startGmailScanRun,updateGmailScanProgress,finishGmailScanRun,failGmailScanRun};
```

- [ ] **Step 4: Register and verify**

Add test to `test.js`.

Run:

```bash
node test/gmail-scans-data.test.js
npm test
node --check src/data/gmail-scans.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/gmail-scans.js test/gmail-scans-data.test.js test.js
git commit -m "feat: track gmail scan lifecycle"
```

---

### Task 6: Read-only Gmail provider

**Files:**
- Create: `src/services/gmail-provider.js`
- Create: `test/gmail-provider.test.js`
- Modify: `test.js`

**Interfaces:**
- Produces:
  - `buildEligibleMessagesQuery({after,before})`
  - `createGmailProvider({fetch,accessToken})`
  - provider methods `listMessages(query,pageToken)`, `getMessage(messageId)`, `getAttachment(messageId,attachmentId)`

- [ ] **Step 1: Write provider tests**

Create `test/gmail-provider.test.js`:

```js
const assert=require('node:assert/strict');
const {buildEligibleMessagesQuery,createGmailProvider}=require('../src/services/gmail-provider');

assert.equal(buildEligibleMessagesQuery({after:'2025/09/13',before:'2026/09/14'}),'after:2025/09/13 before:2026/09/14 -in:sent -in:drafts -in:spam -in:trash');

(async()=>{
  const calls=[];
  const provider=createGmailProvider({
    accessToken:'token1',
    fetch:async(url,opts)=>{
      calls.push({url,opts});
      return {ok:true,json:async()=>({messages:[{id:'m1'}]})};
    }
  });
  const result=await provider.listMessages('after:2025/09/13',null);
  assert.equal(result.messages[0].id,'m1');
  assert.match(calls[0].url,/gmail\/v1\/users\/me\/messages/);
  assert.equal(calls[0].opts.headers.Authorization,'Bearer token1');
  assert.equal(calls[0].opts.method,'GET');
  console.log('gmail provider tests passed');
})();
```

- [ ] **Step 2: Verify red**

Run:

```bash
node test/gmail-provider.test.js
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement provider**

Create `src/services/gmail-provider.js`:

```js
const BASE='https://gmail.googleapis.com/gmail/v1/users/me';

function buildEligibleMessagesQuery({after,before}){
  const parts=[];
  if(after)parts.push(`after:${after}`);
  if(before)parts.push(`before:${before}`);
  parts.push('-in:sent','-in:drafts','-in:spam','-in:trash');
  return parts.join(' ');
}

async function readJson(response){
  const body=await response.json().catch(()=>({}));
  if(!response.ok){
    const err=new Error(body.error?.message||`Gmail API failed with ${response.status}`);
    err.status=response.status;
    err.body=body;
    throw err;
  }
  return body;
}

function createGmailProvider({fetch,accessToken}){
  if(!fetch)throw new Error('fetch is required');
  if(!accessToken)throw new Error('accessToken is required');
  const request=async(path,params={})=>{
    const url=new URL(`${BASE}${path}`);
    for(const [key,value] of Object.entries(params))if(value!==undefined&&value!==null)url.searchParams.set(key,value);
    return readJson(await fetch(url.toString(),{method:'GET',headers:{Authorization:`Bearer ${accessToken}`}}));
  };
  return {
    listMessages(query,pageToken){return request('/messages',{q:query,pageToken,maxResults:100});},
    getMessage(messageId){return request(`/messages/${encodeURIComponent(messageId)}`,{format:'full'});},
    getAttachment(messageId,attachmentId){return request(`/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`);}
  };
}

module.exports={buildEligibleMessagesQuery,createGmailProvider};
```

- [ ] **Step 4: Register and verify**

Add test to `test.js`.

Run:

```bash
node test/gmail-provider.test.js
npm test
node --check src/services/gmail-provider.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/gmail-provider.js test/gmail-provider.test.js test.js
git commit -m "feat: add read-only gmail provider"
```

---

### Task 7: Native-text PDF handling

**Files:**
- Create: `src/services/gmail-pdf.js`
- Create: `test/gmail-pdf.test.js`
- Modify: `test.js`
- Modify: `package.json` if adding a PDF text dependency is required

**Interfaces:**
- Produces:
  - `findPdfAttachments(message)`
  - `extractNativePdfText(buffer,options)` returning `{status,text,reason}`

- [ ] **Step 1: Write PDF tests**

Create `test/gmail-pdf.test.js`:

```js
const assert=require('node:assert/strict');
const {findPdfAttachments,extractNativePdfText}=require('../src/services/gmail-pdf');

const message={payload:{parts:[
  {filename:'itinerary.pdf',mimeType:'application/pdf',body:{attachmentId:'att1'}},
  {filename:'photo.jpg',mimeType:'image/jpeg',body:{attachmentId:'att2'}}
]}};
const pdfs=findPdfAttachments(message);
assert.equal(pdfs.length,1);
assert.equal(pdfs[0].gmailAttachmentId,'att1');
assert.equal(pdfs[0].filename,'itinerary.pdf');

(async()=>{
  const empty=await extractNativePdfText(Buffer.from(''),{});
  assert.equal(empty.status,'skipped');
  assert.equal(empty.reason,'empty_pdf');
  console.log('gmail pdf tests passed');
})();
```

- [ ] **Step 2: Verify red**

Run:

```bash
node test/gmail-pdf.test.js
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement attachment discovery and safe text extraction wrapper**

Create `src/services/gmail-pdf.js`:

```js
function flattenParts(part,out=[]){
  if(!part)return out;
  if(Array.isArray(part.parts))for(const child of part.parts)flattenParts(child,out);
  else out.push(part);
  return out;
}

function findPdfAttachments(message){
  return flattenParts(message.payload).filter(part=>part.mimeType==='application/pdf'&&part.body&&part.body.attachmentId).map(part=>({
    gmailAttachmentId:part.body.attachmentId,
    filename:part.filename||'attachment.pdf',
    mimeType:part.mimeType
  }));
}

async function extractNativePdfText(buffer,{pdfParse}={}){
  if(!buffer||buffer.length===0)return {status:'skipped',text:'',reason:'empty_pdf'};
  if(!pdfParse)return {status:'skipped',text:'',reason:'pdf_parser_not_configured'};
  try{
    const result=await pdfParse(buffer);
    const text=String(result.text||'').trim();
    if(!text)return {status:'skipped',text:'',reason:'no_native_text'};
    return {status:'processed',text,reason:null};
  }catch(error){
    const msg=String(error.message||error);
    if(/password/i.test(msg))return {status:'skipped',text:'',reason:'password_protected_pdf'};
    return {status:'retry',text:'',reason:'pdf_parse_error'};
  }
}

module.exports={findPdfAttachments,extractNativePdfText};
```

Do not implement OCR in this task.

- [ ] **Step 4: Decide dependency handling during implementation**

If the existing repo already has a PDF native-text parser dependency, inject it into `extractNativePdfText`. If not, add a small dependency such as `pdf-parse` only if install works cleanly and update tests accordingly. Keep the wrapper injectable so tests do not rely on binary PDF fixtures.

- [ ] **Step 5: Register and verify**

Add test to `test.js`.

Run:

```bash
node test/gmail-pdf.test.js
npm test
node --check src/services/gmail-pdf.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/gmail-pdf.js test/gmail-pdf.test.js test.js package.json package-lock.json
git commit -m "feat: detect gmail pdf attachments"
```

If no dependency/package-lock changes are made, omit them from `git add`.

---

### Task 8: Trip-first extractor

**Files:**
- Create: `src/domain/gmail-trip-extractor.js`
- Create: `test/gmail-trip-extractor.test.js`
- Modify: `test.js`

**Interfaces:**
- Produces:
  - `extractTripFacts(envelope,options)` returning array of facts from `buildFact`
- Consumes:
  - `buildFact(input)` from `src/domain/gmail-facts.js`

- [ ] **Step 1: Write extractor tests**

Create `test/gmail-trip-extractor.test.js`:

```js
const assert=require('node:assert/strict');
const {extractTripFacts}=require('../src/domain/gmail-trip-extractor');

const envelope={
  sourceRecordId:'src1',
  sender:'Qantas <bookings@qantas.com>',
  subject:'Your flight booking QF401 confirmation ABC123',
  receivedAt:'2026-09-13T00:00:00Z',
  text:'Booking reference ABC123\nFlight QF401\nSydney to Melbourne\nDepart 2026-10-02 08:20\nArrive 2026-10-02 09:55'
};
const facts=extractTripFacts(envelope,{parserVersion:'parser1'});
assert.equal(facts.some(f=>f.fact_type==='trip.booking_reference'&&f.fact_value.reference==='ABC123'),true);
assert.equal(facts.some(f=>f.fact_type==='trip.flight'&&f.fact_value.flightNumber==='QF401'),true);
assert.equal(facts.every(f=>f.parser_version==='parser1'),true);
assert.equal(facts.every(f=>f.classification_confidence>=0.7),true);

const cancel=extractTripFacts({...envelope,subject:'Your hotel booking has been cancelled',text:'Booking reference H123 has been cancelled. Refund $284.00'}, {parserVersion:'parser1'});
assert.equal(cancel.some(f=>f.fact_type==='trip.cancellation'),true);
assert.equal(cancel.some(f=>f.fact_type==='trip.refund'),true);
console.log('gmail trip extractor tests passed');
```

- [ ] **Step 2: Verify red**

Run:

```bash
node test/gmail-trip-extractor.test.js
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement conservative trip extraction**

Create `src/domain/gmail-trip-extractor.js`:

```js
const {buildFact}=require('./gmail-facts');

function findBookingReference(text){
  const match=text.match(/(?:booking reference|confirmation|reservation|ref(?:erence)?)[^A-Z0-9]{0,20}([A-Z0-9]{5,10})/i);
  return match?match[1].toUpperCase():null;
}
function findFlightNumber(text){
  const match=text.match(/\b([A-Z]{2}\d{2,4})\b/);
  return match?match[1].toUpperCase():null;
}
function findMoney(text){
  const match=text.match(/\$\s?([0-9]+(?:\.[0-9]{2})?)/);
  return match?Number(match[1]):null;
}
function confidenceForTrip(text){
  return /flight|hotel|booking|itinerary|reservation|airline|train|ferry|cruise|tour|ticket|check-in|car hire|rental car/i.test(text)?0.85:0.4;
}

function extractTripFacts(envelope,{parserVersion}){
  const text=[envelope.sender,envelope.subject,envelope.text].filter(Boolean).join('\n');
  const classificationConfidence=confidenceForTrip(text);
  if(classificationConfidence<0.7)return [];
  const common={sourceRecordId:envelope.sourceRecordId,attachmentRecordId:envelope.attachmentRecordId||null,parserVersion,classificationConfidence,extractionConfidence:0.8};
  const facts=[];
  const reference=findBookingReference(text);
  if(reference)facts.push(buildFact({...common,factType:'trip.booking_reference',factValue:{reference}}));
  const flightNumber=findFlightNumber(text);
  if(flightNumber)facts.push(buildFact({...common,factType:'trip.flight',factValue:{flightNumber}}));
  if(/cancelled|canceled|cancellation/i.test(text))facts.push(buildFact({...common,factType:'trip.cancellation',factValue:{status:'cancelled'}}));
  const amount=findMoney(text);
  if(amount!==null&&/refund/i.test(text))facts.push(buildFact({...common,factType:'trip.refund',factValue:{amount,currency:'AUD'}}));
  if(/hotel|accommodation|check-in|check out|checkout/i.test(text))facts.push(buildFact({...common,factType:'trip.accommodation',factValue:{provider:envelope.sender||null}}));
  if(/car hire|rental car|vehicle booking/i.test(text))facts.push(buildFact({...common,factType:'trip.car_hire',factValue:{provider:envelope.sender||null}}));
  return facts;
}

module.exports={extractTripFacts,findBookingReference,findFlightNumber};
```

This extractor is intentionally conservative. Do not attempt a full LLM-style parser in this release task. UAT can identify where deterministic extraction is too weak.

- [ ] **Step 4: Register and verify**

Add test to `test.js`.

Run:

```bash
node test/gmail-trip-extractor.test.js
npm test
node --check src/domain/gmail-trip-extractor.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/gmail-trip-extractor.js test/gmail-trip-extractor.test.js test.js
git commit -m "feat: extract trip facts from gmail sources"
```

---

### Task 9: Trip matching and decision engine

**Files:**
- Create: `src/domain/gmail-trip-matcher.js`
- Create: `src/domain/gmail-decisions.js`
- Create: `test/gmail-trip-matcher.test.js`
- Create: `test/gmail-decisions.test.js`
- Modify: `test.js`

**Interfaces:**
- Produces:
  - `rankTripMatch(facts,existingTrips)` returning `{kind,tripId,score,reasons}`
  - `decideGmailTripActions({facts,match,manualFields})` returning decisions of type `create_trip`, `update_trip`, `review`, `ignore`

- [ ] **Step 1: Write matcher test**

Create `test/gmail-trip-matcher.test.js`:

```js
const assert=require('node:assert/strict');
const {rankTripMatch}=require('../src/domain/gmail-trip-matcher');

const facts=[{fact_type:'trip.booking_reference',fact_value:{reference:'ABC123'}}];
const trips=[{id:'trip1',bookingReferences:['ABC123'],title:'Melbourne'}];
const exact=rankTripMatch(facts,trips);
assert.equal(exact.kind,'automatic');
assert.equal(exact.tripId,'trip1');
assert.equal(exact.score>=0.95,true);
assert.equal(exact.reasons.includes('exact_booking_reference'),true);

const weak=rankTripMatch([{fact_type:'trip.flight',fact_value:{flightNumber:'QF401'}}],[{id:'trip2',bookingReferences:[],title:'Melbourne'}]);
assert.equal(weak.kind,'review');
console.log('gmail trip matcher tests passed');
```

Create `test/gmail-decisions.test.js`:

```js
const assert=require('node:assert/strict');
const {decideGmailTripActions}=require('../src/domain/gmail-decisions');

const facts=[{fact_type:'trip.flight',fact_value:{flightNumber:'QF401'},extraction_confidence:0.9}];
const update=decideGmailTripActions({facts,match:{kind:'automatic',tripId:'trip1',score:0.96,reasons:['exact_booking_reference']},manualFields:new Set()});
assert.equal(update[0].type,'update_trip');
assert.equal(update[0].tripId,'trip1');

const conflict=decideGmailTripActions({facts,match:{kind:'automatic',tripId:'trip1',score:0.96,reasons:['exact_booking_reference']},manualFields:new Set(['flightNumber'])});
assert.equal(conflict[0].type,'review');
assert.equal(conflict[0].reviewType,'resolve_conflict');

const create=decideGmailTripActions({facts,match:{kind:'none',tripId:null,score:0,reasons:[]},manualFields:new Set()});
assert.equal(create[0].type,'create_trip');
console.log('gmail decision tests passed');
```

- [ ] **Step 2: Verify red**

Run:

```bash
node test/gmail-trip-matcher.test.js
node test/gmail-decisions.test.js
```

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement matcher**

Create `src/domain/gmail-trip-matcher.js`:

```js
function factValues(facts,type){return facts.filter(f=>f.fact_type===type).map(f=>f.fact_value);}
function rankTripMatch(facts,existingTrips=[]){
  const refs=factValues(facts,'trip.booking_reference').map(v=>String(v.reference||'').toUpperCase()).filter(Boolean);
  for(const trip of existingTrips){
    const tripRefs=(trip.bookingReferences||[]).map(v=>String(v).toUpperCase());
    if(refs.some(ref=>tripRefs.includes(ref)))return {kind:'automatic',tripId:trip.id,score:0.99,reasons:['exact_booking_reference']};
  }
  return {kind:facts.length?'review':'none',tripId:null,score:facts.length?0.45:0,reasons:facts.length?['weak_trip_evidence']:[]};
}
module.exports={rankTripMatch};
```

- [ ] **Step 4: Implement decisions**

Create `src/domain/gmail-decisions.js`:

```js
function hasManualConflict(facts,manualFields){
  for(const fact of facts){
    if(fact.fact_type==='trip.flight'&&manualFields.has('flightNumber'))return true;
    if(fact.fact_type==='trip.accommodation'&&manualFields.has('accommodation'))return true;
    if(fact.fact_type==='trip.cancellation'&&manualFields.has('status'))return true;
  }
  return false;
}

function decideGmailTripActions({facts,match,manualFields}){
  if(!facts.length)return [{type:'ignore',reason:'no_trip_facts'}];
  if(match.kind==='automatic'){
    if(hasManualConflict(facts,manualFields))return [{type:'review',reviewType:'resolve_conflict',tripId:match.tripId,recommendedAction:null,reason:'gmail_conflicts_with_manual_field'}];
    return [{type:'update_trip',tripId:match.tripId,facts,automatic:true,reasons:match.reasons}];
  }
  if(match.kind==='review')return [{type:'review',reviewType:'confirm_match',facts,recommendedAction:null,reason:'weak_match'}];
  return [{type:'create_trip',facts,automatic:true,reason:'high_confidence_new_trip'}];
}
module.exports={decideGmailTripActions,hasManualConflict};
```

- [ ] **Step 5: Register and verify**

Add both tests to `test.js`.

Run:

```bash
node test/gmail-trip-matcher.test.js
node test/gmail-decisions.test.js
npm test
node --check src/domain/gmail-trip-matcher.js
node --check src/domain/gmail-decisions.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/gmail-trip-matcher.js src/domain/gmail-decisions.js test/gmail-trip-matcher.test.js test/gmail-decisions.test.js test.js
git commit -m "feat: decide gmail trip actions"
```

---

### Task 10: Gmail scan runner orchestration

**Files:**
- Create: `src/services/gmail-scan-runner.js`
- Create: `test/gmail-scan-runner.test.js`
- Modify: `test.js`

**Interfaces:**
- Produces:
  - `runGmailScan({supabase,userId,connection,provider,config,existingTrips})`
  - `determineScanWindow(connection,now,lookbackMonths)`

- [ ] **Step 1: Write scan runner test**

Create `test/gmail-scan-runner.test.js`:

```js
const assert=require('node:assert/strict');
const {determineScanWindow,runGmailScan}=require('../src/services/gmail-scan-runner');

const initial=determineScanWindow({first_scan_completed_at:null},new Date('2026-09-13T12:00:00Z'),12);
assert.equal(initial.scanType,'initial');
assert.equal(initial.after,'2025/09/13');

const incremental=determineScanWindow({first_scan_completed_at:'2026-09-13T01:00:00Z',checkpoint_received_at:'2026-09-12T00:00:00Z'},new Date('2026-09-13T12:00:00Z'),12);
assert.equal(incremental.scanType,'manual_incremental');
assert.equal(incremental.after,'2026/09/12');

(async()=>{
  const processed=[];
  const result=await runGmailScan({
    supabase:{},
    userId:'user1',
    connection:{id:'conn1',gmail_account_email:'me@example.com',first_scan_completed_at:null},
    provider:{
      listMessages:async()=>({messages:[{id:'m1'}]}),
      getMessage:async()=>({id:'m1',threadId:'t1',labelIds:['INBOX'],internalDate:String(Date.parse('2026-09-13T00:00:00Z')),payload:{headers:[{name:'Subject',value:'Flight QF401 booking ABC123'}]}})
    },
    config:{scannerVersion:'scanner1',parserVersion:'parser1',initialLookbackMonths:12},
    existingTrips:[],
    persistence:{
      startScan:async()=>({id:'scan1'}),
      upsertSource:async(row)=>{processed.push(row.gmail_message_id);return {id:'src1',...row};},
      insertFacts:async()=>[],
      finishScan:async()=>({}),
      failScan:async()=>({})
    }
  });
  assert.equal(result.status,'succeeded');
  assert.deepEqual(processed,['m1']);
  console.log('gmail scan runner tests passed');
})();
```

- [ ] **Step 2: Verify red**

Run:

```bash
node test/gmail-scan-runner.test.js
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement scan runner skeleton**

Create `src/services/gmail-scan-runner.js`. Keep it dependency-injectable so tests do not call Gmail or Supabase directly:

```js
const {buildEligibleMessagesQuery}=require('./gmail-provider');
const {isEligibleReceivedMessage}=require('../domain/gmail-eligibility');
const {normalizeGmailMessage}=require('../domain/gmail-normalize');
const {extractTripFacts}=require('../domain/gmail-trip-extractor');

function ymd(date){return date.toISOString().slice(0,10).replaceAll('-','/');}
function addMonths(date,months){const d=new Date(date);d.setUTCMonth(d.getUTCMonth()+months);return d;}
function determineScanWindow(connection,now=new Date(),lookbackMonths=12){
  if(!connection.first_scan_completed_at){
    const after=addMonths(now,-lookbackMonths);
    return {scanType:'initial',after:ymd(after),before:ymd(addMonths(now,0))};
  }
  const checkpoint=connection.checkpoint_received_at?new Date(connection.checkpoint_received_at):addMonths(now,-lookbackMonths);
  return {scanType:'manual_incremental',after:ymd(checkpoint),before:ymd(addMonths(now,0))};
}

async function runGmailScan({supabase,userId,connection,provider,config,existingTrips=[],persistence}){
  const window=determineScanWindow(connection,new Date(),config.initialLookbackMonths);
  const query=buildEligibleMessagesQuery(window);
  const scan=await persistence.startScan(supabase,userId,connection,window.scanType,{scannerVersion:config.scannerVersion,lookbackStartAt:window.after});
  let newest=null;
  try{
    const listed=await provider.listMessages(query,null);
    const messages=listed.messages||[];
    for(const ref of messages){
      const message=await provider.getMessage(ref.id);
      if(!isEligibleReceivedMessage(message))continue;
      const normalized=normalizeGmailMessage(message,connection.gmail_account_email,config.scannerVersion);
      const source=await persistence.upsertSource(normalized,scan.id);
      newest=newest||normalized;
      const facts=extractTripFacts({sourceRecordId:source.id,sender:normalized.sender,subject:normalized.subject,receivedAt:normalized.received_at,text:message.snippet||''},{parserVersion:config.parserVersion});
      await persistence.insertFacts(facts);
    }
    await persistence.finishScan(supabase,userId,connection.id,scan.id,{checkpointReceivedAt:newest&&newest.received_at,checkpointMessageId:newest&&newest.gmail_message_id,firstScanCompleted:window.scanType==='initial'});
    return {status:'succeeded',processedCount:messages.length};
  }catch(error){
    await persistence.failScan(supabase,userId,connection.id,scan.id,String(error.message||error));
    return {status:'failed',error:String(error.message||error)};
  }
}

module.exports={determineScanWindow,runGmailScan};
```

This task intentionally handles only a single page of Gmail results. Pagination, PDFs, review/action application, and resumability are added in later tasks.

- [ ] **Step 4: Register and verify**

Add test to `test.js`.

Run:

```bash
node test/gmail-scan-runner.test.js
npm test
node --check src/services/gmail-scan-runner.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/gmail-scan-runner.js test/gmail-scan-runner.test.js test.js
git commit -m "feat: orchestrate manual gmail scans"
```

---

### Task 11: Review/action and trip application integration

**Files:**
- Modify: `src/services/gmail-scan-runner.js`
- Modify: existing trip/Life Admin data modules as narrowly required
- Create/Modify: `test/gmail-scan-runner.test.js`
- Create/Modify: `test/gmail-decisions.test.js`

**Interfaces:**
- Consumes:
  - `rankTripMatch(facts,existingTrips)`
  - `decideGmailTripActions({facts,match,manualFields})`
- Produces application hooks injected into runner:
  - `applyCreateTripFromGmail(decision)`
  - `applyUpdateTripFromGmail(decision)`
  - `createGmailReviewItem(decision)`
  - `recordGmailActivity(entry)`

- [ ] **Step 1: Extend tests for no silent overwrite**

Add to `test/gmail-decisions.test.js`:

```js
const manualConflict=decideGmailTripActions({
  facts:[{fact_type:'trip.cancellation',fact_value:{status:'cancelled'},extraction_confidence:0.95}],
  match:{kind:'automatic',tripId:'trip1',score:0.99,reasons:['exact_booking_reference']},
  manualFields:new Set(['status'])
});
assert.equal(manualConflict[0].type,'review');
assert.equal(manualConflict[0].reviewType,'resolve_conflict');
```

Add to scan-runner tests an injected decision/application assertion:

```js
// Verify the runner calls createReview instead of update when decision is review.
```

Use an injected `actions` object to record which path was called.

- [ ] **Step 2: Verify red or incomplete behavior**

Run:

```bash
node test/gmail-decisions.test.js
node test/gmail-scan-runner.test.js
```

Expected: FAIL or missing assertion until the runner uses matcher/decision/application hooks.

- [ ] **Step 3: Wire matcher and decision hooks into scan runner**

Modify `src/services/gmail-scan-runner.js` so after facts are inserted it:

```js
const match=rankTripMatch(facts,existingTrips);
const manualFields=await actions.getManualFieldsForMatch(match);
const decisions=decideGmailTripActions({facts,match,manualFields});
for(const decision of decisions){
  if(decision.type==='create_trip')await actions.applyCreateTripFromGmail(decision);
  else if(decision.type==='update_trip')await actions.applyUpdateTripFromGmail(decision);
  else if(decision.type==='review')await actions.createGmailReviewItem(decision);
  else await actions.recordGmailActivity({action:'skip',reason:decision.reason});
}
```

Default `actions` in production must call existing trip/Life Admin/review data layers. Tests may inject stubs.

- [ ] **Step 4: Implement minimal production application hooks**

Create narrow wrappers near the runner or in existing service modules. Do not rewrite trip architecture. Required behavior:

- create high-confidence Gmail-created trip records with source/activity links;
- update high-confidence non-manual fields only;
- create Action Needed items for weak matches/conflicts/unreadable relevant sources;
- write `gmail_activity_entries` for automatic changes.

Use existing trip and Life Admin functions where available. If existing modules lack a safe function, add a small one with its own test rather than bypassing the data layer.

- [ ] **Step 5: Verify**

Run:

```bash
node test/gmail-decisions.test.js
node test/gmail-scan-runner.test.js
npm test
node --check src/services/gmail-scan-runner.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/gmail-scan-runner.js src/data src/domain test/gmail-decisions.test.js test/gmail-scan-runner.test.js test.js
git commit -m "feat: apply gmail trip decisions safely"
```

---

### Task 12: Gmail settings page and manual scan routes

**Files:**
- Create: `src/pages/gmail-settings.js`
- Create: `src/routes/gmail.js`
- Create: `test/gmail-pages.test.js`
- Create: `test/gmail-routes.test.js`
- Modify: `src/app.js`
- Modify: settings/admin navigation module
- Modify: `test.js`

**Interfaces:**
- Produces routes:
  - `GET /me/settings/gmail`
  - `POST /me/settings/gmail/connect`
  - `GET /me/settings/gmail/callback`
  - `POST /me/settings/gmail/disconnect`
  - `POST /me/settings/gmail/scan-now`
  - `POST /me/settings/gmail/retry-failed`

- [ ] **Step 1: Write page test**

Create `test/gmail-pages.test.js`:

```js
const assert=require('node:assert/strict');
const {renderGmailSettingsPage}=require('../src/pages/gmail-settings');

const html=renderGmailSettingsPage({
  connection:null,
  scanHistory:[],
  latestScan:null,
  csrfToken:'token1'
});
assert.match(html,/preston\.ai Gmail/i);
assert.match(html,/Connect Gmail/i);
assert.match(html,/read-only/i);
assert.match(html,/12-month/i);
assert.doesNotMatch(html,/send email/i);

const connected=renderGmailSettingsPage({
  connection:{gmail_account_email:'me@example.com',status:'connected',first_scan_completed_at:null},
  scanHistory:[{scan_type:'initial',status:'succeeded',processed_count:12,relevant_count:3,review_items_created_count:1,started_at:'2026-09-13T00:00:00Z'}],
  latestScan:null,
  csrfToken:'token1'
});
assert.match(connected,/me@example\.com/);
assert.match(connected,/Scan Gmail now/);
assert.match(connected,/Spam, Trash, Drafts, and Sent Mail/i);
console.log('gmail settings page tests passed');
```

Create `test/gmail-routes.test.js` with route registration smoke assertions matching existing route-test patterns. Minimum assertions:

```js
const assert=require('node:assert/strict');
const {createGmailRouter}=require('../src/routes/gmail');
assert.equal(typeof createGmailRouter,'function');
const router=createGmailRouter({});
assert.equal(typeof router,'function');
console.log('gmail route tests passed');
```

- [ ] **Step 2: Verify red**

Run:

```bash
node test/gmail-pages.test.js
node test/gmail-routes.test.js
```

Expected: FAIL because files do not exist.

- [ ] **Step 3: Implement Gmail settings page**

Create `src/pages/gmail-settings.js` with a server-rendered page consistent with existing page helpers. Required content:

- heading `preston.ai Gmail`;
- connection status;
- connected account email if present;
- explicit first-scan scope statement;
- `Connect Gmail` control when disconnected;
- `Scan Gmail now` control when connected;
- `Disconnect Gmail` control when connected;
- recent scan summary/history;
- counts for ignored/relevant mail only, not a browsable Gmail mirror;
- no wording that implies Gmail write access.

- [ ] **Step 4: Implement routes**

Create `src/routes/gmail.js`. Follow existing authenticated route patterns. Use dependency injection so tests can pass stubs:

```js
function createGmailRouter(deps){
  const router=require('express').Router();
  router.get('/me/settings/gmail',deps.requireUser,async(req,res,next)=>{ /* load connection/history and render */ });
  router.post('/me/settings/gmail/connect',deps.requireUser,async(req,res,next)=>{ /* redirect to Google OAuth */ });
  router.get('/me/settings/gmail/callback',deps.requireUser,async(req,res,next)=>{ /* exchange code, save connection, redirect */ });
  router.post('/me/settings/gmail/disconnect',deps.requireUser,async(req,res,next)=>{ /* mark disconnected only */ });
  router.post('/me/settings/gmail/scan-now',deps.requireUser,async(req,res,next)=>{ /* start manual scan */ });
  router.post('/me/settings/gmail/retry-failed',deps.requireUser,async(req,res,next)=>{ /* retry manually retryable failures */ });
  return router;
}
module.exports={createGmailRouter};
```

Use project-local route patterns for CSRF/session handling; do not invent a second auth system.

- [ ] **Step 5: Mount routes**

Modify `src/app.js` to mount Gmail routes with dependencies alongside existing authenticated routes.

Add a navigation link from the settings/admin area to `/me/settings/gmail`.

- [ ] **Step 6: Register and verify**

Add page/route tests to `test.js`.

Run:

```bash
node test/gmail-pages.test.js
node test/gmail-routes.test.js
npm test
node --check src/pages/gmail-settings.js
node --check src/routes/gmail.js
node --check src/app.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/gmail-settings.js src/routes/gmail.js src/app.js src/pages src/routes test/gmail-pages.test.js test/gmail-routes.test.js test.js
git commit -m "feat: add gmail settings and manual scan"
```

---

### Task 13: OAuth callback and token handling hardening

**Files:**
- Modify: `src/routes/gmail.js`
- Modify: `src/security/credential-crypto.js` or equivalent existing token encryption module
- Create/Modify: `test/gmail-routes.test.js`

**Interfaces:**
- Consumes existing credential encryption utilities.
- Produces safe OAuth exchange and encrypted token storage.

- [ ] **Step 1: Extend route tests for OAuth separation**

Add tests asserting:

- connect route requests Gmail readonly scope only;
- callback saves account email and encrypted token values;
- callback does not start the 12-month scan automatically;
- disconnect marks status disconnected and does not delete derived data.

Use stubs:

```js
const deps={
  googleOAuth:{buildAuthUrl:()=>'/google-auth',exchangeCode:async()=>({accountEmail:'me@example.com',googleSubject:'sub1',accessToken:'access',refreshToken:'refresh',scope:'https://www.googleapis.com/auth/gmail.readonly'})},
  encrypt:plaintext=>`enc:${plaintext}`,
  upsertGmailConnection:async(_db,userId,input)=>{saved={userId,input};return {id:'conn1'};},
  startScanNow:async()=>{throw new Error('scan should not start on callback');}
};
```

- [ ] **Step 2: Verify failing behavior**

Run:

```bash
node test/gmail-routes.test.js
```

Expected: FAIL until callback/connect behavior is wired.

- [ ] **Step 3: Implement OAuth handling**

In `src/routes/gmail.js`:

- `POST /connect` builds a Google auth URL with exactly Gmail readonly scope plus required OAuth identity data needed to confirm the Gmail account;
- `GET /callback` exchanges code for tokens;
- encrypt tokens with existing project credential crypto;
- save connection via `upsertGmailConnection`;
- redirect back to `/me/settings/gmail` with connected status;
- do not call scan runner in the callback;
- surface OAuth errors as connection errors on the Gmail settings page.

- [ ] **Step 4: Verify**

Run:

```bash
node test/gmail-routes.test.js
npm test
node --check src/routes/gmail.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/gmail.js test/gmail-routes.test.js
git commit -m "feat: connect read-only gmail account"
```

---

### Task 14: Pagination, resumability, PDFs, and scan summaries

**Files:**
- Modify: `src/services/gmail-scan-runner.js`
- Modify: `src/services/gmail-pdf.js`
- Modify: `src/data/gmail-scans.js`
- Modify: `src/data/gmail-sources.js`
- Modify: `test/gmail-scan-runner.test.js`
- Modify: `test/gmail-pdf.test.js`

**Interfaces:**
- Extends scan runner to process all pages in bounded internal batches.
- Extends source persistence to mark statuses: processed, ignored, skipped, retry.

- [ ] **Step 1: Add pagination and idempotency tests**

Extend `test/gmail-scan-runner.test.js`:

```js
// provider.listMessages returns page 1 with nextPageToken, then page 2.
// Assert both pages are processed.
// Run the same scan twice with persistence stubs that simulate existing source records.
// Assert no duplicate fact/application calls are made for already processed source records.
```

Add PDF test:

```js
// message contains native-text PDF attachment;
// provider.getAttachment returns base64url data;
// pdf extractor returns text containing booking details;
// runner creates attachment record and extracts facts from attachment text.
```

- [ ] **Step 2: Verify red**

Run:

```bash
node test/gmail-scan-runner.test.js
node test/gmail-pdf.test.js
```

Expected: FAIL until pagination/PDF handling is implemented.

- [ ] **Step 3: Implement pagination**

Modify scan runner to loop through `nextPageToken` until absent. Process messages newest-to-oldest in provider order. Maintain counters:

- discovered
- processed
- ignored
- relevant
- facts created
- records created/updated
- review items created
- unreadable PDFs

Update scan progress after each page or batch.

- [ ] **Step 4: Implement idempotent resume behavior**

Before extracting/applying a source, check whether the source already exists with `processing_status='processed'`. If so, count it as already processed and skip reapplication. If it exists as retry/skipped, process according to retry policy.

Checkpoint advances only after the run succeeds to the newest processed boundary. Review items do not block checkpoint progress.

- [ ] **Step 5: Implement PDF fetch and extraction**

For each PDF attachment on a relevant message:

- create/update `gmail_attachment_records`;
- fetch attachment bytes from Gmail;
- base64url-decode data;
- extract native text via `extractNativePdfText`;
- create facts with `attachment_record_id` when text is processed;
- mark skipped/retry with reason when extraction fails;
- do not fail the whole scan for password-protected/corrupt/no-text PDFs;
- create Action Needed only when the parent source is likely relevant and missing PDF content materially blocks interpretation.

- [ ] **Step 6: Verify**

Run:

```bash
node test/gmail-scan-runner.test.js
node test/gmail-pdf.test.js
npm test
node --check src/services/gmail-scan-runner.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/gmail-scan-runner.js src/services/gmail-pdf.js src/data/gmail-scans.js src/data/gmail-sources.js test/gmail-scan-runner.test.js test/gmail-pdf.test.js
git commit -m "feat: complete resumable gmail scanning"
```

---

### Task 15: Activity trail and undo Gmail update

**Files:**
- Modify: `src/data/gmail-sources.js`
- Modify: `src/routes/gmail.js`
- Modify: `src/pages/gmail-settings.js` or existing activity/detail pages
- Create/Modify: `test/gmail-sources-data.test.js`
- Create/Modify: `test/gmail-routes.test.js`

**Interfaces:**
- Produces:
  - `recordGmailActivity(supabase,userId,entry)`
  - `undoGmailActivity(supabase,userId,activityId)`
  - route `POST /me/settings/gmail/activity/:id/undo`

- [ ] **Step 1: Write undo tests**

Extend `test/gmail-sources-data.test.js`:

```js
// recordGmailActivity inserts old_value/new_value/source/fact/rule_version.
// undoGmailActivity reads the activity, restores old value through injected entity updater, and writes a new undo activity with manual_authority=true.
```

Extend route tests:

```js
// POST undo requires authenticated user and calls undoGmailActivity.
```

- [ ] **Step 2: Verify red**

Run:

```bash
node test/gmail-sources-data.test.js
node test/gmail-routes.test.js
```

Expected: FAIL until functions/routes are implemented.

- [ ] **Step 3: Implement activity recording**

Add `recordGmailActivity` to `src/data/gmail-sources.js`:

```js
async function recordGmailActivity(supabase,userId,entry){
  const row={
    user_id:userId,
    source_record_id:entry.sourceRecordId||null,
    fact_id:entry.factId||null,
    entity_type:entry.entityType,
    entity_id:entry.entityId||null,
    field_name:entry.fieldName||null,
    old_value:entry.oldValue??null,
    new_value:entry.newValue??null,
    action:entry.action,
    automatic:entry.automatic!==false,
    manual_authority:entry.manualAuthority===true,
    rule_version:entry.ruleVersion
  };
  const {data,error}=await supabase.from('gmail_activity_entries').insert(row).select('*').single();
  if(error)throw error;
  return data;
}
```

- [ ] **Step 4: Implement undo route and correction behavior**

Undo must:

- restore the old value for the affected entity/field;
- mark that field as manually authoritative using existing manual-edit/provenance mechanism or a small new marker;
- write a `gmail_activity_entries` row with `action='undo'` and `manual_authority=true`;
- not delete source/fact evidence;
- reject undo if the entity no longer exists and record a skipped/rejected activity instead.

- [ ] **Step 5: Verify**

Run:

```bash
node test/gmail-sources-data.test.js
node test/gmail-routes.test.js
npm test
node --check src/data/gmail-sources.js
node --check src/routes/gmail.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/gmail-sources.js src/routes/gmail.js src/pages/gmail-settings.js test/gmail-sources-data.test.js test/gmail-routes.test.js
git commit -m "feat: add gmail activity undo"
```

---

### Task 16: End-to-end UAT hardening and release checks

**Files:**
- Modify: `README.md` or deployment notes if present
- Modify: `.github/workflows/ci.yml` if new tests are not already covered
- Modify: `test/smoke.test.js` if smoke test needs version/string update
- Modify: any files required by test failures

**Interfaces:**
- Produces release-ready `v0.12.0` foundation with no scheduled Gmail automation.

- [ ] **Step 1: Run full checks**

Run:

```bash
npm test
node --check server.js
find src test -name '*.js' -print0 | xargs -0 -n1 node --check
```

Expected: PASS.

- [ ] **Step 2: Verify no forbidden Gmail write behavior exists**

Run:

```bash
grep -R "gmail.modify\|gmail.send\|gmail.compose\|trash\|archive\|markRead\|messages.modify\|messages.trash\|messages.send" -n src test package.json || true
```

Expected: no Gmail write scopes or Gmail write API calls. Incidental words in explanatory UI copy are acceptable only if they clearly state exclusions.

- [ ] **Step 3: Verify no scheduled Gmail automation exists**

Run:

```bash
grep -R "job:gmail\|gmail.*cron\|scheduled.*gmail\|stale.*gmail" -n package.json src test .github || true
```

Expected: no background scheduled Gmail scan script in v0.12. Manual scan/retry routes are allowed.

- [ ] **Step 4: Verify privacy constraints**

Run:

```bash
grep -R "email_body\|raw_body\|attachment_bytes\|pdf_binary\|message_body" -n supabase src test || true
```

Expected: no persisted full email body or PDF binary fields. Temporary in-memory variables are acceptable inside provider/runner code when not written to database.

- [ ] **Step 5: Manual UAT checklist**

Perform against a staging/Railway preview before production deploy:

```text
1. Log in to preston.ai as the owner account.
2. Open /me/settings/gmail.
3. Confirm page states read-only, one account, 12-month lookback, received/archived included, Spam/Trash/Drafts/Sent excluded.
4. Connect Gmail.
5. Confirm no scan starts automatically after OAuth callback.
6. Click Scan Gmail now.
7. Confirm progress/history shows broad counts, not an email mirror.
8. Confirm high-confidence upcoming trips are created or updated.
9. Confirm completed trips are reconstructed quietly.
10. Confirm weak matches/conflicts create Action Needed items.
11. Confirm manual edits are not overwritten by repeat scan.
12. Confirm repeated Scan Gmail now is idempotent.
13. Confirm native-text PDF facts are extracted and source-linked.
14. Confirm unreadable PDFs do not fail the whole scan.
15. Confirm disconnect stops future scans but preserves derived data.
16. Confirm no Gmail labels/archive/delete/mark-read/draft/send actions occur.
```

- [ ] **Step 6: Commit final fixes**

```bash
git add README.md .github/workflows/ci.yml test/smoke.test.js src test supabase package.json package-lock.json
git commit -m "chore: harden gmail foundation release"
```

If no changes are needed after verification, do not create an empty commit.

---

## Self-Review

- Spec coverage: v0.12 connection, explicit first scan, source/evidence storage, trip-first extraction, native-text PDF handling, review, manual-authority protection, scan history, idempotency, privacy, undo, and release checks are covered.
- Scope check: v0.13 broader Life Admin intelligence and v0.14 automation are intentionally excluded except for schema/version decisions needed to avoid repainting the architecture later.
- Placeholder scan: no `TBD`, `TODO`, or undefined future task placeholders are present.
- Type consistency: function names introduced in early tasks are reused consistently by later tasks.
- Risk note: production OAuth details and existing route/auth helper names must be adapted to the actual repo patterns during implementation; route tasks require following existing project-local auth/CSRF conventions rather than inventing replacements.
