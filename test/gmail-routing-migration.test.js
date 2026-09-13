const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const migration=path.join(__dirname,'..','supabase','migrations','20260914000000_v0121_gmail_routing_counts.sql');
assert.equal(fs.existsSync(migration),true,'gmail routing counter migration must exist');
const sql=fs.readFileSync(migration,'utf8');
assert.match(sql,/alter table public\.gmail_scan_runs/i);
assert.match(sql,/add column if not exists trip_count integer not null default 0/i);
assert.match(sql,/add column if not exists life_admin_count integer not null default 0/i);
console.log('gmail routing counter migration contract passed');
