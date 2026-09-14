const assert=require('node:assert/strict');
const {listBookingsByTripIds}=require('../src/data/bookings');
const {listLifeItemsByTripIds}=require('../src/data/life-admin');
const {loadTravelDashboard}=require('../src/services/travel-dashboard');

function batchSupabase(rows,expectedTable){const calls=[];return{calls,from(table){assert.equal(table,expectedTable);calls.push(['from',table]);const q={select(){return q;},eq(k,v){calls.push(['eq',k,v]);return q;},in(k,v){calls.push(['in',k,v]);return q;},order(){return q;},then(resolve,reject){return Promise.resolve({data:rows,error:null}).then(resolve,reject);}};return q;}};}
(async()=>{
  const noQuery={from(){throw new Error('empty ids must not query');}};
  assert.deepEqual(await listBookingsByTripIds(noQuery,{id:'u1'},[]),[]);
  assert.deepEqual(await listLifeItemsByTripIds(noQuery,{id:'u1'},[]),[]);
  let s=batchSupabase([{id:'b1',trip_id:'t1'}],'bookings');await listBookingsByTripIds(s,{id:'u1'},['t1','t2']);assert.deepEqual(s.calls.find(x=>x[0]==='in'),['in','trip_id',['t1','t2']]);
  s=batchSupabase([{id:'e1',linked_trip_id:'t2'}],'life_items');await listLifeItemsByTripIds(s,{id:'u1'},['t1','t2']);assert.deepEqual(s.calls.find(x=>x[0]==='in'),['in','linked_trip_id',['t1','t2']]);

  const trips=[{id:'t1',title:'Queenstown'},{id:'t2',title:'Bowral'}],calls=[];
  const bookings=[
    {id:'b1',trip_id:'t1',position:1,title:'Sydney → Queenstown flights',booking_type:'flight',provider:'Jetstar',confirmation_reference:'QNRY8J',status:'confirmed',starts_at:'2026-08-15T01:50:00Z',ends_at:'2026-08-22T05:45:00Z',time_zone:'Pacific/Auckland'},
    {id:'b2',trip_id:'t2',position:1,title:'Bowral stay',booking_type:'accommodation',provider:'Booking.com',confirmation_reference:'5072736754',status:'confirmed',starts_at:'2026-09-11T05:00:00Z',ends_at:'2026-09-13T00:00:00Z',time_zone:'Australia/Sydney'}
  ];
  const events=[{id:'e1',linked_trip_id:'t1',title:'Yonder reservation',category:'event',status:'upcoming',starts_at:'2026-08-17T06:30:00Z',ends_at:'2026-08-17T08:00:00Z',time_zone:'Pacific/Auckland',location:'Queenstown',confirmation_reference:'95640384'}];
  const legs=[{id:'l1',booking_id:'b1',position:1,service_number:'JQ223'},{id:'l2',booking_id:'b1',position:2,service_number:'JQ224'}];
  const result=await loadTravelDashboard({supabase:{},user:{id:'u1'},trips,
    bookingData:{listBookingsByTripIds:async(_s,_u,ids)=>{calls.push(['bookings',ids]);return bookings;}},
    lifeAdminData:{listLifeItemsByTripIds:async(_s,_u,ids)=>{calls.push(['events',ids]);return events;}},
    bookingLegData:{listBookingLegsByBookingIds:async(_s,_u,ids)=>{calls.push(['legs',ids]);return legs;}}
  });
  assert.equal(calls.length,3);assert.deepEqual(calls[0][1],['t1','t2']);assert.deepEqual(calls[2][1],['b1','b2']);
  assert.equal(result.length,2);assert.equal(result[0].trip.id,'t1');assert.deepEqual(result[0].inventory,['Flight','Activity']);
  assert.deepEqual(result[0].items[0].tokens,['Jetstar','JQ223 / JQ224','15–22 Aug','Ref QNRY8J']);
  assert.equal(result[0].items[1].title,'Yonder reservation');assert.equal(result[1].items[0].title,'Bowral stay');
  console.log('travel dashboard tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
