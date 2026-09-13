const assert=require('node:assert/strict');
const {getDashboardCalendarWindow,isDashboardCalendarEventEligible,buildDashboardCalendar}=require('../src/domain/calendars');

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

const sources=[
  {id:'personal-google',display_name:'ppodolske@gmail.com',selected:true},
  {id:'personal-home',display_name:'Home',selected:true},
  {id:'holiday-au',display_name:'Holidays in Australia',selected:true},
  {id:'holiday-us',display_name:'US Holidays',selected:true},
  {id:'reminders',display_name:'Reminders',selected:true},
  {id:'ignored',display_name:'Other Calendar',selected:true}
];
const event=(id,source,title,starts_at,status='confirmed',owner_response='accepted')=>({
  id,calendar_source_id:source,title,all_day:false,starts_at,ends_at:new Date(new Date(starts_at).getTime()+3600000).toISOString(),status,owner_response,location:null,external_url:null
});
const dashboard=buildDashboardCalendar({sources,events:[
  event('p2','personal-home','Home item','2026-09-13T02:00:00Z'),
  event('p1','personal-google','Google item','2026-09-13T01:00:00Z'),
  event('h2','holiday-us','US holiday','2026-09-13T04:00:00Z'),
  event('h1','holiday-au','AU holiday','2026-09-13T03:00:00Z'),
  event('r1','reminders','Outstanding reminder','2026-09-13T05:00:00Z'),
  event('r2','reminders','Cancelled reminder','2026-09-13T06:00:00Z','cancelled'),
  event('r3','reminders','Declined reminder','2026-09-13T07:00:00Z','confirmed','declined'),
  event('x1','ignored','Ignored','2026-09-13T08:00:00Z')
],plannedWorkouts:[
  {id:'pw-today',date:'2026-09-13',name:'Workout A',sport:'strength',durationMinutes:45},
  {id:'pw-tomorrow',date:'2026-09-14',name:'Easy Run',sport:'running',durationMinutes:35,distanceKm:5},
  {id:'pw-later',date:'2026-09-20',name:'Long Run',sport:'running'}
],actualActivities:[
  {date:'2026-09-13',name:'Workout A',type:'lift',durationMinutes:47}
],now});
assert.deepEqual(dashboard.personal.map(x=>x.title),['Google item','Home item']);
assert.deepEqual(dashboard.holidays.map(x=>x.title),['AU holiday','US holiday']);
assert.deepEqual(dashboard.reminders.map(x=>x.title),['Outstanding reminder']);
assert.ok(dashboard.personal.every(x=>!Object.hasOwn(x,'sourceName')&&!Object.hasOwn(x,'provider_calendar_id')),'Personal display model must hide source identity');
assert.ok(!dashboard.personal.some(x=>x.title==='Ignored')&&!dashboard.holidays.some(x=>x.title==='Ignored')&&!dashboard.reminders.some(x=>x.title==='Ignored'));
assert.equal(dashboard.plannedWorkouts.length,2,'dashboard only includes today and tomorrow planned workouts');
assert.equal(dashboard.plannedWorkouts[0].day,'today');
assert.equal(dashboard.plannedWorkouts[0].title,'Workout A');
assert.equal(dashboard.plannedWorkouts[0].completed,true,'today plan remains visible after matching actual activity');
assert.equal(dashboard.plannedWorkouts[0].completionKnown,true);
assert.equal(dashboard.plannedWorkouts[1].day,'tomorrow');
assert.equal(dashboard.plannedWorkouts[1].completed,false);
assert.equal(dashboard.plannedWorkouts[1].completionKnown,false);

const ambiguous=buildDashboardCalendar({plannedWorkouts:[{id:'pw-other',date:'2026-09-13',name:'Workout B',sport:'strength'}],actualActivities:[{date:'2026-09-13',name:'Workout A',type:'lift'}],now});
assert.equal(ambiguous.plannedWorkouts[0].completed,false,'some same-day activity must not imply planned workout completion');
assert.equal(ambiguous.plannedWorkouts[0].completionKnown,false,'unmatched completion remains unknown');

console.log('calendar dashboard tests passed');
