const assert=require('node:assert/strict');
const {decideGmailTripActions}=require('../src/domain/gmail-decisions');

const facts=[{fact_type:'trip.flight',fact_value:{flightNumber:'QF401'},extraction_confidence:0.9}];
const update=decideGmailTripActions({facts,match:{kind:'automatic',tripId:'trip1',score:0.96,reasons:['exact_booking_reference']},manualFields:new Set()});
assert.equal(update[0].type,'update_trip');
assert.equal(update[0].tripId,'trip1');

const conflict=decideGmailTripActions({facts,match:{kind:'automatic',tripId:'trip1',score:0.96,reasons:['exact_booking_reference']},manualFields:new Set(['flightNumber'])});
assert.equal(conflict[0].type,'review');
assert.equal(conflict[0].reviewType,'resolve_conflict');

const manualConflict=decideGmailTripActions({
  facts:[{fact_type:'trip.cancellation',fact_value:{status:'cancelled'},extraction_confidence:0.95}],
  match:{kind:'automatic',tripId:'trip1',score:0.99,reasons:['exact_booking_reference']},
  manualFields:new Set(['status'])
});
assert.equal(manualConflict[0].type,'review');
assert.equal(manualConflict[0].reviewType,'resolve_conflict');

const create=decideGmailTripActions({facts,match:{kind:'none',tripId:null,score:0,reasons:[]},manualFields:new Set()});
assert.equal(create[0].type,'create_trip');
console.log('gmail decision tests passed');
