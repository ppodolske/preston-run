const assert=require('node:assert/strict');
const {normalizeGmailMessage,classifyGmailSourceHint}=require('../src/domain/gmail-normalize');

const message={
  id:'msg1',
  threadId:'thr1',
  labelIds:['CATEGORY_PERSONAL'],
  internalDate:String(Date.parse('2026-09-13T04:00:00Z')),
  payload:{headers:[
    {name:'From',value:'Airline <bookings@example.com>'},
    {name:'Subject',value:'Your flight booking confirmation'},
    {name:'Date',value:'Sun, 13 Sep 2026 14:00:00 +1000'}
  ]}
};
const out=normalizeGmailMessage(message,'me@example.com','scanner1');
assert.equal(out.gmail_message_id,'msg1');
assert.equal(out.gmail_thread_id,'thr1');
assert.equal(out.gmail_account_email,'me@example.com');
assert.equal(out.sender,'Airline <bookings@example.com>');
assert.equal(out.subject,'Your flight booking confirmation');
assert.equal(out.received_at,'2026-09-13T04:00:00.000Z');
assert.equal(out.scanner_version,'scanner1');
assert.equal(classifyGmailSourceHint(out),'trip_candidate');
console.log('gmail normalization tests passed');
