const assert=require('node:assert/strict');
const {
  getCalendarSyncWindow,
  getMorningCalendarWindow,
  shouldRunCalendarSync,
  normalizeCalendarEvent,
  isCalendarEventDigestEligible,
  sortCalendarDigestEvents,
  isConnectionStale
}=require('../src/domain/calendars');

function timed(overrides={}){return normalizeCalendarEvent({provider_event_id:'e1',occurrence_key:'o1',title:'Event',all_day:false,starts_at:'2026-09-13T00:00:00Z',ends_at:'2026-09-13T01:00:00Z',status:'confirmed',owner_response:'accepted',...overrides});}
function allDay(overrides={}){return normalizeCalendarEvent({provider_event_id:'e2',occurrence_key:'o2',title:'All day',all_day:true,start_date:'2026-09-13',end_date:'2026-09-14',status:'confirmed',owner_response:'accepted',...overrides});}

// 06:55 Sydney gate: AEST and AEDT active slots, adjacent DST twin inactive, Railway startup delay tolerated.
assert.equal(shouldRunCalendarSync(new Date('2026-07-01T20:55:00Z')),true); // 06:55 AEST
assert.equal(shouldRunCalendarSync(new Date('2026-07-01T21:04:00Z')),true,'calendar sync should tolerate a short Railway startup delay');
assert.equal(shouldRunCalendarSync(new Date('2026-07-01T21:10:00Z')),false,'calendar grace window must stay bounded');
assert.equal(shouldRunCalendarSync(new Date('2026-07-01T19:55:00Z')),false);
assert.equal(shouldRunCalendarSync(new Date('2026-01-01T19:55:00Z')),true); // 06:55 AEDT
assert.equal(shouldRunCalendarSync(new Date('2026-01-01T20:04:00Z')),true);
assert.equal(shouldRunCalendarSync(new Date('2026-01-01T20:55:00Z')),false);

// Sync retention window is anchored to Sydney local calendar date.
const sync=getCalendarSyncWindow(new Date('2026-09-12T22:00:00Z')); // 13 Sep Sydney
assert.equal(sync.startDate,'2026-08-14');
assert.equal(sync.endDate,'2027-09-13');
assert.ok(new Date(sync.start).getTime()<new Date(sync.end).getTime());

const w=getMorningCalendarWindow(new Date('2026-09-12T21:15:00Z')); // 13 Sep 07:15 Sydney
assert.equal(w.today,'2026-09-13');
assert.equal(w.tomorrow,'2026-09-14');
assert.equal(new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(w.timedCutoff)),'09:00');

// Timed overlap: ongoing from yesterday, exact 09:00 tomorrow, and cutoff exclusion.
assert.equal(isCalendarEventDigestEligible(timed({starts_at:'2026-09-12T12:00:00Z',ends_at:'2026-09-12T15:00:00Z'}),w),true,'overnight event still active after Sydney midnight');
assert.equal(isCalendarEventDigestEligible(timed({starts_at:'2026-09-13T23:00:00Z',ends_at:'2026-09-14T00:00:00Z'}),w),true,'09:00 Sydney start is included');
assert.equal(isCalendarEventDigestEligible(timed({starts_at:'2026-09-13T23:00:01Z',ends_at:'2026-09-14T00:00:01Z'}),w),false,'after 09:00 Sydney is excluded');
assert.equal(isCalendarEventDigestEligible(timed({starts_at:'2026-09-11T12:00:00Z',ends_at:'2026-09-12T13:59:59Z'}),w),false,'event ended before Sydney day start');

// All-day date semantics are provider-exclusive on end_date and include today/tomorrow overlap.
assert.equal(isCalendarEventDigestEligible(allDay({start_date:'2026-09-13',end_date:'2026-09-14'}),w),true);
assert.equal(isCalendarEventDigestEligible(allDay({start_date:'2026-09-14',end_date:'2026-09-15'}),w),true);
assert.equal(isCalendarEventDigestEligible(allDay({start_date:'2026-09-12',end_date:'2026-09-15'}),w),true,'multi-day event spanning both dates included');
assert.equal(isCalendarEventDigestEligible(allDay({start_date:'2026-09-12',end_date:'2026-09-13'}),w),false,'exclusive end before today');
assert.equal(isCalendarEventDigestEligible(allDay({start_date:'2026-09-15',end_date:'2026-09-16'}),w),false);

assert.equal(isCalendarEventDigestEligible(timed({status:'cancelled'}),w),false);
assert.equal(isCalendarEventDigestEligible(timed({owner_response:'declined'}),w),false);
assert.equal(isCalendarEventDigestEligible(timed({status:'tentative',owner_response:'tentative'}),w),true);

// Non-Sydney timestamps are compared by instant, not display timezone.
assert.equal(isCalendarEventDigestEligible(timed({starts_at:'2026-09-13T08:00:00-05:00',ends_at:'2026-09-13T09:00:00-05:00',time_zone:'America/Chicago'}),w),true);

const sorted=sortCalendarDigestEvents([
  timed({provider_event_id:'t2',occurrence_key:'t2',title:'Tomorrow timed',starts_at:'2026-09-13T22:00:00Z',ends_at:'2026-09-13T22:30:00Z'}),
  allDay({provider_event_id:'a2',occurrence_key:'a2',title:'Tomorrow all day',start_date:'2026-09-14',end_date:'2026-09-15'}),
  timed({provider_event_id:'t1',occurrence_key:'t1',title:'Today timed',starts_at:'2026-09-13T01:00:00Z',ends_at:'2026-09-13T02:00:00Z'}),
  allDay({provider_event_id:'a1',occurrence_key:'a1',title:'Today all day',start_date:'2026-09-13',end_date:'2026-09-14'})
],w);
assert.deepEqual(sorted.map(x=>x.title),['Today all day','Today timed','Tomorrow all day','Tomorrow timed']);

const exactly24=new Date('2026-09-13T07:05:00Z');
assert.equal(isConnectionStale({last_success_at:'2026-09-12T07:05:00Z'},exactly24),false,'exactly 24h is not stale');
assert.equal(isConnectionStale({last_success_at:'2026-09-12T07:04:59Z'},exactly24),true);
assert.equal(isConnectionStale({last_success_at:null},exactly24),true);

assert.throws(()=>normalizeCalendarEvent({title:'Bad'}),/event/i);
assert.throws(()=>normalizeCalendarEvent({provider_event_id:'x',occurrence_key:'x',title:'Bad',all_day:true,start_date:'2026-09-14',end_date:'2026-09-14'}),/date/i);
assert.throws(()=>normalizeCalendarEvent({provider_event_id:'x',occurrence_key:'x',title:'Bad',all_day:false,starts_at:'2026-09-13T02:00:00Z',ends_at:'2026-09-13T01:00:00Z'}),/time/i);

console.log('calendar domain tests passed');
