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
