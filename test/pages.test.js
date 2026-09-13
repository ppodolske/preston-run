const assert = require('node:assert/strict');
const { renderLoginPage } = require('../src/pages/login');
const { renderHomePage } = require('../src/pages/home');
const login = renderLoginPage();
for (const expected of ['preston.ai','/assets/preston-ai-logo.png','/auth/google','/manifest.webmanifest','/icons/favicon-32.png']) assert.ok(login.includes(expected),`login missing ${expected}`);
for (const forbidden of ['Dose & Scale','State Parks','Archive','Website admin','Railway','id="condition"','birthday','Life Admin','Coming Up','Needs Attention','Manage people']) assert.ok(!login.includes(forbidden), `login leaked ${forbidden}`);
const home = renderHomePage({
  user:{email:'owner@example.com',user_metadata:{full_name:'Preston Example'}},
  upcomingBirthdays:[{person:{name:'Alex',birth_year:null},daysAway:4,ageTurning:null}],
  upcomingLifeItems:[{item:{id:'l1',title:'Licence renewal',category:'renewal'},date:new Date('2026-10-01T00:00:00Z'),daysAway:18}],
  needsAttention:[{type:'task',record:{id:'t1',title:'Pay renewal fee',priority:'urgent'},overdue:true}]
});
for (const expected of ['preston.ai','/assets/preston-ai-logo.png','Good morning','Dose & Scale','State Parks','Archive','Website admin','id="condition"','/auth/logout','v0.7.0','Coming Up','Birthdays','Life Admin','Needs Attention','Licence renewal','Pay renewal fee','Urgent','/life-admin/l1','/tasks/t1/edit']) assert.ok(home.includes(expected),`home missing ${expected}`);
assert.ok(!home.includes('owner@example.com'),'home should not expose owner email');
const unavailable=renderHomePage({user:{},birthdayDataUnavailable:true,lifeAdminDataUnavailable:true});assert.ok(unavailable.includes('Birthday data is temporarily unavailable.'));assert.ok(unavailable.includes('Life Admin data is temporarily unavailable.'));
console.log('page tests passed');
