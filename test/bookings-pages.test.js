const assert=require('node:assert/strict');
let pages=null;try{pages=require('../src/pages/bookings');}catch{}
assert.ok(pages,'bookings page module is required');
const {renderBookingsPage,renderBookingFormPage}=pages;
const trips=[{id:'t1',title:'ANZ'},{id:'t2',title:'Queenstown'}];
const bookings=[{id:'b1',trip_id:null,title:'Belle in Bowral',booking_type:'accommodation',status:'confirmed',provider:'Booking.com',confirmation_reference:'5072736754',starts_at:'2026-11-01T04:00:00Z',time_zone:'Australia/Sydney',location:'Bowral, NSW'},{id:'b2',trip_id:'t2',title:'Hertz Queenstown',booking_type:'hire_car',status:'confirmed',provider:'Hertz',confirmation_reference:'L5920779422'}];
const html=renderBookingsPage({bookings,trips});
assert.match(html,/<h1>Bookings<\/h1>/);assert.match(html,/Unlinked/);assert.match(html,/Belle in Bowral/);assert.match(html,/5072736754/);assert.match(html,/Queenstown/);assert.match(html,/\/bookings\/b1\/edit/);
const form=renderBookingFormPage({booking:{trip_id:'t1',booking_type:'flight',status:'confirmed',time_zone:'Australia/Sydney'},trips,segments:[{id:'s1',trip_id:'t1',title:'Flight leg'}],mode:'create'});
assert.match(form,/name="trip_id"/);assert.match(form,/value="t1" selected/);assert.match(form,/name="segment_id"/);assert.match(form,/origin/);assert.match(form,/destination/);assert.match(form,/transport/);
const unlinked=renderBookingFormPage({booking:{booking_type:'other',status:'confirmed',time_zone:'Australia/Sydney'},trips,segments:[],mode:'create'});assert.match(unlinked,/No trip/);
console.log('bookings page tests passed');
