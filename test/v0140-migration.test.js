const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.join(__dirname,'..','supabase','migrations');
const file=fs.readdirSync(dir).find(x=>x.endsWith('_v0140_travel_intelligence_archive.sql'));
assert.ok(file,'v0.14 migration required');
const sql=fs.readFileSync(path.join(dir,file),'utf8');
for(const pattern of [
  /alter table public\.trips add column archived_at timestamptz/i,
  /create table public\.booking_legs/i,
  /booking_id uuid not null/i,
  /position integer not null[^;]*check \(position > 0\)/i,
  /service_number text/i,
  /departure_time_zone text/i,
  /arrival_time_zone text/i,
  /source_metadata jsonb not null default '\{\}'::jsonb/i,
  /foreign key \(booking_id, user_id\) references public\.bookings\(id, user_id\) on delete cascade/i,
  /unique \(booking_id, position\)/i,
  /create index booking_legs_booking_owner_idx on public\.booking_legs \(booking_id, user_id\)/i,
  /create index trips_user_archived_end_idx on public\.trips \(user_id, archived_at, end_date\)/i,
  /alter table public\.booking_legs enable row level security/i,
  /create policy booking_legs_select_owner/i,
  /grant select, insert, update, delete on public\.booking_legs to authenticated/i
]) assert.match(sql,pattern);
console.log('v0.14 migration tests passed');
