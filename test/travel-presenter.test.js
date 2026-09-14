const assert=require('node:assert/strict');
const {bookingSummaryTokens,eventSummaryTokens,travelTypeInventory,describeTripTiming,selectNextItineraryEntry}=require('../src/domain/travel-presenter');

const jetstar={booking_type:'flight',provider:'Jetstar',confirmation_reference:'QNRY8J',starts_at:'2026-08-15T01:50:00.000Z',ends_at:'2026-08-22T05:45:00.000Z',time_zone:'Pacific/Auckland',status:'confirmed'};
assert.deepEqual(bookingSummaryTokens(jetstar,[{service_number:'JQ223'},{service_number:'JQ224'}]),['Jetstar','JQ223 / JQ224','15–22 Aug','Ref QNRY8J']);
assert.equal(bookingSummaryTokens({...jetstar,confirmation_reference:null},[]).some(x=>/null|unknown/i.test(x)),false);
assert.deepEqual(eventSummaryTokens({starts_at:'2026-08-17T06:30:00.000Z',ends_at:'2026-08-17T08:00:00.000Z',time_zone:'Pacific/Auckland',location:'Queenstown',confirmation_reference:'95640384'}),['Event','17 Aug','6:30–8:00pm','Queenstown','Ref 95640384']);
const flight={booking_type:'flight'},stay={booking_type:'accommodation'},car={booking_type:'hire_car'},activity={booking_type:'activity'};
assert.deepEqual(travelTypeInventory({bookings:[flight,stay,car,activity],events:[{category:'event'}]}),['Flight','Stay','Car','2 Activities']);
assert.equal(describeTripTiming({start_date:'2026-09-14',end_date:'2026-09-14'},new Date('2026-09-14T02:00:00Z')).label,'Today');
assert.equal(describeTripTiming({start_date:'2026-09-15',end_date:'2026-09-15'},new Date('2026-09-14T02:00:00Z')).label,'Tomorrow');
assert.equal(describeTripTiming({start_date:'2026-09-10',end_date:'2026-09-16'},new Date('2026-09-14T02:00:00Z')).label,'In progress');
const next=selectNextItineraryEntry([
  {type:'booking',record:{title:'Past',starts_at:'2026-09-10T00:00:00Z',ends_at:'2026-09-10T02:00:00Z',status:'confirmed'}},
  {type:'event',record:{title:'Current',starts_at:'2026-09-14T06:00:00Z',ends_at:'2026-09-14T09:00:00Z'}},
  {type:'booking',record:{title:'Future',starts_at:'2026-09-15T00:00:00Z',status:'confirmed'}},
  {type:'booking',record:{title:'Cancelled',starts_at:'2026-09-14T05:00:00Z',status:'cancelled'}}
],new Date('2026-09-14T07:00:00Z'));
assert.equal(next.record.title,'Current');
assert.equal(selectNextItineraryEntry([{type:'booking',record:{title:'Done',starts_at:'2026-09-10T00:00:00Z',ends_at:'2026-09-10T01:00:00Z',status:'confirmed'}}],new Date('2026-09-14T00:00:00Z')),null);
console.log('travel presenter tests passed');
