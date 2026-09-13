const assert=require('node:assert/strict');
const {renderTripsPage,renderTripDetailPage,renderTripFormPage,renderSegmentFormPage,renderBookingFormPage}=require('../src/pages/trips');

const trips=[{id:'t1',title:'Chicago & Milwaukee',status:'upcoming',start_date:'2026-10-01',end_date:'2026-10-10',notes:'Family & food'},{id:'t2',title:'<b>Escape</b>',status:'planning',start_date:null,end_date:null}];
const list=renderTripsPage({trips,upcoming:trips.slice(0,1),flash:'Saved'});
for(const x of ['Trips','Chicago &amp; Milwaukee','Upcoming','1 Oct 2026','10 Oct 2026','/trips/t1','/trips/new','Saved']) assert.ok(list.includes(x),`list missing ${x}`);
assert.ok(!list.includes('<b>Escape</b>'),'trip title must be escaped');

const segments=[{id:'s1',trip_id:'t1',position:1,segment_type:'travel',title:'SYD → ORD',origin:'Sydney',destination:'Chicago',starts_at:'2026-10-01T00:00:00.000Z',ends_at:'2026-10-01T14:00:00.000Z',time_zone:'Australia/Sydney'},{id:'s2',trip_id:'t1',position:2,segment_type:'stay',title:'Milwaukee stay',starts_at:null,ends_at:null,time_zone:'America/Chicago'}];
const bookings=[{id:'b1',trip_id:'t1',segment_id:'s1',position:1,booking_type:'flight',title:'Qantas flight',provider:'Qantas',confirmation_reference:'ABC123',status:'confirmed',starts_at:'2026-10-01T00:00:00.000Z',ends_at:'2026-10-01T14:00:00.000Z',time_zone:'Australia/Sydney',location:'ORD',booking_url:'https://example.com'}];
const itinerary=[{type:'booking',record:bookings[0]},{type:'segment',record:segments[1]}];
const detail=renderTripDetailPage({trip:trips[0],segments,bookings,itinerary,tasks:[{id:'task1',title:'Book train',status:'open',priority:'high'}]});
for(const x of ['Chicago &amp; Milwaukee','Itinerary','Qantas flight','Confirmed','Milwaukee stay','Segments','Bookings','Book train','/tasks/task1/edit','/tasks/new?trip_id=t1','Add task','/trips/t1/segments/new','/trips/t1/bookings/new','/trips/t1/delete']) assert.ok(detail.includes(x),`detail missing ${x}`);
assert.ok(detail.includes('Delete trip'));
assert.ok(!detail.includes('owner@example.com'));

const empty=renderTripDetailPage({trip:trips[0],segments:[],bookings:[],itinerary:[],tasks:[]});
for(const x of ['No itinerary entries yet.','No segments yet.','No bookings yet.','No tasks linked to this trip.']) assert.ok(empty.includes(x),`empty state missing ${x}`);

const tripForm=renderTripFormPage({trip:{id:'t1',title:'Chicago',status:'planning',start_date:'2026-10-01',end_date:'2026-10-10',notes:'x'},mode:'edit'});
for(const x of ['Edit trip','name="title"','name="status"','name="start_date"','name="end_date"','/trips/t1']) assert.ok(tripForm.includes(x),`trip form missing ${x}`);

const segmentForm=renderSegmentFormPage({trip:trips[0],segment:{id:'s1',title:'Flight',position:1,segment_type:'travel',origin:'Sydney',destination:'Chicago',starts_at:'2026-10-01T00:00:00.000Z',ends_at:'2026-10-01T01:00:00.000Z',time_zone:'Australia/Sydney'},mode:'edit'});
for(const x of ['Edit segment','2026-10-01T10:00','2026-10-01T11:00','Australia/Sydney','name="time_zone"','/segments/s1']) assert.ok(segmentForm.includes(x),`segment form missing ${x}`);

const bookingForm=renderBookingFormPage({trip:trips[0],segments,booking:{id:'b1',title:'Hotel',booking_type:'accommodation',status:'confirmed',position:1,provider:'Hotel Co',confirmation_reference:'XYZ',starts_at:'2026-10-02T20:00:00.000Z',ends_at:'2026-10-03T15:00:00.000Z',time_zone:'America/Chicago',location:'Chicago',booking_url:'https://example.com',segment_id:'s2'},mode:'edit'});
for(const x of ['Edit booking','Hotel Co','XYZ','America/Chicago','Chicago','https://example.com','name="segment_id"','Milwaukee stay','/bookings/b1']) assert.ok(bookingForm.includes(x),`booking form missing ${x}`);

console.log('trips page tests passed');
