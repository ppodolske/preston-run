'use strict';
const assert=require('node:assert/strict');
const {extractBookingCandidate}=require('../src/domain/gmail-booking-extractor');

const result=extractBookingCandidate({
  sender:'Jetstar <noreplyitineraries@jetstar.com>',
  subject:'Jetstar Flight Itinerary for (Booking ref# QNRY8J) JQ223 15/08/2026 JQ224 22/08/2026',
  text:`Booking reference
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

Sydney Airport - T1 International

International check-in times

Flight #1: Sydney (Kingsford Smith) > Queenstown

Flight #2: Queenstown > Sydney (Kingsford Smith)

Baggage Information

Cabin Baggage

Starter fares include a carry-on baggage allowance of one bag and one small personal item.`
},{parserVersion:'gmail-parser-v0.14.0'});

assert.equal(result.candidate.confirmation_reference,'QNRY8J');
assert.equal(result.candidate.legs.length,2,'real Jetstar itinerary spacing and trailing sections must produce two legs');
assert.deepEqual(result.candidate.legs.map(x=>x.service_number),['JQ223','JQ224']);
assert.equal(result.candidate.legs[0].departs_at,'2026-08-15T01:50:00.000Z');
assert.equal(result.candidate.legs[0].arrives_at,'2026-08-15T04:45:00.000Z');
assert.equal(result.candidate.legs[1].departs_at,'2026-08-22T05:45:00.000Z');
assert.equal(result.candidate.legs[1].arrives_at,'2026-08-22T09:00:00.000Z');
console.log('real Jetstar shape test passed');
