'use strict';
const assert=require('node:assert/strict');
const {parseMode,assertApplyConfirmation,APPLY_CONFIRMATION}=require('../src/jobs/gmail-trip-reconstruction');

assert.equal(parseMode([],{}),'dry-run');
assert.equal(parseMode(['--dry-run'],{GMAIL_TRIP_RECONSTRUCTION_MODE:'apply'}),'dry-run','explicit argv must override environment mode');
assert.equal(parseMode(['--apply'],{}),'apply');
assert.equal(parseMode([],{GMAIL_TRIP_RECONSTRUCTION_MODE:'apply'}),'apply','explicit environment mode must support Railway pre-deploy execution');
assert.equal(parseMode([],{GMAIL_TRIP_RECONSTRUCTION_MODE:'dry-run'}),'dry-run');
assert.throws(()=>parseMode([],{GMAIL_TRIP_RECONSTRUCTION_MODE:'unexpected'}),/mode/i);
assert.throws(()=>parseMode(['--apply','--dry-run'],{}),/either --dry-run or --apply/);
assert.doesNotThrow(()=>assertApplyConfirmation('apply',{GMAIL_TRIP_RECONSTRUCTION_CONFIRM:APPLY_CONFIRMATION}));
assert.throws(()=>assertApplyConfirmation('apply',{}),/Apply confirmation is required/);
console.log('gmail trip reconstruction job tests passed');
