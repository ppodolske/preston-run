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
  needsAttention:[{type:'task',record:{id:'t1',title:'Pay renewal fee',priority:'urgent'},overdue:true}],
  upcomingTrips:[{id:'trip1',title:'Chicago & Milwaukee',status:'upcoming',start_date:'2026-10-01',end_date:'2026-10-10'}]
});
for (const expected of ['preston.ai','/assets/preston-ai-logo.png','Good morning','Dose & Scale','State Parks','Archive','Website admin','id="condition"','/auth/logout','Log out','v0.10.0','Coming Up','Birthdays','Life Admin','Trips','Chicago &amp; Milwaukee','/trips/trip1','/trips','Needs Attention','Licence renewal','Pay renewal fee','Urgent','/life-admin/l1','/tasks/t1/edit','Notifications','/notifications','Calendars','/settings/calendars']) assert.ok(home.includes(expected),`home missing ${expected}`);
assert.ok(!home.includes('owner@example.com'),'home should not expose owner email');
const unavailable=renderHomePage({user:{},birthdayDataUnavailable:true,lifeAdminDataUnavailable:true,tripDataUnavailable:true});assert.ok(unavailable.includes('Birthday data is temporarily unavailable.'));assert.ok(unavailable.includes('Life Admin data is temporarily unavailable.'));assert.ok(unavailable.includes('Trip data is temporarily unavailable.'));
console.log('page tests passed');
