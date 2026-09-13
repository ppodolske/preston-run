const assert=require('node:assert/strict');
const {extractLifeAdminCandidate,parseExplicitDate}=require('../src/domain/gmail-life-admin-extractor');

assert.equal(parseExplicitDate('due 30 September 2026'),'2026-09-30T00:00:00.000Z');
assert.equal(parseExplicitDate('on 12/12/2026'),'2026-12-12T00:00:00.000Z');
assert.equal(parseExplicitDate('Sunday 5 July'),null,'date without year must not be guessed');

const appointment=extractLifeAdminCandidate({sender:'Physiotherapy <noreply@nookal.com>',subject:'Booking Confirmation - Physiotherapy',text:''},{intent:'life_admin',category:'appointment',reason:'health_appointment'});
assert.equal(appointment.title,'Physiotherapy appointment');
assert.equal(appointment.category,'appointment');
assert.equal(appointment.status,'upcoming');
assert.equal(appointment.starts_at,null);
assert.equal(appointment.due_at,null);
assert.equal(appointment.priority,'normal');
assert.match(appointment.notes,/Gmail/);

const restaurant=extractLifeAdminCandidate({sender:'Cafe Sydney <message@sevenrooms.com>',subject:'Your Reservation at Cafe Sydney | Preston on 12/12/2026',text:''},{intent:'life_admin',category:'event',reason:'restaurant_reservation'});
assert.equal(restaurant.title,'Cafe Sydney reservation');
assert.equal(restaurant.category,'event');
assert.equal(restaurant.status,'upcoming');
assert.equal(restaurant.starts_at,'2026-12-12T00:00:00.000Z');

const membership=extractLifeAdminCandidate({sender:'Club <billing@example.com>',subject:'Your annual membership renewal is due 30 September 2026',text:''},{intent:'life_admin',category:'membership',reason:'membership_renewal'});
assert.equal(membership.category,'membership');
assert.equal(membership.status,'needs_action');
assert.equal(membership.due_at,'2026-09-30T00:00:00.000Z');

const bill=extractLifeAdminCandidate({sender:'Billing <billing@example.com>',subject:'Invoice 4412 payment due 30 September 2026',text:''},{intent:'life_admin',category:'bill',reason:'bill_due'});
assert.equal(bill.status,'needs_action');
assert.equal(bill.due_at,'2026-09-30T00:00:00.000Z');
assert.equal(bill.priority,'high');

console.log('gmail Life Admin extractor tests passed');
