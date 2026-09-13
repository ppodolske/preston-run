const assert=require('node:assert/strict');
const {rankTripMatch}=require('../src/domain/gmail-trip-matcher');

const facts=[{fact_type:'trip.booking_reference',fact_value:{reference:'ABC123'}}];
const trips=[{id:'trip1',bookingReferences:['ABC123'],title:'Melbourne'}];
const exact=rankTripMatch(facts,trips);
assert.equal(exact.kind,'automatic');
assert.equal(exact.tripId,'trip1');
assert.equal(exact.score>=0.95,true);
assert.equal(exact.reasons.includes('exact_booking_reference'),true);

const newBooking=rankTripMatch([{fact_type:'trip.booking_reference',fact_value:{reference:'XYZ789'}}],[{id:'trip2',bookingReferences:['ABC123'],title:'Melbourne'}]);
assert.equal(newBooking.kind,'none');
assert.equal(newBooking.score>=0.9,true);
assert.equal(newBooking.reasons.includes('new_booking_reference'),true);

const weak=rankTripMatch([{fact_type:'trip.flight',fact_value:{flightNumber:'QF401'}}],[{id:'trip2',bookingReferences:[],title:'Melbourne'}]);
assert.equal(weak.kind,'review');
console.log('gmail trip matcher tests passed');
