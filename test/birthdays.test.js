const assert = require('node:assert/strict');
const { validateBirthdayParts, getNextBirthday, getUpcomingBirthdays } = require('../src/domain/birthdays');

assert.deepEqual(validateBirthdayParts({month:'5',day:'12',year:''}), {birthday_month:5,birthday_day:12,birth_year:null});
assert.deepEqual(validateBirthdayParts({month:'',day:'',year:''}), {birthday_month:null,birthday_day:null,birth_year:null});
assert.throws(() => validateBirthdayParts({month:'2',day:'30',year:''}), /not valid/);
assert.throws(() => validateBirthdayParts({month:'2',day:'29',year:'2025'}), /not valid/);
assert.deepEqual(validateBirthdayParts({month:'2',day:'29',year:'2024'}), {birthday_month:2,birthday_day:29,birth_year:2024});

let next = getNextBirthday({birthday_month:12,birthday_day:31,birth_year:1990}, new Date('2026-12-30T00:00:00Z'));
assert.equal(next.daysAway, 1);
assert.equal(next.ageTurning, 36);
next = getNextBirthday({birthday_month:1,birthday_day:2,birth_year:null}, new Date('2026-12-31T00:00:00Z'));
assert.equal(next.date.toISOString().slice(0,10), '2027-01-02');
assert.equal(next.ageTurning, null);
next = getNextBirthday({birthday_month:2,birthday_day:29,birth_year:2000}, new Date('2026-02-27T00:00:00Z'));
assert.equal(next.date.toISOString().slice(0,10), '2026-02-28');
assert.equal(next.ageTurning, 26);

const upcoming = getUpcomingBirthdays([
  {name:'Zed',active:true,birthday_month:1,birthday_day:2,birth_year:null},
  {name:'Amy',active:true,birthday_month:1,birthday_day:2,birth_year:1995},
  {name:'Inactive',active:false,birthday_month:1,birthday_day:1,birth_year:1990}
], new Date('2026-12-31T00:00:00Z'), 10);
assert.deepEqual(upcoming.map(x=>x.person.name), ['Amy','Zed']);
console.log('birthday tests passed');
