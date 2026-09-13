const assert=require('node:assert/strict');
const {listTrips,getTrip,createTrip,updateTrip,deleteTrip,listSegments,getSegment,createSegment,updateSegment,deleteSegment}=require('../src/data/trips');
const {listBookings,getBooking,createBooking,updateBooking,deleteBooking}=require('../src/data/bookings');

function builder(){const calls=[];let data=null;const b={calls,select(v){calls.push(['select',v]);return b;},insert(v){data=v;calls.push(['insert',v]);return b;},update(v){data=v;calls.push(['update',v]);return b;},delete(){calls.push(['delete']);return b;},eq(k,v){calls.push(['eq',k,v]);return b;},order(k,o){calls.push(['order',k,o]);return b;},single(){return Promise.resolve({data:{id:'new',...data},error:null});},maybeSingle(){return Promise.resolve({data:{id:'row',...data},error:null});},then(resolve){resolve({data:[],error:null});}};return b;}
function hasOwner(b){return b.calls.some(x=>x[0]==='eq'&&x[1]==='user_id'&&x[2]==='u1');}

(async()=>{
  let b=builder(),supabase={from(name){assert.equal(name,'trips');return b;}};
  await listTrips(supabase,{id:'u1'});assert.equal(hasOwner(b),true);assert.ok(b.calls.some(x=>x[0]==='order'&&x[1]==='start_date'));
  b=builder();supabase={from(){return b;}};await getTrip(supabase,{id:'u1'},'t1');assert.equal(hasOwner(b),true);assert.ok(b.calls.some(x=>x[0]==='eq'&&x[1]==='id'&&x[2]==='t1'));
  b=builder();supabase={from(){return b;}};const trip=await createTrip(supabase,{id:'u1'},{title:'Trip',status:'planning',start_date:'2026-10-01',end_date:'2026-10-10',notes:''});let insert=b.calls.find(x=>x[0]==='insert')[1];assert.equal(insert.user_id,'u1');assert.equal(insert.notes,null);assert.equal(trip.id,'new');
  b=builder();supabase={from(){return b;}};await updateTrip(supabase,{id:'u1'},'t1',{title:'Trip 2',status:'upcoming'});assert.equal(hasOwner(b),true);assert.equal(Object.hasOwn(b.calls.find(x=>x[0]==='update')[1],'user_id'),false);
  b=builder();supabase={from(){return b;}};await deleteTrip(supabase,{id:'u1'},'t1');assert.equal(hasOwner(b),true);

  b=builder();supabase={from(name){assert.equal(name,'trip_segments');return b;}};await listSegments(supabase,{id:'u1'},'t1');assert.equal(hasOwner(b),true);assert.ok(b.calls.some(x=>x[0]==='eq'&&x[1]==='trip_id'&&x[2]==='t1'));assert.ok(b.calls.some(x=>x[0]==='order'&&x[1]==='position'));
  b=builder();supabase={from(){return b;}};await getSegment(supabase,{id:'u1'},'s1');assert.equal(hasOwner(b),true);
  b=builder();supabase={from(){return b;}};await createSegment(supabase,{id:'u1'},'t1',{title:'Leg',segment_type:'travel',position:2,origin:'A',destination:'B',starts_at:null,ends_at:null,time_zone:'Australia/Sydney',notes:''});insert=b.calls.find(x=>x[0]==='insert')[1];assert.equal(insert.user_id,'u1');assert.equal(insert.trip_id,'t1');assert.equal(insert.notes,null);
  b=builder();supabase={from(){return b;}};await updateSegment(supabase,{id:'u1'},'s1',{title:'Leg 2',segment_type:'travel',position:3,time_zone:'Australia/Sydney'});assert.equal(hasOwner(b),true);assert.equal(Object.hasOwn(b.calls.find(x=>x[0]==='update')[1],'trip_id'),false);
  b=builder();supabase={from(){return b;}};await deleteSegment(supabase,{id:'u1'},'s1');assert.equal(hasOwner(b),true);

  b=builder();supabase={from(name){assert.equal(name,'bookings');return b;}};await listBookings(supabase,{id:'u1'},'t1');assert.equal(hasOwner(b),true);assert.ok(b.calls.some(x=>x[0]==='eq'&&x[1]==='trip_id'&&x[2]==='t1'));
  b=builder();supabase={from(){return b;}};await getBooking(supabase,{id:'u1'},'b1');assert.equal(hasOwner(b),true);
  b=builder();supabase={from(){return b;}};await createBooking(supabase,{id:'u1'},'t1',{title:'Hotel',booking_type:'accommodation',position:1,status:'confirmed',segment_id:'',provider:'Stay Co',confirmation_reference:'ABC',starts_at:null,ends_at:null,time_zone:'Australia/Sydney',location:'Chicago',booking_url:'',notes:'',source_metadata:{source:'browser'}});insert=b.calls.find(x=>x[0]==='insert')[1];assert.equal(insert.user_id,'u1');assert.equal(insert.trip_id,'t1');assert.equal(insert.segment_id,null);assert.equal(insert.booking_url,null);assert.deepEqual(insert.source_metadata,{source:'manual'});
  b=builder();supabase={from(){return b;}};await updateBooking(supabase,{id:'u1'},'b1',{title:'Hotel 2',booking_type:'accommodation',position:1,status:'changed',time_zone:'America/Chicago',source_metadata:{source:'evil'}});assert.equal(hasOwner(b),true);const update=b.calls.find(x=>x[0]==='update')[1];assert.equal(Object.hasOwn(update,'user_id'),false);assert.equal(Object.hasOwn(update,'source_metadata'),false);
  b=builder();supabase={from(){return b;}};await deleteBooking(supabase,{id:'u1'},'b1');assert.equal(hasOwner(b),true);

  await assert.rejects(()=>createTrip(supabase,null,{title:'No'}),/Authenticated user/);
  await assert.rejects(()=>listTrips(supabase,null),/Authenticated user/);
  console.log('trips data tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
