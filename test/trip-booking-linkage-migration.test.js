const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const dir=path.join(__dirname,'..','supabase','migrations');
const files=fs.existsSync(dir)?fs.readdirSync(dir):[];
const migrationFile=files.find(name=>name.endsWith('_v0130_trip_booking_event_linkage.sql'));
assert.ok(migrationFile,'v0.13 trip/booking/event linkage migration required');
const sql=fs.readFileSync(path.join(dir,migrationFile),'utf8');

for(const pattern of [
  /alter table public\.bookings alter column trip_id drop not null/i,
  /alter table public\.bookings add column origin text/i,
  /alter table public\.bookings add column destination text/i,
  /booking_type[\s\S]*transport/i,
  /unique\s*\(id,\s*user_id\)/i,
  /segment_id is null or trip_id is not null/i,
  /alter table public\.trips add column destination_label text/i,
  /alter table public\.trips add column destination_city text/i,
  /alter table public\.trips add column destination_region text/i,
  /alter table public\.trips add column destination_country text/i,
  /alter table public\.trips add column automation_managed boolean not null default false/i,
  /alter table public\.life_items add column linked_trip_id uuid/i,
  /alter table public\.life_items add column ends_at timestamptz/i,
  /alter table public\.life_items add column time_zone text/i,
  /alter table public\.life_items add column location text/i,
  /alter table public\.life_items add column provider text/i,
  /alter table public\.life_items add column confirmation_reference text/i,
  /alter table public\.life_items add column booking_url text/i,
  /foreign key \(linked_trip_id, user_id\) references public\.trips\(id, user_id\)/i,
  /alter table public\.gmail_source_records add constraint[\s\S]*unique\s*\(id,\s*user_id\)/i,
  /create table public\.booking_source_links/i,
  /foreign key \(booking_id, user_id\) references public\.bookings\(id, user_id\) on delete cascade/i,
  /foreign key \(source_record_id, user_id\) references public\.gmail_source_records\(id, user_id\) on delete cascade/i,
  /unique\s*\(user_id,\s*booking_id,\s*source_record_id\)/i,
  /create index booking_source_links_user_source_idx/i,
  /create index booking_source_links_user_booking_idx/i,
  /alter table public\.booking_source_links enable row level security/i,
  /to authenticated[\s\S]*using \(\(select auth\.uid\(\)\) = user_id\)/i,
  /revoke all on public\.booking_source_links from anon/i,
  /grant select, insert, update, delete on public\.booking_source_links to authenticated/i
]) assert.match(sql,pattern);

console.log('trip booking linkage migration tests passed');
