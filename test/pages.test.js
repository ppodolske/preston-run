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
  calendar:{
    personal:[{id:'e1',title:'Breakfast',allDay:false,startsAt:'2026-09-13T21:00:00Z',endsAt:'2026-09-13T22:00:00Z',day:'today'}],
    holidays:[{id:'e2',title:'Public Holiday',allDay:true,startDate:'2026-09-13',endDate:'2026-09-14',day:'today'}],
    reminders:[{id:'e3',title:'Pack bag',allDay:true,startDate:'2026-09-14',endDate:'2026-09-15',day:'tomorrow'}],
    plannedWorkouts:[
      {id:'planned-workout:w1',title:'Workout B',day:'today',allDay:true,completed:true,completionKnown:true,sport:'strength'},
      {id:'planned-workout:w2',title:'Easy Run',day:'tomorrow',allDay:true,completed:false,completionKnown:true,sport:'run'}
    ]
  },
  morningDigest:{
    status:'poor',headline:'Recovery is meaningfully suppressed this morning.',generated_at:'2026-09-13T21:15:00Z',garmin_sync_at:'2026-09-13T20:55:00Z',
    cards:[
      {id:'recovery',title:'Recovery',items:[{label:'Sleep',value:'0h 0m'},{label:'Resting HR',value:'54 bpm'}]},
      {id:'training',title:'Training',items:[{label:'Today',value:'No workout planned'},{label:'Last 7 days',value:'8 sessions'}]},
      {id:'weight',title:'Weight trend',items:[{label:'28-day direction',value:'Up'}]},
      {id:'context',title:'Context',items:[{label:'Active phase',value:'Base phase'}]}
    ],
    bullets:[
      'Sleep was very short at 0h 0m.',
      'Sleep score was 29.',
      'Resting HR is 4 bpm above the recent baseline.',
      'No planned workout is scheduled for today.',
      '28-day weight trend is up (+85.1 kg between early and recent averages).',
      'Last 7 days: 8 sessions (4 runs, 4 lifts, 33.4 km running).'
    ]
  },
  fitnessContext:{fetched_at:'2026-09-13T21:15:00Z'},
  upcomingTrips:[{id:'trip1',title:'Chicago & Milwaukee',status:'upcoming',start_date:'2026-10-01',end_date:'2026-10-10'}]
});
for (const expected of ['preston.ai','/assets/preston-ai-logo.png','Good morning','Dose &amp; Scale','State Parks','Archive','Website admin','id="condition"','/auth/logout','Log out','v0.11.0','Weather','Calendar','Personal','Holidays','Reminders','Planned Workouts','Workout B','Easy Run','Completed','Overdue','Today','Birthdays','Life Admin','Trips','Chicago &amp; Milwaukee','/trips/trip1','/trips','Licence renewal','Pay renewal fee','Call insurer','Urgent','/life-admin/l1','/tasks/t1/edit','Notifications','/notifications','/settings/calendars','View calendar','href="/calendar"','app-launcher','Morning Digest','Recovery is meaningfully suppressed this morning.','digest-grid','Recovery','Training','Weight trend','Context','Refresh digest','admin-grid','admin-card','preston.run','dose.preston.run','parks.preston.run','archive.preston.run','https://parks.preston.run/park-favicon.svg','https://archive.preston.run/icon.svg']) assert.ok(home.includes(expected),`home missing ${expected}`);
assert.match(home,/\.morning-digest\{[^}]*width:100%/,'Morning Digest should span available width');
assert.match(home,/@media\(max-width:650px\)[\s\S]*\.card,\.morning-digest,\.admin-card\{width:100%/,'mobile cards should be explicitly full width');
assert.match(home,/\.digest-card h3\{[^}]*font-family:'Instrument Serif'/,'digest card titles should use the D&S serif treatment');
for (const expected of ['digest-insights','digest-insight','digest-insight-label','digest-insight-value','digest-insight-detail','Sleep</span><strong class="digest-insight-value">Very short · 0h 0m','Sleep score</span><strong class="digest-insight-value">29 · Poor','Resting HR</span><strong class="digest-insight-value">+4 bpm vs baseline','Today&#39;s training</span><strong class="digest-insight-value">No workout planned','28-day weight trend</span><strong class="digest-insight-value">Up · +85.1 kg','Last 7 days</span><strong class="digest-insight-value">8 sessions','4 runs · 4 lifts · 33.4 km running']) assert.ok(home.includes(expected),`digest insight missing ${expected}`);
assert.ok(!home.includes('<div class="digest-notes"><p>Sleep was very short at 0h 0m.</p>'),'digest bullets should not render as sentence pills');
assert.ok(!home.includes('owner@example.com'),'home should not expose owner email');
assert.ok(!home.includes('ppodolske@gmail.com'),'dashboard must not expose Personal source labels');
assert.ok(!home.includes('>Home<'),'dashboard must not expose Home source label');
const unavailable=renderHomePage({user:{},birthdayDataUnavailable:true,lifeAdminDataUnavailable:true,tripDataUnavailable:true,calendarDataUnavailable:true,fitnessUnavailable:true});
assert.ok(unavailable.includes('Birthday data is temporarily unavailable.'));
assert.ok(unavailable.includes('Life Admin data is temporarily unavailable.'));
assert.ok(unavailable.includes('Trip data is temporarily unavailable.'));
assert.ok(unavailable.includes('Calendar data is temporarily unavailable.'));
assert.ok(unavailable.includes('Morning Digest is temporarily unavailable.'));
console.log('page tests passed');
