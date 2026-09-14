const assert=require('node:assert/strict');
let dateTime=null;
try{dateTime=require('../src/domain/date-time');}catch{}
assert.ok(dateTime,'shared date-time domain module is required');
const {isValidTimeZone,localDateTimeToUtc,utcToLocalDateTime}=dateTime;
assert.equal(isValidTimeZone('Australia/Sydney'),true);
assert.equal(isValidTimeZone('America/Chicago'),true);
assert.equal(isValidTimeZone('Mars/Olympus_Mons'),false);
assert.equal(localDateTimeToUtc('2026-12-15T10:00','Australia/Sydney'),'2026-12-14T23:00:00.000Z');
assert.equal(utcToLocalDateTime('2026-12-14T23:00:00.000Z','Australia/Sydney'),'2026-12-15T10:00');
assert.throws(()=>localDateTimeToUtc('2026-03-08T02:30','America/Chicago'),/local time/i);
console.log('date-time domain tests passed');
