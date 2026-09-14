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

const cafe=extractLifeAdminCandidate({
  sender:'Cafe Sydney <message@sevenrooms.com>',
  subject:'Your Reservation at Cafe Sydney | Preston on 12/12/2026',
  text:'Reservation time: 6:00 PM\nVenue address: 5th Floor, Customs House, 31 Alfred Street, Sydney NSW 2000, Australia\nConfirmation: CS123456\nManage reservation: https://bookings.example/cafe-sydney/CS123456'
},{intent:'life_admin',category:'event',reason:'restaurant_reservation'});
assert.equal(cafe.title,'Cafe Sydney reservation');
assert.equal(cafe.category,'event');
assert.equal(cafe.status,'upcoming');
assert.equal(cafe.provider,'Cafe Sydney');
assert.equal(cafe.confirmation_reference,'CS123456');
assert.equal(cafe.starts_at,'2026-12-12T07:00:00.000Z');
assert.equal(cafe.ends_at,null);
assert.equal(cafe.time_zone,'Australia/Sydney');
assert.equal(cafe.location,'5th Floor, Customs House, 31 Alfred Street, Sydney NSW 2000, Australia');
assert.equal(cafe.booking_url,'https://bookings.example/cafe-sydney/CS123456');
assert.deepEqual(cafe.geography,{label:'Sydney, NSW',city:'Sydney',region:'NSW',country:'Australia'});
assert.equal(cafe.title.includes('CS123456'),false,'confirmation reference is event detail, never the title source');

const yonder=extractLifeAdminCandidate({
  sender:'Yonder <reservations@nowbookit.com>',
  subject:'Booking Confirmation - Yonder',
  text:'Booking reference: 95640384\nSaturday 15 August 2026\n6:30 PM - 8:00 PM\nLocation: 14 Church Street, Queenstown, Otago 9300, New Zealand\nManage booking: https://bookings.example/yonder/95640384'
},{intent:'life_admin',category:'event',reason:'restaurant_reservation'});
assert.equal(yonder.title,'Yonder reservation');
assert.equal(yonder.provider,'Yonder');
assert.equal(yonder.confirmation_reference,'95640384');
assert.equal(yonder.starts_at,'2026-08-15T06:30:00.000Z');
assert.equal(yonder.ends_at,'2026-08-15T08:00:00.000Z');
assert.equal(yonder.time_zone,'Pacific/Auckland');
assert.equal(yonder.location,'14 Church Street, Queenstown, Otago 9300, New Zealand');
assert.equal(yonder.booking_url,'https://bookings.example/yonder/95640384');
assert.deepEqual(yonder.geography,{label:'Queenstown, Otago',city:'Queenstown',region:'Otago',country:'New Zealand'});

const yonderReminder=extractLifeAdminCandidate({
  sender:'Yonder <info@nowbookit.com>',
  subject:'Your Reservation at Yonder is coming up',
  text:'Dear Preston. This is a booking reminder. Date: Monday, August 17, 2026. Booking Reference: 95640384. Service: Dinner. Time: 6:30 PM - 8:00 PM. Manage Reservation: https://yonderqt.co.nz/'
},{intent:'life_admin',category:'event',reason:'restaurant_reservation'});
assert.equal(yonderReminder.title,'Yonder reservation','reminder wording must not become part of the provider/title');
assert.equal(yonderReminder.provider,'Yonder');
assert.equal(yonderReminder.location,'Queenstown','known Yonder Queenstown booking evidence should recover event geography');
assert.equal(yonderReminder.time_zone,'Pacific/Auckland');
assert.deepEqual(yonderReminder.geography,{label:'Queenstown, Otago',city:'Queenstown',region:'Otago',country:'New Zealand'});

const membership=extractLifeAdminCandidate({sender:'Club <billing@example.com>',subject:'Your annual membership renewal is due 30 September 2026',text:''},{intent:'life_admin',category:'membership',reason:'membership_renewal'});
assert.equal(membership.category,'membership');
assert.equal(membership.status,'needs_action');
assert.equal(membership.due_at,'2026-09-30T00:00:00.000Z');
assert.equal(membership.provider,null);
assert.equal(membership.linked_trip_id,null);

const bill=extractLifeAdminCandidate({sender:'Billing <billing@example.com>',subject:'Invoice 4412 payment due 30 September 2026',text:''},{intent:'life_admin',category:'bill',reason:'bill_due'});
assert.equal(bill.status,'needs_action');
assert.equal(bill.due_at,'2026-09-30T00:00:00.000Z');
assert.equal(bill.priority,'high');

const autoPayBill=extractLifeAdminCandidate({sender:'Capital One <capitalone@notification.capitalone.com>',subject:'Your Venture X Card statement is ready',text:'Statement balance: $70.00\nPayment due date: October 07, 2026\nYou are currently enrolled in AutoPay. The payment amount will be debited from your account on your due date.'},{intent:'life_admin',category:'bill',reason:'bill_due'});
assert.equal(autoPayBill.category,'bill');
assert.equal(autoPayBill.status,'upcoming','active AutoPay bills should not be marked as needing manual action');
assert.equal(autoPayBill.due_at,'2026-10-07T00:00:00.000Z');
assert.equal(autoPayBill.priority,'normal');

console.log('gmail Life Admin extractor tests passed');
