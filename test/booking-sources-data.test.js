const assert=require('node:assert/strict');
const {linkBookingSource,listBookingSources,listBookingsForSource,findCanonicalBookingForGmailCandidate}=require('../src/data/booking-sources');

function builder(resultData=[]){const calls=[];let written=null;const b={calls,select(v){calls.push(['select',v]);return b;},insert(v){written=v;calls.push(['insert',v]);return b;},upsert(v,o){written=v;calls.push(['upsert',v,o]);return b;},eq(k,v){calls.push(['eq',k,v]);return b;},order(k,o){calls.push(['order',k,o]);return b;},limit(v){calls.push(['limit',v]);return b;},maybeSingle(){const value=Array.isArray(resultData)?resultData[0]||null:resultData;return Promise.resolve({data:value,error:null});},then(resolve){resolve({data:Array.isArray(resultData)?resultData:resultData?[resultData]:[],error:null});}};return b;}
function queueSupabase(entries){return{from(name){const next=entries.shift();assert.ok(next,`unexpected table ${name}`);assert.equal(name,next.name);return next.builder;}};}

(async()=>{
  let b=builder([{id:'link1'}]),supabase={from(name){assert.equal(name,'booking_source_links');return b;}};
  await linkBookingSource(supabase,{id:'u1'},'b1','src1');const upsert=b.calls.find(x=>x[0]==='upsert');assert.equal(upsert[1].user_id,'u1');assert.equal(upsert[1].booking_id,'b1');assert.equal(upsert[1].source_record_id,'src1');assert.equal(upsert[2].onConflict,'user_id,booking_id,source_record_id');

  b=builder([{id:'link1',source_record_id:'src1'}]);supabase={from(){return b;}};await listBookingSources(supabase,{id:'u1'},'b1');assert.ok(b.calls.some(x=>x[0]==='eq'&&x[1]==='booking_id'&&x[2]==='b1'));
  b=builder([{booking_id:'b1',bookings:{id:'b1'}},{booking_id:'b2',bookings:{id:'b2'}}]);supabase={from(){return b;}};const rows=await listBookingsForSource(supabase,{id:'u1'},'src1');assert.deepEqual(rows.map(x=>x.id),['b1','b2']);

  const sourceLinks=builder([]),refBookings=builder([{id:'b1',provider:'Hertz',confirmation_reference:'L5920779422'}]);supabase=queueSupabase([{name:'booking_source_links',builder:sourceLinks},{name:'bookings',builder:refBookings}]);
  const match=await findCanonicalBookingForGmailCandidate(supabase,{id:'u1'},{provider:' hertz ',confirmation_reference:'l5920779422'},{id:'src2'});assert.equal(match.id,'b1');assert.ok(refBookings.calls.some(x=>x[0]==='eq'&&x[1]==='confirmation_reference'&&x[2]==='L5920779422'));

  await assert.rejects(()=>linkBookingSource(supabase,null,'b1','src1'),/Authenticated user/);
  console.log('booking source data tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
