const assert = require('node:assert/strict');
const {
  validateTripInput,
  validateSegmentInput,
  validateBookingInput,
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

assert.deepEqual(validateTripInput({title:' Midwest trip ',status:'upcoming',start_date:'2026-10-01',end_date:'2026-10-10',notes:' hi '}), {
  title:'Midwest trip',status:'upcoming',start_date:'2026-10-01',end_date:'2026-10-10',notes:'hi'
});
assert.throws(() => validateTripInput({title:'Trip',start_date:'2026-10-10',end_date:'2026-10-01'}), /end date/i);
assert.throws(() => validateTripInput({title:'Trip',status:'mystery'}), /status/i);

const segment = validateSegmentInput({title:'Flight to Chicago',segment_type:'travel',position:'2',origin:'Sydney',destination:'Chicago',starts_at:'2026-09-13T10:00',ends_at:'2026-09-13T14:00',time_zone:'Australia/Sydney'});
assert.equal(segment.position,2);
assert.equal(segment.starts_at,'2026-09-13T00:00:00.000Z');
assert.equal(segment.ends_at,'2026-09-13T04:00:00.000Z');
assert.throws(() => validateSegmentInput({title:'Bad',starts_at:'2026-09-13T14:00',ends_at:'2026-09-13T10:00',time_zone:'Australia/Sydney'}), /end/i);

const booking = validateBookingInput({title:'Hotel',booking_type:'accommodation',provider:'Hotel Co',confirmation_reference:'ABC123',status:'confirmed',position:'3',starts_at:'2026-09-14T15:00',ends_at:'2026-09-16T10:00',time_zone:'America/Chicago',location:'Chicago',booking_url:'https://example.com',segment_id:'seg1'});
assert.equal(booking.position,3);
assert.equal(booking.segment_id,'seg1');
assert.equal(booking.provider,'Hotel Co');
assert.equal(booking.starts_at,'2026-09-14T20:00:00.000Z');
assert.throws(() => validateBookingInput({title:'Bad',booking_type:'train'}), /booking type/i);

const segments = [
  {id:'s1',position:1,title:'Flight',segment_type:'travel',starts_at:'2026-09-13T00:00:00.000Z'},
  {id:'s2',position:2,title:'Drive',segment_type:'travel',starts_at:'2026-09-15T10:00:00.000Z'},
  {id:'s3',position:5,title:'Undated note',segment_type:'other',starts_at:null}
];
const bookings = [
  {id:'b1',segment_id:'s1',position:1,title:'QF flight',booking_type:'flight',status:'confirmed',starts_at:'2026-09-13T00:00:00.000Z'},
  {id:'b2',segment_id:null,position:4,title:'Museum',booking_type:'activity',status:'cancelled',starts_at:'2026-09-14T12:00:00.000Z'}
];
const itinerary = buildItinerary({segments,bookings});
assert.deepEqual(itinerary.map(x=>[x.type,x.record.id]), [['booking','b1'],['booking','b2'],['segment','s2'],['segment','s3']]);
assert.equal(itinerary[1].record.status,'cancelled');
assert.ok(!itinerary.some(x=>x.type==='segment' && x.record.id==='s1'),'linked segment should be suppressed when bookings exist');

const trips = [
  {id:'past',title:'Past',status:'completed',start_date:'2026-01-01',end_date:'2026-01-05'},
  {id:'active',title:'Active',status:'in_progress',start_date:'2026-09-10',end_date:'2026-09-20'},
  {id:'next',title:'Next',status:'upcoming',start_date:'2026-10-01',end_date:'2026-10-10'},
  {id:'far',title:'Far',status:'planning',start_date:'2027-10-01',end_date:'2027-10-10'},
  {id:'cancelled',title:'Cancelled',status:'cancelled',start_date:'2026-09-14',end_date:'2026-09-15'}
];
assert.deepEqual(getUpcomingTrips(trips, new Date('2026-09-13T00:00:00Z'), 180).map(x=>x.id), ['active','next']);

console.log('trips domain tests passed');
