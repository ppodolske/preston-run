const assert=require('node:assert/strict');
const {normalizeGmailMessage,classifyGmailSourceHint,extractGmailMessageText}=require('../src/domain/gmail-normalize');

const message={
  id:'msg1',threadId:'thr1',labelIds:['CATEGORY_PERSONAL'],internalDate:String(Date.parse('2026-09-13T04:00:00Z')),
  payload:{headers:[{name:'From',value:'Airline <bookings@example.com>'},{name:'Subject',value:'Your flight booking confirmation'},{name:'Date',value:'Sun, 13 Sep 2026 14:00:00 +1000'}]}
};
const out=normalizeGmailMessage(message,'me@example.com','scanner1');
assert.equal(out.gmail_message_id,'msg1');assert.equal(out.gmail_thread_id,'thr1');assert.equal(out.gmail_account_email,'me@example.com');assert.equal(out.sender,'Airline <bookings@example.com>');assert.equal(out.subject,'Your flight booking confirmation');assert.equal(out.received_at,'2026-09-13T04:00:00.000Z');assert.equal(out.scanner_version,'scanner1');assert.equal(classifyGmailSourceHint(out),'trip_candidate');

const enc=s=>Buffer.from(s).toString('base64url');
assert.equal(extractGmailMessageText({snippet:'fallback',payload:{mimeType:'text/plain',body:{data:enc('Hello plain body')}}}),'Hello plain body');
assert.equal(extractGmailMessageText({snippet:'fallback',payload:{mimeType:'multipart/mixed',parts:[{mimeType:'multipart/alternative',parts:[{mimeType:'text/html',body:{data:enc('<p>HTML first</p>')}},{mimeType:'text/plain',body:{data:enc('Nested plain wins')}}]},{mimeType:'application/pdf',filename:'ticket.pdf',body:{data:enc('SECRET PDF BYTES')}}]}}),'Nested plain wins');
const htmlOnly=extractGmailMessageText({snippet:'fallback',payload:{mimeType:'text/html',body:{data:enc('<html><style>.x{}</style><script>alert(1)</script><p>Booking <b>confirmed</b>&nbsp;today</p></html>')}}});
assert.equal(htmlOnly,'Booking confirmed today');assert.doesNotMatch(htmlOnly,/alert|\.x/);
const padded=Buffer.from('Padding works').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
assert.equal(extractGmailMessageText({payload:{mimeType:'text/plain',body:{data:padded}}}),'Padding works');
assert.equal(extractGmailMessageText({snippet:'Snippet fallback only',payload:{mimeType:'multipart/mixed',parts:[{mimeType:'application/pdf',filename:'a.pdf',body:{attachmentId:'att1'}}]}}),'Snippet fallback only');
const long=extractGmailMessageText({payload:{mimeType:'text/plain',body:{data:enc('x'.repeat(250000))}}});assert.ok(long.length<=120000,'message text must be bounded');
console.log('gmail normalization tests passed');
