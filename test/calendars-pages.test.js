const assert=require('node:assert/strict');
let renderCalendarsPage;
try{({renderCalendarsPage}=require('../src/pages/calendars'));}catch(error){assert.fail(`Calendars page module required: ${error.message}`);}

const google={id:'g1',provider:'google',account_label:'personal@example.com',status:'connected',last_success_at:'2026-09-13T00:00:00Z',last_error:null};
const apple={id:'a1',provider:'apple',account_label:'icloud@example.com',status:'attention',last_success_at:null,last_error:'Calendar connection needs attention.'};
const sources=[
 {id:'s1',connection_id:'g1',provider_calendar_id:'primary',display_name:'Personal',selected:true,read_only:true},
 {id:'s2',connection_id:'g1',provider_calendar_id:'family',display_name:'Family',selected:false,read_only:true},
 {id:'s3',connection_id:'a1',provider_calendar_id:'/cal/1',display_name:'Home',selected:false,read_only:true}
];
const html=renderCalendarsPage({connections:[google,apple],sources,flash:'Calendars synced.'});
assert.match(html,/href="\/preston\.css"/);
assert.match(html,/class="site-header"/);
assert.match(html,/Calendars/);
assert.match(html,/personal@example\.com/);
assert.match(html,/icloud@example\.com/);
assert.match(html,/Personal/);
assert.match(html,/Family/);
assert.match(html,/Home/);
assert.match(html,/Sync calendars/);
assert.match(html,/Disconnect Google/);
assert.match(html,/Disconnect Apple/);
assert.match(html,/app-specific password/i);
assert.match(html,/name="selected" value="true"/);
assert.match(html,/name="selected" value="false"/);
assert.match(html,/preston\.ai may use in the morning summary/);
assert.match(html,/<label for="apple-email">Apple ID email<\/label>/);
assert.match(html,/<label for="apple-app-specific-password">App-specific password<\/label>/);
assert.doesNotMatch(html,/\bPreston\b/,'product references should use preston.ai');
assert.doesNotMatch(html,/credential_ciphertext|refresh-token|access-token|app-password-secret/i);

const disconnected=renderCalendarsPage({connections:[],sources:[]});
assert.match(disconnected,/Connect Google Calendar/);
assert.match(disconnected,/Connect Apple Calendar/);
assert.match(disconnected,/Apple ID email/);
assert.match(disconnected,/preston\.ai sign-in/);
assert.match(disconnected,/preston\.ai never needs your normal Apple Account password/);
assert.doesNotMatch(disconnected,/\bPreston\b/,'product references should use preston.ai');
assert.doesNotMatch(disconnected,/value="[^\"]*password/i);
console.log('calendar settings page tests passed');
