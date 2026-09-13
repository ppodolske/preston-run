const assert=require('node:assert/strict');
const {renderHome}=require('../src/pages/home');
const {renderLogin}=require('../src/pages/login');

const home=renderHome({
  greeting:'Good morning',
  weather:{condition:'Sunny',temperature:'22°',summary:'Clear and mild.'},
  calendar:[{title:'Personal',time:'9:00 am',location:'Sydney',provider:'google',calendarName:'Personal'},{title:'Holidays',time:'All day',provider:'apple',calendarName:'Holidays'}],
  reminders:[{title:'Completed',status:'completed',due:'Today'},{title:'Overdue',status:'overdue',due:'Yesterday'}],
  plannedWorkouts:[{date:'Today',name:'Workout B'},{date:'Tomorrow',name:'Easy Run'}],
  birthdays:[{name:'Taylor',when:'Today'}],
  lifeAdmin:[{id:'l1',title:'Licence renewal',status:'needs_action',priority:'urgent',due_at:'2026-09-13T00:00:00Z'}],
  tasks:[{id:'t1',title:'Pay renewal fee',status:'open',priority:'high',due_at:'2026-09-13T00:00:00Z'},{id:'t2',title:'Call insurer',status:'open',priority:'urgent'}],
  digest:{
    generatedAt:'2026-09-13T21:00:00Z',
    narratives:['Recovery is meaningfully suppressed this morning.'],
    insights:[
      {type:'sleep_duration',label:'Sleep',value:'7h 28m',detail:'Last night',state:'good'},
      {type:'sleep_score',label:'Sleep score',value:'82',detail:'Garmin',state:'good'},
      {type:'rhr_delta',label:'RHR',value:'54 bpm',detail:'+4 vs 28d',state:'warning'},
      {type:'hrv_delta',label:'HRV',value:'41 ms',detail:'-11% vs 28d',state:'warning'},
      {type:'training_today',label:'Training',value:'Workout B',detail:'Planned today',state:'neutral'},
      {type:'weight_trend',label:'Weight trend',value:'-0.7 kg',detail:'28d trend',state:'good'},
      {type:'training_7d',label:'Training 7d',value:'4 sessions',detail:'42.3 km',state:'neutral'}
    ],
    provenance:[
      'Digest generated from current preston.ai context.',
      'Narrative wording may change without changing insight cards.'
    ]
  },
  fitnessContext:{fetched_at:'2026-09-13T21:15:00Z'},
  upcomingTrips:[{id:'trip1',title:'Chicago & Milwaukee',status:'upcoming',start_date:'2026-10-01',end_date:'2026-10-10'}]
});
for (const expected of ['preston.ai','/assets/preston-ai-logo.png','Good morning','Dose &amp; Scale','State Parks','Archive','Website admin','id="condition"','/auth/logout','Log out','v0.12.1','Weather','Calendar','Personal','Holidays','Reminders','Planned Workouts','Workout B','Easy Run','Completed','Overdue','Today','Birthdays','Life Admin','Trips','Chicago &amp; Milwaukee','/trips/trip1','/trips','Licence renewal','Pay renewal fee','Call insurer','Urgent','/life-admin/l1','/tasks/t1/edit','Notifications','/notifications','/settings/calendars','/me/settings/gmail','View calendar','href="/calendar"','app-launcher','Morning Digest','Recovery is meaningfully suppressed this morning.','digest-grid','Recovery','Training','Weight trend','Context','Refresh digest','admin-grid','admin-card','preston.run','dose.preston.run','parks.preston.run','archive.preston.run','https://parks.preston.run/park-favicon.svg','https://archive.preston.run/icon.svg']) assert.ok(home.includes(expected),`home missing ${expected}`);
assert.match(home,/<details class="settings-menu"/);
assert.match(home,/<summary[^>]*>☰ Settings<\/summary>/);
assert.doesNotMatch(home,/<a class="button" href="\/notifications">Notifications<\/a>/);
assert.doesNotMatch(home,/<a class="button" href="\/settings\/calendars">Calendars<\/a>/);
assert.doesNotMatch(home,/<a class="button" href="\/me\/settings\/gmail">Gmail<\/a>/);
assert.match(home,/<a class="skip-link" href="#main-content">Skip to content<\/a>/);
assert.match(home,/<main id="main-content">/);

const login=renderLogin({error:'Nope'});
for(const expected of ['preston.ai','/assets/preston-ai-logo.png','Sign in with Google','Nope','v0.12.1'])assert.ok(login.includes(expected),`login missing ${expected}`);
assert.match(login,/<a class="skip-link" href="#main-content">Skip to content<\/a>/);
assert.match(login,/<main id="main-content">/);
console.log('page render tests passed');
