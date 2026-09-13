const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..', 'supabase', 'migrations');
const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
const schemaFile = files.find(name => name.endsWith('_v070_life_admin_tasks.sql'));
assert.ok(schemaFile, 'v0.7.0 Life Admin/tasks migration is required');
const sql = fs.readFileSync(path.join(dir, schemaFile), 'utf8');

for (const pattern of [
  /create table public\.life_items/i,
  /create table public\.tasks/i,
  /alter table public\.life_items enable row level security/i,
  /alter table public\.tasks enable row level security/i,
  /category in \('renewal','deadline','bill','appointment','government','property','subscription','membership','event','other'\)/i,
  /status in \('upcoming','needs_action','waiting','completed','ignored'\)/i,
  /status in \('open','in_progress','waiting','completed','ignored'\)/i,
  /priority in \('low','normal','high','urgent'\)/i,
  /foreign key \(linked_person_id, user_id\) references public\.people\(id, user_id\)/i,
  /foreign key \(linked_life_item_id, user_id\) references public\.life_items\(id, user_id\)/i,
  /using \(\(select auth\.uid\(\)\) = user_id\)/i,
  /with check \(\(select auth\.uid\(\)\) = user_id\)/i
]) assert.match(sql, pattern);
assert.doesNotMatch(sql, /linked_trip_id/i);

const restrictFile = files.find(name => name.endsWith('_v070_restrict_life_admin_privileges.sql'));
assert.ok(restrictFile, 'v0.7.0 Life Admin privilege restriction migration is required');
const restrict = fs.readFileSync(path.join(dir, restrictFile), 'utf8');
assert.match(restrict, /revoke all on public\.life_items, public\.tasks from anon/i);
assert.match(restrict, /revoke all on public\.life_items, public\.tasks from authenticated/i);
assert.match(restrict, /grant select, insert, update, delete on public\.life_items, public\.tasks to authenticated/i);
console.log('Life Admin migration tests passed');
