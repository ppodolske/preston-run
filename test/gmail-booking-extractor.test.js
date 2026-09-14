const assert=require('node:assert/strict');
const {extractBookingCandidate}=require('../src/domain/gmail-booking-extractor');

function extract(envelope){return extractBookingCandidate(envelope,{parserVersion:'booking-v1'});}

const qantas=extract({
  sender:'Qantas <noreply@qantas.com>',
  subject:'Confirmation and E-Ticket Flight Itinerary for ECECAB from Sydney (Kingsford Smith) to Brisbane on 18Dec26',
  text:'Your Qantas booking reference is ECECAB. Flight from Sydney (Kingsford Smith) to Brisbane on 18Dec26.'
});
assert.equal(qantas.candidate.provider,'Qantas');
assert.equal(qantas.candidate.booking_type,'flight');
assert.equal(qantas.candidate.confirmation_reference,'ECECAB');
assert.equal(qantas.candidate.origin,'Sydney');
assert.equal(qantas.candidate.destination,'Brisbane');
assert.equal(qantas.candidate.geography.city,'Brisbane');
assert.match(qantas.candidate.starts_at,/^2026-12-18/);
assert.doesNotMatch(qantas.candidate.title,/ECECAB/,'confirmation reference must not become the booking title');
assert.ok(qantas.candidate.confidence>=0.8);

const jetstar=extract({
  sender:'Jetstar <itineraries@jetstar.com>',
  subject:'Jetstar Flight Itinerary for (Booking ref# QNRY8J) JQ223 15/08/2026 JQ224 22/08/2026',
  text:'Booking ref# QNRY8J. JQ223 Sydney to Queenstown 15/08/2026. JQ224 Queenstown to Sydney 22/08/2026.'
});
assert.equal(jetstar.candidate.provider,'Jetstar');
assert.equal(jetstar.candidate.confirmation_reference,'QNRY8J');
assert.equal(jetstar.candidate.origin,'Sydney');
assert.equal(jetstar.candidate.destination,'Queenstown');
assert.match(jetstar.candidate.starts_at,/^2026-08-15/);
assert.match(jetstar.candidate.ends_at,/^2026-08-22/);
assert.equal(jetstar.candidate.geography.city,'Queenstown');

const jetstarConfirmation=extract({
  sender:'Jetstar <noreply@jetstar.com>',
  subject:'Jetstar Booking Confirmation Email',
  text:'http://www.w3.org/2001/XMLSchema-instance\nBooking reference: QNRY8J\nManage Booking: https://www.jetstar.com/manage/QNRY8J'
});
assert.equal(jetstarConfirmation.candidate.confirmation_reference,'QNRY8J','Jetstar confirmation body reference must be retained');
assert.equal(jetstarConfirmation.candidate.booking_url,'https://www.jetstar.com/manage/QNRY8J','XML namespace URLs must never become booking URLs');

const booking=extract({
  sender:'Booking.com <customer.service@booking.com>',
  subject:'Thanks! Your booking is confirmed at Belle in Bowral',
  text:'Confirmation: 5072736754. Belle in Bowral. Bowral, New South Wales, Australia. Check-in 20 December 2026. Check-out 22 December 2026.'
});
assert.equal(booking.candidate.provider,'Booking.com');
assert.equal(booking.candidate.booking_type,'accommodation');
assert.equal(booking.candidate.confirmation_reference,'5072736754');
assert.equal(booking.candidate.title,'Belle in Bowral');
assert.equal(booking.candidate.geography.city,'Bowral');
assert.equal(booking.candidate.geography.region,'New South Wales');
assert.equal(booking.candidate.geography.country,'Australia');
assert.match(booking.candidate.starts_at,/^2026-12-20/);
assert.match(booking.candidate.ends_at,/^2026-12-22/);

const bookingPolicy=extract({
  sender:'Booking.com <noreply@booking.com>',
  subject:'Thanks! Your booking is confirmed at Belle in Bowral',
  text:'Confirmation: 5072736754. Your holiday home in Bowral is confirmed. Check-in 11 September 2026. Check-out 13 September 2026. Cancellation policy: free cancellation until 8 September.'
});
assert.equal(bookingPolicy.candidate.status,'confirmed','a cancellation policy must not mark a confirmed reservation cancelled');
assert.equal(bookingPolicy.candidate.geography.city,'Bowral','Booking.com property copy should infer Bowral even without a formatted address');
assert.equal(bookingPolicy.candidate.geography.region,'NSW');
assert.equal(bookingPolicy.candidate.geography.country,'Australia');

for(const reference of ['L5920779422','L661E0FC0A1']){
  const hertz=extract({sender:'Hertz <reservations@hertz.com>',subject:`My Hertz Reservation ${reference}`,text:`Confirmation ${reference}. Pick-up: Queenstown Airport, 15 August 2026. Return: Queenstown Airport, 22 August 2026.`});
  assert.equal(hertz.candidate.provider,'Hertz');
  assert.equal(hertz.candidate.booking_type,'hire_car');
  assert.equal(hertz.candidate.confirmation_reference,reference,'Hertz confirmation must not be truncated');
  assert.equal(hertz.candidate.geography.city,'Queenstown');
}
const hertzReminder=extract({sender:'Hertz <reservations@emails.hertz.com>',subject:'Reminder About Your Upcoming Trip to Queenstown Airport',text:'Confirmation L5920779422. Reminder About Your Upcoming Trip to Queenstown Airport.'});
assert.equal(hertzReminder.candidate.geography.city,'Queenstown','Hertz reminder prose must not be captured as part of the city');
assert.equal(hertzReminder.candidate.location,'Queenstown Airport');

const cruise=extract({
  sender:'Cruise Te Anau <notifications@fareharbor.com>',
  subject:'Confirmation: Discovery Cruise on Monday, 17 August 2026 @ 1:00pm - 3:00pm',
  text:'Booking #372492184. Discovery Cruise. Te Anau, New Zealand. Monday, 17 August 2026 @ 1:00pm - 3:00pm.'
});
assert.equal(cruise.candidate.provider,'Cruise Te Anau');
assert.equal(cruise.candidate.booking_type,'activity');
assert.equal(cruise.candidate.confirmation_reference,'372492184');
assert.equal(cruise.candidate.geography.city,'Te Anau');
assert.equal(cruise.candidate.geography.country,'New Zealand');
assert.equal(cruise.candidate.time_zone,'Pacific/Auckland');
assert.match(cruise.candidate.starts_at,/^2026-08-17T01:00/);
assert.match(cruise.candidate.ends_at,/^2026-08-17T03:00/);

const airbnb=extract({sender:'Airbnb <automated@airbnb.com>',subject:'Reservation reminder - August 15, 2026',text:'Reservation reminder for your Queenstown stay. Check-in August 15, 2026. Check-out August 22, 2026.'});
assert.equal(airbnb.candidate.provider,'Airbnb');
assert.notEqual(airbnb.candidate.confirmation_reference,'REMINDER');
assert.equal(airbnb.candidate.confirmation_reference,null);

const uber=extract({sender:'Uber <no-reply@uber.com>',subject:'Reservation confirmed for Saturday 15 August',text:'Reservation confirmed. Pick-up is at 8:30am from 225-227 Denison Road. Cancellation policy applies if you cancel late.'});
assert.equal(uber.candidate.status,'confirmed','generic cancellation policy text must not override an explicit confirmation');

for(const bad of ['EMAIL','REMINDER','NUMBER','CONFIRMED','DISCOVERY','PRESTON','ERENCE']){
  const generic=extract({sender:'Travel Co <bookings@example.com>',subject:`Booking confirmation ${bad}`,text:`Confirmation reference: ${bad}. Reservation for Bowral on 20 December 2026.`});
  assert.notEqual(generic.candidate.confirmation_reference,bad,`denylisted word ${bad} must not become a confirmation reference`);
}

for(const result of [qantas,jetstar,booking,cruise]){
  assert.ok(Array.isArray(result.facts));
  assert.ok(result.facts.some(f=>f.fact_type==='booking.identity'));
  assert.ok(result.facts.every(f=>f.parser_version==='booking-v1'));
}

console.log('gmail booking extractor tests passed');
