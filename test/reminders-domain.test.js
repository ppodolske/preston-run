const assert=require('node:assert/strict');
const {
  DEFAULT_REMINDER_OFFSETS,
  validateReminderSettings,
  validateReminderOverride,
  resolveOffsets,
  buildOccurrenceKey,
  shouldIncludeOnDate,
  isUrgentEntity,
  getSydneyLocalParts,
  shouldRunScheduledMode
}=require('../src/domain/reminders');

assert.deepEqual(DEFAULT_REMINDER_OFFSETS.birthday,[30,14,7,1]);
assert.deepEqual(DEFAULT_REMINDER_OFFSETS.renewal,[60,30,14,7,1]);
assert.deepEqual(DEFAULT_REMINDER_OFFSETS.deadline,[14,7,3,0]);
assert.deepEqual(DEFAULT_REMINDER_OFFSETS.appointment,[7,1,0]);
assert.deepEqual(DEFAULT_REMINDER_OFFSETS.trip,[14,7,1]);

assert.deepEqual(resolveOffsets('birthday',{},null),[30,14,7,1]);
assert.deepEqual(resolveOffsets('birthday',{birthday_offsets:[45,10]},{enabled:false,offsets:[2]}),[45,10]);
assert.deepEqual(resolveOffsets('birthday',{birthday_offsets:[45,10]},{enabled:true,offsets:[5,1]}),[5,1]);

assert.equal(buildOccurrenceKey({entityType:'person',entityId:'abc',reminderClass:'birthday',offsetDays:7,targetDate:'2026-09-20'}),'person:abc:birthday:7:2026-09-20');
assert.equal(shouldIncludeOnDate({targetDate:'2026-09-20',today:'2026-09-13',offsetDays:7}),true);
assert.equal(shouldIncludeOnDate({targetDate:'2026-09-20',today:'2026-09-20',offsetDays:0}),true);
assert.equal(shouldIncludeOnDate({targetDate:'2026-09-20',today:'2026-09-14',offsetDays:7}),false);

assert.throws(()=>validateReminderOverride({offsets:[7,-1]}),/offset/i);
assert.throws(()=>validateReminderOverride({offsets:[7,7]}),/unique/i);
assert.deepEqual(validateReminderOverride({offsets:[1,7,3],enabled:true}).offsets,[7,3,1]);
assert.equal(validateReminderSettings({birthday_offsets:[1,30,7]}).birthday_offsets[0],30);

assert.equal(isUrgentEntity({priority:'normal',status:'open',overdue:true}),false);
assert.equal(isUrgentEntity({priority:'urgent',status:'open'}),true);
assert.equal(isUrgentEntity({priority:'urgent',status:'completed'}),false);

let parts=getSydneyLocalParts(new Date('2026-01-15T20:05:00Z'));
assert.deepEqual({hour:parts.hour,minute:parts.minute},{hour:7,minute:5});
parts=getSydneyLocalParts(new Date('2026-06-15T21:05:00Z'));
assert.deepEqual({hour:parts.hour,minute:parts.minute},{hour:7,minute:5});
assert.equal(shouldRunScheduledMode('morning',new Date('2026-01-15T20:05:00Z')),true);
assert.equal(shouldRunScheduledMode('morning',new Date('2026-06-15T21:05:00Z')),true);
assert.equal(shouldRunScheduledMode('noon',new Date('2026-01-16T01:00:00Z')),true);
assert.equal(shouldRunScheduledMode('evening',new Date('2026-01-16T07:00:00Z')),true);
assert.equal(shouldRunScheduledMode('morning',new Date('2026-01-15T20:06:00Z')),false);
assert.throws(()=>shouldRunScheduledMode('bogus',new Date()),/mode/i);

console.log('Reminder domain tests passed');
