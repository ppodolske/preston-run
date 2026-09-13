const assert = require('node:assert/strict');
const { renderLoginPage } = require('../src/pages/login');
const { renderHomePage } = require('../src/pages/home');
const login = renderLoginPage();
for (const expected of ['preston.ai','/assets/preston-ai-logo.png','/auth/google','/manifest.webmanifest','/icons/favicon-32.png']) assert.ok(login.includes(expected),`login missing ${expected}`);
for (const forbidden of ['Dose & Scale','State Parks','Archive','Website admin','Railway','id="condition"','birthday','Life Admin','Coming Up','Needs Attention','Manage people','Trips','/trips','Notifications','Reminder','Device label','Enable notifications on this device','/notifications','subscription','Calendars','/settings/calendars','Google Calendar','Apple / iCloud Calendar','VAPID_PRIVATE_KEY','SUPABASE_SERVICE_ROLE_KEY']) assert.ok(!login.includes(forbidden), `login leaked ${forbidden}`);
const home = renderHomePage({
  user:{email:'owner@example.com',user_metadata:{full_name:'Preston Example'}},
  upcomingBirthdays:[{person:{name:'Alex',birth_year:null},daysAway:4,ageTurning:null}],
  upcomingLifeItems:[{item:{id:'l1',title:'Licence renewal',category:'renewal'},date:new Date('2026-10-01T00:00:00Z'),daysAway:18}],
  overdueItems:[{type:'task',record:{id:'t1',title:'Pay renewal fee',priority:'urgent',due_at:'2026-09-12T00:00:00Z'},overdue:true}],
  todayItems:[{type:'life_item',record:{id:'l2',title:'Call insurer',priority:'high',category:'appointment',due_at:'2026-09-13T00:00:00Z'},overdue:false}],
  calendar:{personal:[{id:'e1',title:'Breakfast',allDay:false,startsAt:'2026-09-13T21:00:00Z',endsAt:'2026-09-13T22:00:00Z',day:'today'}],holidays:[{id:'e2',title:'Public Holiday',allDay:true,startDate:'2026-09-13',endDate:'2026-09-14',day:'today'}],reminders:[{id:'e3',title:'Pack bag',allDay:true,startDate:'2026-09-14',endDate:'2026-09-15',day:'tomorrow'}]},
  upcomingTrips:[{id:'trip1',title:'Chicago & Milwaukee',status:'upcoming',start_date:'2026-10-01',end_date:'2026-10-10'}]
});
for (const expected of ['preston.ai','/assets/preston-ai-logo.png','Good morning','Dose & Scale','State Parks','Archive','Website admin','id="condition"','/auth/logout','Log out','Weather','Calendar','Personal','Holidays','Reminders','Overdue','Today','Birthdays','Life Admin','Trips','Chicago &amp; Milwaukee','/trips/trip1','/trips','Licence renewal','Pay renewal fee','Call insurer','Urgent','/life-admin/l1','/tasks/t1/edit','Notifications','/notifications','/settings/calendars','View calendar','href="/calendar"','app-launcher']) assert.ok(home.includes(expected),`home missing ${expected}`);
assert.ok(!home.includes('owner@example.com'),'home should not expose owner email');
assert.ok(!home.includes('ppodolske@gmail.com'),'dashboard must not expose Personal source labels');
assert.ok(!home.includes('>Home<'),'dashboard must not expose Home source label');
const unavailable=renderHomePage({user:{},birthdayDataUnavailable:true,lifeAdminDataUnavailable:true,tripDataUnavailable:true,calendarDataUnavailable:true});
assert.ok(unavailable.includes('Birthday data is temporarily unavailable.'));
assert.ok(unavailable.includes('Life Admin data is temporarily unavailable.'));
assert.ok(unavailable.includes('Trip data is temporarily unavailable.'));
assert.ok(unavailable.includes('Calendar data is temporarily unavailable.'));
console.log('page tests passed');
