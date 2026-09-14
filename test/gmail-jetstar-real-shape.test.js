'use strict';
const assert=require('node:assert/strict');
const {extractBookingCandidate}=require('../src/domain/gmail-booking-extractor');

const itineraryTable=`Booking reference
QNRY8J
Your flights Booking date: 02 Mar 2026
Date Flight number Departing Arriving

Sat 15 Aug 2026

11:50am / 11:50

JQ223

Airbus A320NEO

Sydney (Kingsford Smith)

Sat 15 Aug 2026

11:50am / 11:50

Sydney Airport - T1 International

Queenstown

Sat 15 Aug 2026

4:45pm / 16:45

Queenstown Airport

Date Flight number Departing Arriving

Sat 22 Aug 2026

5:45pm / 17:45

JQ224

Airbus A320NEO

Queenstown

Sat 22 Aug 2026

5:45pm / 17:45

Queenstown Airport

Sydney (Kingsford Smith)

Sat 22 Aug 2026

7:00pm / 19:00

Sydney Airport - T1 International`;

function extract(text){
  return extractBookingCandidate({
    sender:'Jetstar <noreplyitineraries@jetstar.com>',
    subject:'Jetstar Flight Itinerary for (Booking ref# QNRY8J) JQ223 15/08/2026 JQ224 22/08/2026',
    text
  },{parserVersion:'gmail-parser-v0.14.0'});
}

const withFooter=extract(`${itineraryTable}

International check-in times

Flight #1: Sydney (Kingsford Smith) > Queenstown

Flight #2: Queenstown > Sydney (Kingsford Smith)

Baggage Information

Cabin Baggage

Starter fares include a carry-on baggage allowance of one bag and one small personal item.`);

assert.equal(withFooter.candidate.confirmation_reference,'QNRY8J');
assert.equal(withFooter.candidate.legs.length,2,'real Jetstar itinerary spacing and trailing sections must produce two legs');
assert.deepEqual(withFooter.candidate.legs.map(x=>x.service_number),['JQ223','JQ224']);
assert.equal(withFooter.candidate.legs[0].departs_at,'2026-08-15T01:50:00.000Z');
assert.equal(withFooter.candidate.legs[0].arrives_at,'2026-08-15T04:45:00.000Z');
assert.equal(withFooter.candidate.legs[1].departs_at,'2026-08-22T05:45:00.000Z');
assert.equal(withFooter.candidate.legs[1].arrives_at,'2026-08-22T09:00:00.000Z');

const withoutFooter=extract(`${itineraryTable}

Baggage Information

Cabin Baggage

Starter fares include a carry-on baggage allowance of one bag and one small personal item.`);

assert.equal(withoutFooter.candidate.confirmation_reference,'QNRY8J');
assert.equal(withoutFooter.candidate.legs.length,2,'Jetstar itinerary table must produce two legs even when the footer route summary is absent');
assert.deepEqual(withoutFooter.candidate.legs.map(x=>[x.service_number,x.origin,x.destination]),[
  ['JQ223','Sydney','Queenstown'],
  ['JQ224','Queenstown','Sydney']
]);
assert.equal(withoutFooter.candidate.legs[0].departs_at,'2026-08-15T01:50:00.000Z');
assert.equal(withoutFooter.candidate.legs[0].arrives_at,'2026-08-15T04:45:00.000Z');
assert.equal(withoutFooter.candidate.legs[1].departs_at,'2026-08-22T05:45:00.000Z');
assert.equal(withoutFooter.candidate.legs[1].arrives_at,'2026-08-22T09:00:00.000Z');
console.log('real Jetstar shape test passed');
