'use strict';
const assert=require('node:assert/strict');
const {extractBookingCandidate}=require('../src/domain/gmail-booking-extractor');
const {jetstarDiagnostics}=require('../src/domain/gmail-jetstar-diagnostics');

const text=`Booking reference
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

Starter fares include a carry-on baggage allowance of one bag and one small personal item.`;

const result=extractBookingCandidate({
  sender:'Jetstar <noreplyitineraries@jetstar.com>',
  subject:'Jetstar Flight Itinerary for (Booking ref# QNRY8J) JQ223 15/08/2026 JQ224 22/08/2026',
  text
},{parserVersion:'gmail-parser-v0.14.0'});

assert.equal(result.candidate.confirmation_reference,'QNRY8J');
assert.equal(result.candidate.legs.length,2,'real Jetstar itinerary spacing and trailing sections must produce two legs');
assert.deepEqual(result.candidate.legs.map(x=>x.service_number),['JQ223','JQ224']);
assert.equal(result.candidate.legs[0].departs_at,'2026-08-15T01:50:00.000Z');
assert.equal(result.candidate.legs[0].arrives_at,'2026-08-15T04:45:00.000Z');
assert.equal(result.candidate.legs[1].departs_at,'2026-08-22T05:45:00.000Z');
assert.equal(result.candidate.legs[1].arrives_at,'2026-08-22T09:00:00.000Z');

const diagnostics=jetstarDiagnostics(text,{maxLength:120000});
assert.equal(diagnostics.textLength,text.length);
assert.equal(diagnostics.atMaxLength,false);
assert.equal(diagnostics.hasJq223,true);
assert.equal(diagnostics.hasJq224,true);
assert.equal(diagnostics.hasFlight1,true);
assert.equal(diagnostics.hasFlight2,true);
assert.equal(diagnostics.hasBaggageInformation,true);
assert.equal(diagnostics.flightRowCount,2);
assert.equal(diagnostics.routeCount,2);
assert.equal(diagnostics.scheduleDateCount,6);
assert.equal(diagnostics.timePairCount,6);
assert.equal(diagnostics.serviceNumberCount,2);
assert.equal(diagnostics.dateTimePairCount,6);
assert.equal(diagnostics.timeServiceCount,2);
assert.equal(diagnostics.jq223PreviousDateGapHasNonWhitespace,false);
assert.equal(diagnostics.jq223PreviousTimeGapHasNonWhitespace,false);
assert.equal(diagnostics.jq224PreviousDateGapHasNonWhitespace,false);
assert.equal(diagnostics.jq224PreviousTimeGapHasNonWhitespace,false);
assert.ok(diagnostics.jq223PreviousDateDistance>0);
assert.ok(diagnostics.jq223PreviousTimeDistance>0);
assert.ok(diagnostics.jq224PreviousDateDistance>0);
assert.ok(diagnostics.jq224PreviousTimeDistance>0);
assert.ok(diagnostics.jq223Index>=0&&diagnostics.jq224Index>diagnostics.jq223Index);
assert.ok(diagnostics.flight1Index>diagnostics.jq224Index&&diagnostics.flight2Index>diagnostics.flight1Index);
assert.ok(diagnostics.baggageIndex>diagnostics.flight2Index);
console.log('real Jetstar shape test passed');
