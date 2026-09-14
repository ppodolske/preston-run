const assert=require('node:assert/strict');
const {createLifeItem,createGmailLifeItem,updateLifeItem,listLifeItemsByTrip}=require('../src/data/life-admin');
const {createTask,updateTask}=require('../src/data/tasks');

function builder(resultData=null){const calls=[];let data=null;const b={calls,insert(v){data=v;calls.push(['insert',v]);return b;},update(v){data=v;calls.push(['update',v]);return b;},delete(){calls.push(['delete']);return b;},select(v){calls.push(['select',v]);return b;},eq(k,v){calls.push(['eq',k,v]);return b;},order(k,o){calls.push(['order',k,o]);return b;},limit(v){calls.push(['limit',v]);return b;},single(){return Promise.resolve({data:{id:'new',...data},error:null});},maybeSingle(){return Promise.resolve({data:data?{...(resultData||{}),...data}:resultData,error:null});},then(resolve){resolve({data:Array.isArray(resultData)?resultData:resultData?[resultData]:[],error:null});}};return b;}
function queueSupabase(entries){return{from(name){const next=entries.shift();assert.ok(next,`unexpected table ${name}`);assert.equal(name,next.name);return next.builder;}};}

(async()=>{
  let b=builder(),supabase={from(name){assert.equal(name,'life_items');return b;}};
  await createLifeItem(supabase,{id:'u1'},{title:'Dinner',category:'event',status:'upcoming',starts_at:'2026-12-12T07:00:00.000Z',ends_at:'2026-12-12T09:00:00.000Z',time_zone:'Australia/Sydney',location:'Circular Quay',provider:'Cafe Sydney',confirmation_reference:'ABC123',booking_url:'https://example.com',priority:'normal',linked_trip_id:'trip1'});
  const insert=b.calls.find(x=>x[0]==='insert')[1];assert.equal(insert.user_id,'u1');assert.equal(insert.linked_trip_id,'trip1');assert.equal(insert.ends_at,'2026-12-12T09:00:00.000Z');assert.equal(insert.provider,'Cafe Sydney');assert.equal(insert.source_metadata.source,'manual');assert.ok(insert.source_metadata.manual_fields.includes('linked_trip_id'));

  b=builder();supabase={from(name){assert.equal(name,'life_items');return b;}};
  await createGmailLifeItem(supabase,{id:'u1'},{title:'Reservation',category:'event',status:'upcoming',priority:'normal',location:'Bowral'},{source:'gmail',source_record_id:'src1',gmail_message_id:'m1',source_link:'https://mail.google.com/m1',sender:'Provider',classification_reason:'restaurant_reservation'});
  const gmailInsert=b.calls.find(x=>x[0]==='insert')[1];assert.equal(gmailInsert.location,'Bowral');assert.equal(gmailInsert.source_metadata.source_record_id,'src1');

  const existing={id:'l1',user_id:'u1',title:'Gmail event',category:'event',status:'upcoming',priority:'normal',source_metadata:{source:'gmail',source_record_id:'src1',manual_fields:['title']}};
  const read=builder(existing),write=builder(existing);supabase=queueSupabase([{name:'life_items',builder:read},{name:'life_items',builder:write}]);
  await updateLifeItem(supabase,{id:'u1'},'l1',{title:'My dinner',category:'event',status:'upcoming',priority:'normal',linked_trip_id:'trip1',location:'Circular Quay'});
  const update=write.calls.find(x=>x[0]==='update')[1];assert.equal(update.source_metadata.source,'gmail');assert.equal(update.source_metadata.source_record_id,'src1');assert.ok(update.source_metadata.manual_fields.includes('title'));assert.ok(update.source_metadata.manual_fields.includes('linked_trip_id'));

  b=builder([]);supabase={from(name){assert.equal(name,'life_items');return b;}};await listLifeItemsByTrip(supabase,{id:'u1'},'trip1');assert.ok(b.calls.some(x=>x[0]==='eq'&&x[1]==='user_id'&&x[2]==='u1'));assert.ok(b.calls.some(x=>x[0]==='eq'&&x[1]==='linked_trip_id'&&x[2]==='trip1'));

  b=builder();supabase={from(name){assert.equal(name,'tasks');return b;}};await createTask(supabase,{id:'u1'},{title:'Pay fee',status:'open',priority:'urgent',linked_life_item_id:'l1',linked_person_id:'',linked_trip_id:'trip1'});const taskInsert=b.calls.find(x=>x[0]==='insert')[1];assert.equal(taskInsert.linked_trip_id,'trip1');
  b=builder();supabase={from(){return b;}};await updateTask(supabase,{id:'u1'},'t1',{title:'Pay fee',status:'completed',priority:'normal',linked_trip_id:''});const taskUpdate=b.calls.find(x=>x[0]==='update')[1];assert.equal(taskUpdate.linked_trip_id,null);
  await assert.rejects(()=>createLifeItem(supabase,null,{title:'No'}),/Authenticated user/);
  await assert.rejects(()=>createGmailLifeItem(supabase,null,{title:'No'},{source:'gmail'}),/Authenticated user/);
  console.log('Life Admin data tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
