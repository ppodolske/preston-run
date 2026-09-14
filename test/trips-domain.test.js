const assert = require('node:assert/strict');
const {
  validateTripInput,
  validateSegmentInput,
  validateBookingInput,
  validateBookingLegInput,
  isValidTimeZone,
  localDateTimeToUtc,
  utcToLocalDateTime,
  buildItinerary,
  getUpcomingTrips
} = require('../src/domain/trips');

assert.equal(isValidTimeZone('Australia/Sydney'), true);
assert.equal(isValidTimeZone('America/Chicago'), true);
assert.equal(isValidTimeZone('Mars/Olympus_Mons'), false);

assert.equal(localDateTimeToUtc('2026-09-13T10:00', 'Australia/Sydney'), '2026-09-13T00:00:00.000Z');
assert.equal(localDateTimeToUtc('2026-01-15T10:00', 'America/Chicago'), '2026-01-15T16:00:00.000Z');
assert.equal(localDateTimeToUtc('2026-07-15T10:00', 'America/Chicago'), '2026-07-15T15:00:00.000Z');
assert.equal(localDateTimeToUtc('2026-12-15T10:00', 'Australia/Sydney'), '2026-12-14T23:00:00.000Z');
assert.equal(utcToLocalDateTime('2026-12-14T23:00:00.000Z', 'Australia/Sydney'), '2026-12-15T10:00');
assert.throws(() => localDateTimeToUtc('2026-03-08T02:30', 'America/Chicago'), /local time/i);
assert.throws(() => localDateTimeToUtc('2026-09-13T10:00', 'Mars/Olympus_Mons'), /time zone/i);

assert.deepEqual(validateTripInput({title:' Midwest trip ',status:'upcoming',start_date:'2026-10-01',end_date:'2026-10-10',destination_label:' Chicago ',destination_city:' Chicago ',destination_region:' IL ',destination_country:' USA ',notes:' hi '}), {
  title:'Midwest trip',status:'upcoming',start_date:'2026-10-01',end_date:'2026-10-10',destination_label:'Chicago',destination_city:'Chicago',destination_region:'IL',destination_country:'USA',notes:'hi'
});
assert.throws(() => validateTripInput({title:'Trip',start_date:'2026-10-10',end_date:'2026-10-01'}), /end date/i);
assert.throws(() => validateTripInput({title:'Trip',status:'mystery'}), /status/i);

const segment = validateSegmentInput({title:'Flight to Chicago',segment_type:'travel',position:'2',origin:'Sydney',destination:'Chicago',starts_at:'2026-09-13T10:00',ends_at:'2026-09-13T14:00',time_zone:'Australia/Sydney'});
assert.equal(segment.position,2);
assert.equal(segment.starts_at,'2026-09-13T00:00:00.000Z');
assert.equal(segment.ends_at,'2026-09-13T04:00:00.000Z');
assert.throws(() => validateSegmentInput({title:'Bad',starts_at:'2026-09-13T14:00',ends_at:'2026-09-13T10:00',time_zone:'Australia/Sydney'}), /end/i);

const booking = validateBookingInput({trip_id:'trip1',title:'Hotel',booking_type:'accommodation',provider:'Hotel Co',confirmation_reference:'ABC123',status:'confirmed',position:'3',starts_at:'2026-09-14T15:00',ends_at:'2026-09-16T10:00',time_zone:'America/Chicago',location:'Chicago',origin:'ORD',destination:'Downtown Chicago',booking_url:'https://example.com',segment_id:'seg1'});
assert.equal(booking.position,3);
assert.equal(booking.trip_id,'trip1');
assert.equal(booking.segment_id,'seg1');
assert.equal(booking.provider,'Hotel Co');
assert.equal(booking.origin,'ORD');
assert.equal(booking.destination,'Downtown Chicago');
assert.equal(booking.starts_at,'2026-09-14T20:00:00.000Z');
const unlinked=validateBookingInput({trip_id:'',title:'Train',booking_type:'transport',status:'confirmed',time_zone:'Australia/Sydney',segment_id:'seg1'});
assert.equal(unlinked.trip_id,null);
assert.equal(unlinked.segment_id,null);
assert.equal(unlinked.booking_type,'transport');
assert.throws(() => validateBookingInput({title:'Bad',booking_type:'spaceship'}), /booking type/i);

const leg=validateBookingLegInput({service_number:'JQ223',origin:'Sydney',destination:'Queenstown',departs_at:'2026-08-15T11:50',arrives_at:'2026-08-15T16:45',departure_time_zone:'Australia/Sydney',arrival_time_zone:'Pacific/Auckland',position:1});
assert.equal(leg.service_number,'JQ223');
assert.equal(leg.departs_at,'2026-08-15T01:50:00.000Z');
assert.equal(leg.arrives_at,'2026-08-15T04:45:00.000Z');
assert.throws(()=>validateBookingLegInput({position:1,departs_at:'2026-08-15T17:00',arrives_at:'2026-08-15T16:00',departure_time_zone:'Pacific/Auckland',arrival_time_zone:'Pacific/Auckland'}),/arrival time/i);

const segments = [
  {id:'s1',position:1,title:'Flight',segment_type:'travel',starts_at:'2026-09-13T00:00:00.000Z'},
  {id:'s2',position:2,title:'Drive',segment_type:'travel',starts_at:'2026-09-15T10:00:00.000Z'},
  {id:'s3',position:5,title:'Undated note',segment_type:'other',starts_at:null}
];
const bookings = [
  {id:'b1',segment_id:'s1',position:1,title:'QF flight',booking_type:'flight',status:'confirmed',starts_at:'2026-09-13T00:00:00.000Z'},
  {id:'b2',segment_id:null,position:4,title:'Museum',booking_type:'activity',status:'cancelled',starts_at:'2026-09-14T12:00:00.000Z'}
];
const events=[
  {id:'e1',category:'event',title:'Dinner at Yonder',status:'upcoming',starts_at:'2026-09-14T09:00:00.000Z',time_zone:'Pacific/Auckland'}
];
const itinerary = buildItinerary({segments,bookings,events});
assert.deepEqual(itinerary.map(x=>[x.type,x.record.id]), [['booking','b1'],['event','e1'],['booking','b2'],['segment','s2'],['segment','s3']]);
assert.equal(itinerary[1].record.title,'Dinner at Yonder');
assert.equal(itinerary[2].record.status,'cancelled');
assert.ok(!itinerary.some(x=>x.type==='segment' && x.record.id==='s1'),'linked segment should be suppressed when bookings exist');

const trips = [
  {id:'past',title:'Past',status:'completed',start_date:'2026-01-01',end_date:'2026-01-05'},
  {id:'active',title:'Active',status:'in_progress',start_date:'2026-09-10',end_date:'2026-09-20'},
  {id:'next',title:'Next',status:'upcoming',start_date:'2026-10-01',end_date:'2026-10-10'},
  {id:'far',title:'Far',status:'planning',start_date:'2027-10-01',end_date:'2027-10-10'},
  {id:'cancelled',title:'Cancelled',status:'cancelled',start_date:'2026-09-14',end_date:'2026-09-15'},
  {id:'archived',title:'Archived',status:'upcoming',start_date:'2026-09-20',end_date:'2026-09-22',archived_at:'2026-09-14T00:00:00Z'}
];
assert.deepEqual(getUpcomingTrips(trips, new Date('2026-09-13T00:00:00Z'), 180).map(x=>x.id), ['active','next']);
assert.deepEqual(getUpcomingTrips([{id:'a',status:'upcoming',start_date:'2026-09-20',archived_at:'2026-09-14T00:00:00Z'}],new Date('2026-09-14T00:00:00Z')),[]);

console.log('trips domain tests passed');
