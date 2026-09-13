const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const migration=path.join(__dirname,'..','supabase','migrations','20260914001000_v0122_gmail_life_admin_idempotency.sql');
assert.equal(fs.existsSync(migration),true,'Gmail Life Admin idempotency migration must exist');
const sql=fs.readFileSync(migration,'utf8');
assert.match(sql,/create unique index if not exists life_items_gmail_thread_unique_idx/i);
assert.match(sql,/source_metadata->>'gmail_thread_id'/i);
assert.match(sql,/create unique index if not exists life_items_gmail_source_unique_idx/i);
assert.match(sql,/source_metadata->>'source_record_id'/i);
assert.match(sql,/source_metadata->>'source'\s*=\s*'gmail'/i);
console.log('gmail Life Admin idempotency migration contract passed');
