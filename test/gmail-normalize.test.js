const assert=require('node:assert/strict');
const {normalizeGmailMessage,classifyGmailSourceHint,extractGmailMessageText}=require('../src/domain/gmail-normalize');
const {extractBookingCandidate}=require('../src/domain/gmail-booking-extractor');

const message={
  id:'msg1',threadId:'thr1',labelIds:['CATEGORY_PERSONAL'],internalDate:String(Date.parse('2026-09-13T04:00:00Z')),
  payload:{headers:[{name:'From',value:'Airline <bookings@example.com>'},{name:'Subject',value:'Your flight booking confirmation'},{name:'Date',value:'Sun, 13 Sep 2026 14:00:00 +1000'}]}
};
const out=normalizeGmailMessage(message,'me@example.com','scanner1');
assert.equal(out.gmail_message_id,'msg1');assert.equal(out.gmail_thread_id,'thr1');assert.equal(out.gmail_account_email,'me@example.com');assert.equal(out.sender,'Airline <bookings@example.com>');assert.equal(out.subject,'Your flight booking confirmation');assert.equal(out.received_at,'2026-09-13T04:00:00.000Z');assert.equal(out.scanner_version,'scanner1');assert.equal(classifyGmailSourceHint(out),'trip_candidate');

const enc=s=>Buffer.from(s).toString('base64url');
assert.equal(extractGmailMessageText({snippet:'fallback',payload:{mimeType:'text/plain',body:{data:enc('Hello plain body')}}}),'Hello plain body');
const multipart=extractGmailMessageText({snippet:'fallback',payload:{mimeType:'multipart/mixed',parts:[{mimeType:'multipart/alternative',parts:[{mimeType:'text/html',body:{data:enc('<p>HTML first</p>')}},{mimeType:'text/plain',body:{data:enc('Nested plain wins')}}]},{mimeType:'application/pdf',filename:'ticket.pdf',body:{data:enc('SECRET PDF BYTES')}}]}});
assert.match(multipart,/Nested plain wins/,'plain-text evidence must be retained');
assert.match(multipart,/HTML first/,'complementary sanitized HTML evidence must also be retained');
assert.doesNotMatch(multipart,/SECRET PDF BYTES/,'attachment bytes must remain excluded');

const jetstarMultipart=extractGmailMessageText({
  snippet:'Booking reference: QNRY8J. Your itinerary is on its way.',
  payload:{mimeType:'multipart/alternative',parts:[
    {mimeType:'text/plain',body:{data:enc('Manage booking: https://booking.jetstar.com/mmb')}},
    {mimeType:'text/html',body:{data:enc('<html><style>.x{display:none}</style><p>Booking reference: <strong>QNRY8J</strong></p><p>Manage booking: https://booking.jetstar.com/mmb</p></html>')}}
  ]}
});
assert.match(jetstarMultipart,/QNRY8J/,'booking reference present only in the richer HTML alternative must survive normalization');
assert.match(jetstarMultipart,/https:\/\/booking\.jetstar\.com\/mmb/);
assert.doesNotMatch(jetstarMultipart,/display:none/,'HTML style content must remain stripped');

const duplicateAlternative=extractGmailMessageText({payload:{mimeType:'multipart/alternative',parts:[
  {mimeType:'text/plain',body:{data:enc('Same booking evidence')}},
  {mimeType:'text/html',body:{data:enc('<p>Same booking evidence</p>')}}
]}});
assert.equal(duplicateAlternative,'Same booking evidence','equivalent plain and HTML alternatives should not duplicate exact evidence');

const htmlOnly=extractGmailMessageText({snippet:'fallback',payload:{mimeType:'text/html',body:{data:enc('<html><style>.x{}</style><script>alert(1)</script><p>Booking <b>confirmed</b>&nbsp;today</p></html>')}}});
assert.equal(htmlOnly,'Booking confirmed today');assert.doesNotMatch(htmlOnly,/alert|\.x/);

// Production Jetstar itineraries are HTML-only and encode itinerary values in adjacent table cells.
// This fixture deliberately has no whitespace between </td><td> so the Gmail normalizer must preserve
// semantic cell boundaries before the booking parser sees the text.
const jetstarHtml=`<html><body>
<p>Booking reference</p><p>QNRY8J</p>
<table><tr><td>Sat 15 Aug 2026</td><td>11:50am / 11:50</td><td>JQ223</td></tr></table>
<table><tr><td>Sydney (Kingsford Smith)</td><td>Sat 15 Aug 2026</td><td>11:50am / 11:50</td></tr>
<tr><td>Queenstown</td><td>Sat 15 Aug 2026</td><td>4:45pm / 16:45</td></tr></table>
<table><tr><td>Sat 22 Aug 2026</td><td>5:45pm / 17:45</td><td>JQ224</td></tr></table>
<table><tr><td>Queenstown</td><td>Sat 22 Aug 2026</td><td>5:45pm / 17:45</td></tr>
<tr><td>Sydney (Kingsford Smith)</td><td>Sat 22 Aug 2026</td><td>7:00pm / 19:00</td></tr></table>
<p>Flight #1: Sydney (Kingsford Smith) &gt; Queenstown</p>
<p>Flight #2: Queenstown &gt; Sydney (Kingsford Smith)</p>
</body></html>`;
const jetstarApiMessage={snippet:'Jetstar itinerary',payload:{mimeType:'multipart/alternative',parts:[{mimeType:'multipart/related',parts:[{mimeType:'text/html',body:{data:enc(jetstarHtml)}}]}]}};
const jetstarText=extractGmailMessageText(jetstarApiMessage);
const jetstarCandidate=extractBookingCandidate({sender:'Jetstar <noreplyitineraries@jetstar.com>',subject:'Jetstar Flight Itinerary for (Booking ref# QNRY8J) JQ223 15/08/2026 JQ224 22/08/2026',text:jetstarText},{parserVersion:'gmail-parser-v0.14.0'}).candidate;
assert.equal(jetstarCandidate.legs.length,2,'HTML table cell boundaries must survive Gmail normalization so Jetstar legs can be parsed');
assert.deepEqual(jetstarCandidate.legs.map(x=>x.service_number),['JQ223','JQ224']);

const padded=Buffer.from('Padding works').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
assert.equal(extractGmailMessageText({payload:{mimeType:'text/plain',body:{data:padded}}}),'Padding works');
assert.equal(extractGmailMessageText({snippet:'Snippet fallback only',payload:{mimeType:'multipart/mixed',parts:[{mimeType:'application/pdf',filename:'a.pdf',body:{attachmentId:'att1'}}]}}),'Snippet fallback only');
const long=extractGmailMessageText({payload:{mimeType:'text/plain',body:{data:enc('x'.repeat(250000))}}});assert.ok(long.length<=120000,'message text must be bounded');
console.log('gmail normalization tests passed');
