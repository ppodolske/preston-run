const assert=require('node:assert/strict');
const {renderTripsPage,renderTripDetailPage,renderTripFormPage,renderSegmentFormPage}=require('../src/pages/trips');

const active={id:'t1',title:'Queenstown',status:'upcoming',start_date:'2026-08-15',end_date:'2026-08-22',destination_label:'Queenstown, New Zealand',archived_at:null};
const past={id:'t2',title:'Bowral',status:'completed',start_date:'2026-09-11',end_date:'2026-09-13',destination_label:'Bowral, NSW',archived_at:null};
const archived={id:'t3',title:'Old Trip',status:'completed',start_date:'2026-01-01',end_date:'2026-01-03',archived_at:'2026-09-14T00:00:00Z'};
const list=renderTripsPage({trips:[active,past],upcoming:[active],past:[past],flash:'Saved'});
for(const x of ['Trips','Queenstown','Bowral','Coming Up','Past trips','Archived Trips','/trips/t1','/trips/t2','/trips/archived','Saved'])assert.ok(list.includes(x),`list missing ${x}`);
assert.doesNotMatch(list,/Old Trip/);
const archiveList=renderTripsPage({trips:[archived],upcoming:[],past:[],archived:true});
assert.match(archiveList,/Archived Trips/);assert.match(archiveList,/Old Trip/);assert.match(archiveList,/Back to Trips/);

const segments=[{id:'s1',trip_id:'t1',position:1,segment_type:'travel',title:'Queenstown',starts_at:'2026-08-15T01:00:00Z',ends_at:'2026-08-15T02:00:00Z',time_zone:'Pacific/Auckland'}];
const bookings=[
  {id:'b1',trip_id:'t1',segment_id:null,position:1,booking_type:'flight',title:'Sydney → Queenstown flights',provider:'Jetstar',confirmation_reference:'QNRY8J',status:'confirmed',starts_at:'2026-08-15T01:50:00.000Z',ends_at:'2026-08-22T05:45:00.000Z',time_zone:'Pacific/Auckland'},
  {id:'b2',trip_id:'t1',booking_type:'accommodation',title:'Queenstown stay',provider:'Airbnb',status:'confirmed',starts_at:'2026-08-15T05:00:00Z',ends_at:'2026-08-22T00:00:00Z',time_zone:'Pacific/Auckland'},
  {id:'b3',trip_id:'t1',booking_type:'hire_car',title:'Hertz car hire',provider:'Hertz',status:'confirmed',starts_at:'2026-08-15T05:00:00Z',ends_at:'2026-08-22T04:00:00Z',time_zone:'Pacific/Auckland'},
  {id:'b4',trip_id:'t1',booking_type:'activity',title:'Discovery Cruise',provider:'Cruise Te Anau',status:'confirmed',starts_at:'2026-08-17T01:00:00Z',ends_at:'2026-08-17T03:00:00Z',time_zone:'Pacific/Auckland'}
];
const legs=[
  {id:'l1',booking_id:'b1',position:1,service_number:'JQ223',origin:'Sydney',destination:'Queenstown',departs_at:'2026-08-15T01:50:00Z',arrives_at:'2026-08-15T04:45:00Z',departure_time_zone:'Australia/Sydney',arrival_time_zone:'Pacific/Auckland'},
  {id:'l2',booking_id:'b1',position:2,service_number:'JQ224',origin:'Queenstown',destination:'Sydney',departs_at:'2026-08-22T05:45:00Z',arrives_at:null,departure_time_zone:'Pacific/Auckland',arrival_time_zone:'Australia/Sydney'}
];
const events=[{id:'e1',linked_trip_id:'t1',category:'event',title:'Yonder reservation',status:'upcoming',starts_at:'2026-08-17T06:30:00Z',ends_at:'2026-08-17T08:00:00Z',time_zone:'Pacific/Auckland',location:'Queenstown',provider:'Yonder',confirmation_reference:'95640384'}];
const itinerary=[...bookings.map(record=>({type:'booking',record})),{type:'event',record:events[0]}];
const detail=renderTripDetailPage({trip:active,segments,bookings,events,itinerary,bookingLegs:legs,inventory:['Flight','Stay','Car','2 Activities'],nextEntry:itinerary[0],tasks:[{id:'task1',title:'Pack',status:'open',priority:'high'}]});
for(const x of ['FLIGHT','JQ223','JQ224','Sydney','Queenstown','Flight · Stay · Car · 2 Activities','Yonder reservation','Stage','Add stage','/bookings/new?trip_id=t1','Archive trip'])assert.match(detail,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
assert.doesNotMatch(detail,/>Segment</i);assert.match(detail,/class="next-card"/);
const historical=renderTripDetailPage({trip:past,segments:[],bookings:[],events:[],itinerary:[],bookingLegs:[],inventory:[],nextEntry:null,tasks:[]});
assert.doesNotMatch(historical,/class="next-card"/);
const archivedDetail=renderTripDetailPage({trip:archived,segments:[],bookings:[],events:[],itinerary:[],bookingLegs:[],inventory:[],nextEntry:null,tasks:[]});
assert.match(archivedDetail,/Unarchive trip/);assert.match(archivedDetail,/Archived/);

const tripForm=renderTripFormPage({trip:{id:'t1',title:'Queenstown',status:'planning',start_date:'2026-08-15',end_date:'2026-08-22'},mode:'edit',reminderSettings:{trip_offsets:[14,7,1]},reminderOverride:null});
assert.match(tripForm,/Edit trip/);assert.match(tripForm,/name="title"/);
const stageForm=renderSegmentFormPage({trip:active,segment:{id:'s1',title:'Queenstown',position:1,segment_type:'travel',time_zone:'Pacific/Auckland'},mode:'edit'});
assert.match(stageForm,/Edit stage/);assert.doesNotMatch(stageForm,/Edit segment/);assert.match(stageForm,/\/segments\/s1/);

console.log('trips page tests passed');
