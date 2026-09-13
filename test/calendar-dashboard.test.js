const assert=require('node:assert/strict');
const {getDashboardCalendarWindow,isDashboardCalendarEventEligible}=require('../src/domain/calendars');

const now=new Date('2026-09-12T22:00:00Z'); // 08:00 Sep 13 Sydney
const window=getDashboardCalendarWindow(now);
assert.equal(window.today,'2026-09-13');
assert.equal(window.tomorrow,'2026-09-14');

const base={status:'confirmed',owner_response:'accepted',all_day:false};
assert.equal(isDashboardCalendarEventEligible({...base,starts_at:'2026-09-13T10:00:00Z',ends_at:'2026-09-13T11:00:00Z'},window),true);
assert.equal(isDashboardCalendarEventEligible({...base,starts_at:'2026-09-13T22:59:00Z',ends_at:'2026-09-13T23:30:00Z'},window),true); // 08:59 tomorrow
assert.equal(isDashboardCalendarEventEligible({...base,starts_at:'2026-09-13T23:00:00Z',ends_at:'2026-09-13T23:30:00Z'},window),true); // 09:00 tomorrow
assert.equal(isDashboardCalendarEventEligible({...base,starts_at:'2026-09-13T23:01:00Z',ends_at:'2026-09-14T00:00:00Z'},window),false);
assert.equal(isDashboardCalendarEventEligible({status:'confirmed',owner_response:'unknown',all_day:true,start_date:'2026-09-14',end_date:'2026-09-15'},window),true);
assert.equal(isDashboardCalendarEventEligible({...base,starts_at:'2026-09-12T23:00:00Z',ends_at:'2026-09-13T01:00:00Z'},window),true);

console.log('calendar dashboard tests passed');
