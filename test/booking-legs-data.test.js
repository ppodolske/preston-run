'use strict';
const assert=require('node:assert/strict');
const {listBookingLegs,listBookingLegsByBookingIds,createBookingLeg,updateBookingLeg,deleteBookingLeg,upsertBookingLegFromGmail}=require('../src/data/booking-legs');

function builder(rows=[]){
  const calls=[];let mode='select',payload=null,filters=[];
  const b={calls,
    select(v){calls.push(['select',v]);return b;},
    insert(v){mode='insert';payload=v;calls.push(['insert',v]);return b;},
    update(v){mode='update';payload=v;calls.push(['update',v]);return b;},
    delete(){mode='delete';calls.push(['delete']);return b;},
    eq(k,v){filters.push([k,v]);calls.push(['eq',k,v]);return b;},
    in(k,v){filters.push([k,v]);calls.push(['in',k,v]);return b;},
    order(k,o){calls.push(['order',k,o]);return b;},
    single(){const row={id:'new-leg',...(payload||{})};return Promise.resolve({data:row,error:null});},
    maybeSingle(){let row=(Array.isArray(rows)?rows:[rows]).find(x=>x&&filters.every(([k,v])=>Array.isArray(v)?v.includes(x[k]):x[k]===v))||null;if(mode==='update'&&row)row={...row,...payload};return Promise.resolve({data:row,error:null});},
    then(resolve,reject){let out=(Array.isArray(rows)?rows:[rows]).filter(Boolean).filter(x=>filters.every(([k,v])=>Array.isArray(v)?v.includes(x[k]):x[k]===v));return Promise.resolve({data:out,error:null}).then(resolve,reject);}
  };return b;
}
function queue(entries){return{from(name){const next=entries.shift();assert.ok(next,`unexpected table ${name}`);assert.equal(name,next.name);return next.builder;}};}

(async()=>{
  const user={id:'u1'};
  let b=builder([{id:'l1',user_id:'u1',booking_id:'b1',position:1}]),supabase={from(name){assert.equal(name,'booking_legs');return b;}};
  assert.equal((await listBookingLegs(supabase,user,'b1')).length,1);assert.ok(b.calls.some(c=>c[0]==='eq'&&c[1]==='user_id'&&c[2]==='u1'));

  b=builder([{id:'l1',user_id:'u1',booking_id:'b1',position:1},{id:'l2',user_id:'u1',booking_id:'b2',position:1}]);supabase={from(){return b;}};
  assert.equal((await listBookingLegsByBookingIds(supabase,user,['b1','b2'])).length,2);assert.ok(b.calls.some(c=>c[0]==='in'&&c[1]==='booking_id'));

  b=builder();supabase={from(){return b;}};
  const created=await createBookingLeg(supabase,user,'b1',{position:1,service_number:'JQ223',origin:'Sydney',destination:'Queenstown',departs_at:'2026-08-15T01:50:00.000Z',arrives_at:'2026-08-15T04:45:00.000Z',departure_time_zone:'Australia/Sydney',arrival_time_zone:'Pacific/Auckland'});
  const insert=b.calls.find(c=>c[0]==='insert')[1];assert.equal(created.booking_id,'b1');assert.equal(insert.source_metadata.source,'manual');assert.ok(insert.source_metadata.manual_fields.includes('service_number'));assert.ok(insert.source_metadata.manual_fields.includes('origin'));

  const existing={id:'l1',user_id:'u1',booking_id:'b1',position:1,service_number:null,origin:'Sydney',destination:'Queenstown',departs_at:'2026-08-15T01:50:00.000Z',arrives_at:null,departure_time_zone:'Australia/Sydney',arrival_time_zone:'Pacific/Auckland',source_metadata:{source:'gmail',manual_fields:['origin']}};
  const read=builder(existing),write=builder(existing);supabase=queue([{name:'booking_legs',builder:read},{name:'booking_legs',builder:write}]);
  await upsertBookingLegFromGmail(supabase,user,'b1',{position:1,service_number:'JQ223',origin:'Wrong',arrives_at:'2026-08-15T04:45:00.000Z'},{source:'gmail',source_record_id:'src1'});
  const patch=write.calls.find(c=>c[0]==='update')[1];assert.equal(Object.hasOwn(patch,'origin'),false);assert.equal(patch.service_number,'JQ223');assert.equal(patch.arrives_at,'2026-08-15T04:45:00.000Z');assert.deepEqual(patch.source_metadata.manual_fields,['origin']);

  const manualExisting={...existing,source_metadata:{source:'gmail',manual_fields:[]}};const read2=builder(manualExisting),write2=builder(manualExisting);supabase=queue([{name:'booking_legs',builder:read2},{name:'booking_legs',builder:write2}]);
  await updateBookingLeg(supabase,user,'l1',{position:1,service_number:'JQ223',origin:'Sydney',destination:'Queenstown',departs_at:'2026-08-15T01:50:00.000Z',arrives_at:'2026-08-15T04:45:00.000Z',departure_time_zone:'Australia/Sydney',arrival_time_zone:'Pacific/Auckland'});
  const manualPatch=write2.calls.find(c=>c[0]==='update')[1];assert.ok(manualPatch.source_metadata.manual_fields.includes('service_number'));

  b=builder(existing);supabase={from(){return b;}};assert.equal(await deleteBookingLeg(supabase,user,'l1'),true);
  await assert.rejects(()=>listBookingLegs(supabase,null,'b1'),/Authenticated user/);
  console.log('booking legs data tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
