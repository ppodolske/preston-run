const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const migration=path.join(__dirname,'..','supabase','migrations','20260913101500_v0110_fitness_context_digest.sql');
const sql=fs.readFileSync(migration,'utf8');

assert.match(sql,/create table if not exists public\.fitness_context_cache/i);
assert.match(sql,/create table if not exists public\.morning_digests/i);
assert.match(sql,/payload jsonb not null/i);
assert.match(sql,/unique\s*\(user_id,\s*digest_date\)/i);
assert.match(sql,/alter table public\.fitness_context_cache enable row level security/i);
assert.match(sql,/alter table public\.morning_digests enable row level security/i);
assert.match(sql,/fitness_context_cache_select[\s\S]*auth\.uid\(\)[\s\S]*user_id/i);
assert.match(sql,/morning_digests_select[\s\S]*auth\.uid\(\)[\s\S]*user_id/i);
assert.match(sql,/revoke all on table public\.fitness_context_cache, public\.morning_digests from anon/i);
assert.match(sql,/grant select, insert, update, delete on table public\.fitness_context_cache, public\.morning_digests to authenticated/i);

console.log('fitness context migration tests passed');
