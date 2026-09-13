const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.join(__dirname,'..','supabase','migrations');
const files=fs.existsSync(dir)?fs.readdirSync(dir):[];
const schemaFile=files.find(x=>x.endsWith('_v090_reminders_push.sql'));
assert.ok(schemaFile,'v0.9 reminders/push migration required');
const schema=fs.readFileSync(path.join(dir,schemaFile),'utf8');
for (const table of ['reminder_settings','reminder_overrides','reminders','push_subscriptions','notification_deliveries']) {
  assert.match(schema,new RegExp(`create table public\\.${table}`,'i'));
  assert.match(schema,new RegExp(`alter table public\\.${table} enable row level security`,'i'));
}
assert.match(schema,/unique\s*\(user_id,\s*occurrence_key\)/i);
assert.match(schema,/references public\.reminders\s*\(id,\s*user_id\)/i);
assert.match(schema,/references public\.push_subscriptions\s*\(id,\s*user_id\)/i);
assert.match(schema,/using \(\(select auth\.uid\(\)\) = user_id\)/i);
assert.match(schema,/with check \(\(select auth\.uid\(\)\) = user_id\)/i);
const restrictFile=files.find(x=>x.endsWith('_v090_restrict_reminder_privileges.sql'));
assert.ok(restrictFile,'v0.9 reminder privilege migration required');
const grants=fs.readFileSync(path.join(dir,restrictFile),'utf8');
assert.match(grants,/revoke all .* from anon/i);
assert.match(grants,/revoke all .* from authenticated/i);
assert.match(grants,/grant select, insert, update, delete .* to authenticated/i);
console.log('Reminder migration tests passed');
