const assert=require('node:assert/strict');
const {proposeTripLink}=require('../src/domain/trip-linker');

const manualBowral={id:'bowral-trip',title:'Southern Highlands',automation_managed:false,start_date:'2026-12-20',end_date:'2026-12-22',destination_label:'Bowral, NSW',destination_city:'Bowral',destination_region:'NSW',destination_country:'Australia'};
const bowralBooking={booking_type:'accommodation',title:'Belle in Bowral',starts_at:'2026-12-20T00:00:00Z',ends_at:'2026-12-22T00:00:00Z',geography:{label:'Bowral, NSW',city:'Bowral',region:'NSW',country:'Australia'}};
let result=proposeTripLink({subjectType:'booking',subject:bowralBooking,trips:[manualBowral]});
assert.equal(result.kind,'link');assert.equal(result.tripId,'bowral-trip');assert.ok(result.score>=80);assert.ok(result.reasons.includes('date_overlap'));assert.ok(result.reasons.includes('geography_match'));assert.equal(result.proposedTrip,null);

result=proposeTripLink({subjectType:'booking',subject:{...bowralBooking,geography:{label:'Chicago, IL',city:'Chicago',region:'IL',country:'USA'}},trips:[manualBowral]});
assert.equal(result.kind,'review');assert.ok(result.reasons.includes('country_conflict'));assert.notEqual(result.kind,'link');

const anz={id:'anz',title:'ANZ',automation_managed:false,start_date:'2026-12-10',end_date:'2027-01-04',destination_label:null,destination_city:null,destination_region:null,destination_country:null};
result=proposeTripLink({subjectType:'booking',subject:{booking_type:'flight',title:'Sydney → Brisbane flight',starts_at:'2026-12-18T00:00:00Z',ends_at:null,origin:'Sydney',destination:'Brisbane',geography:{label:'Brisbane',city:'Brisbane',region:null,country:'Australia'}},trips:[anz]});
assert.equal(result.kind,'review');assert.equal(result.tripId,'anz');assert.ok(result.reasons.includes('manual_trip_missing_geography'));

const generated={id:'gen',title:'Queenstown, New Zealand',automation_managed:true,start_date:'2026-08-15',end_date:'2026-08-22',destination_label:'Queenstown, New Zealand',destination_city:'Queenstown',destination_region:null,destination_country:'New Zealand'};
const queenstown={booking_type:'hire_car',title:'Hertz car hire',starts_at:'2026-08-15T00:00:00Z',ends_at:'2026-08-22T00:00:00Z',geography:{label:'Queenstown, New Zealand',city:'Queenstown',region:null,country:'New Zealand'}};
result=proposeTripLink({subjectType:'booking',subject:queenstown,trips:[generated]});assert.equal(result.kind,'link');assert.equal(result.tripId,'gen');

result=proposeTripLink({subjectType:'booking',subject:bowralBooking,trips:[]});
assert.equal(result.kind,'create');assert.equal(result.proposedTrip.title,'Bowral, NSW');assert.equal(result.proposedTrip.destination_city,'Bowral');assert.equal(result.proposedTrip.destination_region,'NSW');assert.equal(result.proposedTrip.destination_country,'Australia');assert.equal(result.proposedTrip.start_date,'2026-12-20');assert.equal(result.proposedTrip.end_date,'2026-12-22');assert.equal(result.proposedTrip.automation_managed,true);assert.doesNotMatch(result.proposedTrip.title,/5072736754|confirmation/i);

const roundTrip={booking_type:'flight',title:'Sydney → Queenstown flights',starts_at:'2026-08-15T00:00:00Z',ends_at:'2026-08-22T00:00:00Z',origin:'Sydney',destination:'Queenstown',geography:{label:'Queenstown, New Zealand',city:'Queenstown',region:null,country:'New Zealand'}};
result=proposeTripLink({subjectType:'booking',subject:roundTrip,trips:[]});assert.equal(result.kind,'create');assert.equal(result.proposedTrip.title,'Queenstown, New Zealand');assert.equal(result.proposedTrip.start_date,'2026-08-15');assert.equal(result.proposedTrip.end_date,'2026-08-22');

const oneWay={...roundTrip,ends_at:null};
result=proposeTripLink({subjectType:'booking',subject:oneWay,trips:[]});assert.equal(result.kind,'review');assert.ok(result.reasons.includes('insufficient_trip_dates'));

const activity={booking_type:'activity',title:'Discovery Cruise',starts_at:'2026-08-17T01:00:00Z',ends_at:'2026-08-17T03:00:00Z',geography:{label:'Te Anau, New Zealand',city:'Te Anau',country:'New Zealand'}};
result=proposeTripLink({subjectType:'booking',subject:activity,trips:[]});assert.equal(result.kind,'review');assert.ok(result.reasons.includes('isolated_activity'));

result=proposeTripLink({subjectType:'booking',subject:oneWay,trips:[],relatedBookings:[queenstown]});assert.equal(result.kind,'create');assert.equal(result.proposedTrip.destination_city,'Queenstown');assert.ok(result.reasons.includes('related_booking_cluster'));

const event={category:'event',title:'Dinner',starts_at:'2026-08-17T08:00:00Z',ends_at:'2026-08-17T10:00:00Z',location:'Queenstown',geography:{label:'Queenstown, New Zealand',city:'Queenstown',country:'New Zealand'}};
result=proposeTripLink({subjectType:'event',subject:event,trips:[generated]});assert.equal(result.kind,'link');assert.equal(result.tripId,'gen');
result=proposeTripLink({subjectType:'event',subject:{...event,geography:{label:null,city:null,region:null,country:null}},trips:[generated]});assert.equal(result.kind,'review');assert.ok(result.reasons.includes('event_geography_required'));

result=proposeTripLink({subjectType:'booking',subject:{...queenstown,starts_at:'2026-08-14T00:00:00Z'},trips:[{...manualBowral,id:'manual-q',start_date:'2026-08-15',end_date:'2026-08-22',destination_label:'Queenstown',destination_city:'Queenstown',destination_country:'New Zealand'}]});
assert.equal(result.kind,'link');assert.equal(result.proposedTrip,null,'manual trip must never receive an automated update proposal');

console.log('trip linker tests passed');
