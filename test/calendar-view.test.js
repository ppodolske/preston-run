const assert=require('node:assert/strict');
const {getCalendarMonthWindow,buildCalendarMonth}=require('../src/domain/calendars');

const window=getCalendarMonthWindow('2026-09',new Date('2026-09-12T22:00:00Z'));
assert.equal(window.monthKey,'2026-09');
assert.equal(window.firstDate,'2026-09-01');
assert.equal(window.lastDate,'2026-09-30');
assert.equal(window.previousMonth,'2026-08');
assert.equal(window.nextMonth,'2026-10');
assert.equal(window.currentMonth,'2026-09');
assert.match(window.start,/2026-08-31T14:00:00\.000Z/,'Sydney month starts at local midnight');
assert.match(window.end,/2026-09-30T13:59:59\.999Z/,'Sydney month ends at local 23:59:59.999');
assert.throws(()=>getCalendarMonthWindow('2026-13'),/Invalid calendar month/);
assert.throws(()=>getCalendarMonthWindow('not-a-month'),/Invalid calendar month/);

const sources=[
  {id:'personal',display_name:'Home',color:'#123456',selected:true,provider_calendar_id:'secret-home'},
  {id:'holidays',display_name:'Australian Holidays',color:'#abcdef',selected:true,provider_calendar_id:'secret-holidays'},
  {id:'off',display_name:'Disabled',color:'#000000',selected:false,provider_calendar_id:'secret-off'}
];
const events=[
  {id:'timed',calendar_source_id:'personal',title:'Dinner',all_day:false,starts_at:'2026-09-15T08:00:00Z',ends_at:'2026-09-15T09:00:00Z',status:'confirmed',owner_response:'accepted',external_url:'https://calendar.example/timed',location:'Sydney'},
  {id:'all-day',calendar_source_id:'holidays',title:'Holiday',all_day:true,start_date:'2026-09-20',end_date:'2026-09-21',status:'confirmed',owner_response:'unknown'},
  {id:'span-start',calendar_source_id:'personal',title:'Month opening trip',all_day:true,start_date:'2026-08-30',end_date:'2026-09-03',status:'confirmed',owner_response:'accepted'},
  {id:'span-end',calendar_source_id:'personal',title:'Month closing trip',all_day:true,start_date:'2026-09-29',end_date:'2026-10-03',status:'confirmed',owner_response:'accepted'},
  {id:'cancelled',calendar_source_id:'personal',title:'Cancelled',all_day:true,start_date:'2026-09-10',end_date:'2026-09-11',status:'cancelled',owner_response:'accepted'},
  {id:'declined',calendar_source_id:'personal',title:'Declined',all_day:false,starts_at:'2026-09-11T00:00:00Z',ends_at:'2026-09-11T01:00:00Z',status:'confirmed',owner_response:'declined'},
  {id:'off-event',calendar_source_id:'off',title:'Hidden source',all_day:true,start_date:'2026-09-12',end_date:'2026-09-13',status:'confirmed',owner_response:'accepted'}
];

const month=buildCalendarMonth({events,sources,monthKey:'2026-09',now:new Date('2026-09-12T22:00:00Z')});
assert.equal(month.monthKey,'2026-09');
assert.equal(month.days['2026-09-15'].some(x=>x.id==='timed'),true,'timed event appears on Sydney-local start date');
assert.equal(month.days['2026-09-20'].some(x=>x.id==='all-day'),true,'all-day event appears');
assert.deepEqual(['2026-09-01','2026-09-02'].map(k=>month.days[k].some(x=>x.id==='span-start')),[true,true],'event spanning month start projects onto visible days');
assert.deepEqual(['2026-09-29','2026-09-30'].map(k=>month.days[k].some(x=>x.id==='span-end')),[true,true],'event spanning month end projects onto visible days');
const allItems=Object.values(month.days).flat();
assert.equal(allItems.some(x=>x.id==='cancelled'),false);
assert.equal(allItems.some(x=>x.id==='declined'),false);
assert.equal(allItems.some(x=>x.id==='off-event'),false);
const timed=allItems.find(x=>x.id==='timed');
assert.equal(timed.sourceName,'Home');
assert.equal(timed.sourceColor,'#123456');
assert.equal(timed.externalUrl,'https://calendar.example/timed');
assert.equal(timed.location,'Sydney');
assert.equal(Object.prototype.hasOwnProperty.call(timed,'provider_calendar_id'),false);
assert.equal(Object.prototype.hasOwnProperty.call(timed,'providerCalendarId'),false);

console.log('calendar view tests passed');
