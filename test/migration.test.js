const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..', 'supabase', 'migrations');
const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
const file = files.find(name => name.endsWith('_v060_people_birthdays.sql'));
assert.ok(file, 'v0.6.0 people/birthdays migration file is required');
const sql = fs.readFileSync(path.join(dir, file), 'utf8');
assert.match(sql, /create table public\.profiles/i);
assert.match(sql, /create table public\.people/i);
assert.match(sql, /birth_year smallint/i);
assert.match(sql, /alter table public\.profiles enable row level security/i);
assert.match(sql, /alter table public\.people enable row level security/i);
assert.match(sql, /using \(\(select auth\.uid\(\)\) = user_id\)/i);
assert.match(sql, /with check \(\(select auth\.uid\(\)\) = user_id\)/i);
assert.match(sql, /birthday_month between 1 and 12/i);
assert.match(sql, /birthday_day between 1 and 31/i);
console.log('migration tests passed');
