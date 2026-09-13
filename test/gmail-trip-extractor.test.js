const assert=require('node:assert/strict');
const {extractTripFacts}=require('../src/domain/gmail-trip-extractor');

const envelope={
  sourceRecordId:'src1',
  sender:'Qantas <bookings@qantas.com>',
  subject:'Your flight booking QF401 confirmation ABC123',
  receivedAt:'2026-09-13T00:00:00Z',
  text:'Booking reference ABC123\nFlight QF401\nSydney to Melbourne\nDepart 2026-10-02 08:20\nArrive 2026-10-02 09:55'
};
const facts=extractTripFacts(envelope,{parserVersion:'parser1'});
assert.equal(facts.some(f=>f.fact_type==='trip.booking_reference'&&f.fact_value.reference==='ABC123'),true);
assert.equal(facts.some(f=>f.fact_type==='trip.flight'&&f.fact_value.flightNumber==='QF401'),true);
assert.equal(facts.every(f=>f.parser_version==='parser1'),true);
assert.equal(facts.every(f=>f.classification_confidence>=0.7),true);

const cancel=extractTripFacts({...envelope,subject:'Your hotel booking has been cancelled',text:'Booking reference H123 has been cancelled. Refund $284.00'}, {parserVersion:'parser1'});
assert.equal(cancel.some(f=>f.fact_type==='trip.cancellation'),true);
assert.equal(cancel.some(f=>f.fact_type==='trip.refund'),true);
console.log('gmail trip extractor tests passed');
