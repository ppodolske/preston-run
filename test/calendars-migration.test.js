const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const dir=path.join(__dirname,'..','supabase','migrations');
const files=fs.existsSync(dir)?fs.readdirSync(dir):[];
const schemaFile=files.find(x=>x==='20260913050000_v0100_calendars.sql');
assert.ok(schemaFile,'v0.10 calendar schema migration required');
const schema=fs.readFileSync(path.join(dir,schemaFile),'utf8');

for(const table of ['calendar_connections','calendar_sources','calendar_events']){
  assert.match(schema,new RegExp(`create table public\\.${table}`,'i'));
  assert.match(schema,new RegExp(`alter table public\\.${table} enable row level security`,'i'));
  assert.match(schema,new RegExp(`create policy ${table}_select`,'i'));
  assert.match(schema,new RegExp(`create policy ${table}_insert`,'i'));
  assert.match(schema,new RegExp(`create policy ${table}_update`,'i'));
  assert.match(schema,new RegExp(`create policy ${table}_delete`,'i'));
}

assert.match(schema,/provider\s+text\s+not null\s+check\s*\(provider in \('google','apple'\)\)/i);
assert.match(schema,/unique\s*\(user_id,\s*provider\)/i);
assert.match(schema,/selected\s+boolean\s+not null\s+default false/i);
assert.match(schema,/unique\s*\(user_id,\s*connection_id,\s*provider_calendar_id\)/i);
assert.match(schema,/unique\s*\(user_id,\s*calendar_source_id,\s*occurrence_key\)/i);
assert.match(schema,/foreign key\s*\(connection_id,\s*user_id\)\s+references public\.calendar_connections\s*\(id,\s*user_id\)/i);
assert.match(schema,/foreign key\s*\(calendar_source_id,\s*user_id\)\s+references public\.calendar_sources\s*\(id,\s*user_id\)/i);
assert.match(schema,/all_day.*start_date.*end_date/is);
assert.match(schema,/not all_day.*starts_at.*ends_at/is);
assert.match(schema,/using \(\(select auth\.uid\(\)\) = user_id\)/i);
assert.match(schema,/with check \(\(select auth\.uid\(\)\) = user_id\)/i);

const restrictFile=files.find(x=>x==='20260913050100_v0100_restrict_calendar_privileges.sql');
assert.ok(restrictFile,'v0.10 calendar privilege migration required');
const grants=fs.readFileSync(path.join(dir,restrictFile),'utf8');
assert.match(grants,/revoke all .* from anon/i);
assert.match(grants,/revoke all .* from authenticated/i);
assert.match(grants,/grant select, insert, update, delete .* to authenticated/i);
for(const table of ['calendar_connections','calendar_sources','calendar_events'])assert.match(grants,new RegExp(table,'i'));

console.log('Calendar migration tests passed');
