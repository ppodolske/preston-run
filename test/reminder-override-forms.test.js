const assert=require('node:assert/strict');
const {parseReminderOverrideForm}=require('../src/routes/reminder-overrides');
function form(values){return{get:k=>Object.prototype.hasOwnProperty.call(values,k)?values[k]:null};}
assert.deepEqual(parseReminderOverrideForm(form({})),{mode:'unchanged'});
assert.deepEqual(parseReminderOverrideForm(form({reminder_mode:'global'})),{mode:'global'});
assert.deepEqual(parseReminderOverrideForm(form({reminder_mode:'custom',reminder_offsets:'2, 10'})),{mode:'custom',offsets:[10,2]});
assert.deepEqual(parseReminderOverrideForm(form({reminder_mode:'custom',reminder_action:'restore',reminder_offsets:'10,2'})),{mode:'global'});
assert.throws(()=>parseReminderOverrideForm(form({reminder_mode:'custom',reminder_offsets:'2,2'})),/unique/i);
assert.throws(()=>parseReminderOverrideForm(form({reminder_mode:'custom',reminder_offsets:'-1,2'})),/non-negative/i);
console.log('reminder override form tests passed');
