const assert=require('node:assert/strict');
let pages=null;try{pages=require('../src/pages/bookings');}catch{}
assert.ok(pages,'bookings page module is required');
const {renderBookingsPage,renderBookingFormPage}=pages;
const trips=[{id:'t1',title:'ANZ',archived_at:null},{id:'t2',title:'Queenstown',archived_at:null},{id:'t3',title:'Historic',archived_at:'2026-09-14T00:00:00Z'}];
const bookings=[{id:'b1',trip_id:null,title:'Belle in Bowral',booking_type:'accommodation',status:'confirmed',provider:'Booking.com',confirmation_reference:'5072736754',starts_at:'2026-11-01T04:00:00Z',time_zone:'Australia/Sydney',location:'Bowral, NSW'},{id:'b2',trip_id:'t2',title:'Hertz Queenstown',booking_type:'hire_car',status:'confirmed',provider:'Hertz',confirmation_reference:'L5920779422'}];
const html=renderBookingsPage({bookings,trips});
assert.match(html,/<h1>Bookings<\/h1>/);assert.match(html,/Unlinked/);assert.match(html,/Belle in Bowral/);assert.match(html,/5072736754/);assert.match(html,/Queenstown/);assert.match(html,/\/bookings\/b1\/edit/);
const form=renderBookingFormPage({booking:{id:'bf',trip_id:'t1',booking_type:'flight',status:'confirmed',time_zone:'Australia/Sydney'},trips,segments:[{id:'s1',trip_id:'t1',title:'Flight leg'}],legs:[{id:'l1',position:1,service_number:'JQ223',origin:'Sydney',destination:'Queenstown',departure_time_zone:'Australia/Sydney',arrival_time_zone:'Pacific/Auckland'},{id:'l2',position:2,service_number:'JQ224',origin:'Queenstown',destination:'Sydney',departure_time_zone:'Pacific/Auckland',arrival_time_zone:'Australia/Sydney'}],mode:'edit'});
assert.match(form,/name="trip_id"/);assert.match(form,/value="t1" selected/);assert.match(form,/name="segment_id"/);assert.match(form,/>Stage</);assert.doesNotMatch(form,/>Segment</);assert.match(form,/origin/);assert.match(form,/destination/);assert.match(form,/transport/);assert.match(form,/Booking URL/);
assert.match(form,/<optgroup label="Active trips">/);assert.match(form,/<optgroup label="Archived trips">/);assert.match(form,/Historic/);
assert.match(form,/JQ223/);assert.match(form,/JQ224/);assert.match(form,/\/bookings\/bf\/legs\/l1/);
const unlinked=renderBookingFormPage({booking:{booking_type:'other',status:'confirmed',time_zone:'Australia/Sydney'},trips,segments:[],legs:[],mode:'create'});assert.match(unlinked,/No trip/);
console.log('bookings page tests passed');
