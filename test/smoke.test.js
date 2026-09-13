const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const pkg=require('../package.json');
const {PRODUCT_NAME,VERSION,APPS}=require('../src/branding');
const {renderLoginPage}=require('../src/pages/login');
const {renderHomePage}=require('../src/pages/home');
assert.equal(pkg.version,'0.11.0');assert.equal(VERSION,'0.11.0');assert.equal(PRODUCT_NAME,'preston.ai');
for(const name of ['Dose & Scale','State Parks','Archive']) assert.ok(APPS.some(a=>a.name===name));
for(const app of APPS){assert.ok(app.icon,`${app.name} missing launcher icon`);assert.match(app.icon,/^https:\/\//);}
assert.equal(APPS.find(a=>a.name==='State Parks').url,'https://parks.preston.run');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../public/manifest.webmanifest'),'utf8'));assert.equal(manifest.name,'preston.ai');
const login=renderLoginPage();for(const forbidden of ['railway.com','class="dashboard"','class="calendar-card"','class="overdue-card"','class="today-card"','class="apps-card"','/notifications','/calendar','/settings/calendars','Google Calendar','Apple / iCloud Calendar','GOOGLE_CALENDAR_CLIENT_ID','GOOGLE_CALENDAR_CLIENT_SECRET','CALENDAR_CREDENTIAL_KEY','credential_ciphertext','app_specific_password','VAPID_PRIVATE_KEY','SUPABASE_SERVICE_ROLE_KEY'])assert.ok(!login.includes(forbidden),`login leaked ${forbidden}`);
const home=renderHomePage({user:{},upcomingBirthdays:[],upcomingLifeItems:[],overdueItems:[],todayItems:[],calendar:{personal:[],holidays:[],reminders:[]},upcomingTrips:[]});for(const expected of ['id="condition"','Weather','Calendar','Personal','Holidays','Reminders','Overdue','Today','Birthdays','Life Admin','Trips','/people','/life-admin','/trips','/calendar','/settings/calendars','app-launcher','Log out','v0.11.0'])assert.ok(home.includes(expected),`home missing ${expected}`);
for(const forbidden of ['credential_ciphertext','app_specific_password','GOOGLE_CALENDAR_CLIENT_SECRET','CALENDAR_CREDENTIAL_KEY','ppodolske@gmail.com'])assert.ok(!home.includes(forbidden),`home leaked ${forbidden}`);
for(const file of ['src/routes/people.js','src/routes/life-admin.js','src/routes/trips.js','src/routes/notifications.js','src/routes/calendars.js','src/pages/calendars.js','src/pages/calendar-view.js','src/data/reminders.js','src/data/calendars.js','src/domain/calendars.js','src/services/reminder-engine.js','src/services/calendar-sync.js','src/services/calendar-digest.js','src/calendar/providers/google.js','src/calendar/providers/apple-caldav.js','src/security/credential-crypto.js','src/jobs/reminders.js','src/jobs/calendar-sync.js','src/auth/background-supabase.js','src/push/web-push.js'])assert.ok(fs.existsSync(path.join(__dirname,'..',file)),`missing ${file}`);
console.log('smoke tests passed');
