const assert=require('node:assert/strict');
const {createLifeItem,createGmailLifeItem,updateLifeItem}=require('../src/data/life-admin');
const {createTask,updateTask}=require('../src/data/tasks');

function builder(){const calls=[];let mode='';let data=null;const b={calls,insert(v){mode='insert';data=v;calls.push(['insert',v]);return b;},update(v){mode='update';data=v;calls.push(['update',v]);return b;},delete(){mode='delete';calls.push(['delete']);return b;},select(v){calls.push(['select',v]);return b;},eq(k,v){calls.push(['eq',k,v]);return b;},order(){return b;},single(){return Promise.resolve({data:{id:'new',...data},error:null});},maybeSingle(){return Promise.resolve({data:{id:'row',...data},error:null});}};return b;}

(async()=>{
  let b=builder(),supabase={from(name){assert.equal(name,'life_items');return b;}};
  const created=await createLifeItem(supabase,{id:'u1'},{title:'Renew licence',category:'renewal',status:'upcoming',due_at:null,starts_at:null,recurrence_rule:'',priority:'high',notes:'',linked_person_id:''});
  const insert=b.calls.find(x=>x[0]==='insert')[1];assert.equal(insert.user_id,'u1');assert.deepEqual(insert.source_metadata,{source:'manual'});assert.equal(insert.linked_person_id,null);assert.equal(created.id,'new');

  b=builder();supabase={from(name){assert.equal(name,'life_items');return b;}};
  await createGmailLifeItem(supabase,{id:'u1'},{title:'Physiotherapy appointment',category:'appointment',status:'upcoming',priority:'normal'},{source:'gmail',source_record_id:'src1',gmail_message_id:'m1',source_link:'https://mail.google.com/m1',sender:'Physio',classification_reason:'health_appointment'});
  const gmailInsert=b.calls.find(x=>x[0]==='insert')[1];
  assert.equal(gmailInsert.user_id,'u1');
  assert.deepEqual(gmailInsert.source_metadata,{source:'gmail',source_record_id:'src1',gmail_message_id:'m1',source_link:'https://mail.google.com/m1',sender:'Physio',classification_reason:'health_appointment'});

  b=builder();supabase={from(){return b;}};await updateLifeItem(supabase,{id:'u1'},'l1',{title:'Renew',category:'renewal',status:'waiting',priority:'normal'});assert.ok(b.calls.some(x=>x[0]==='eq'&&x[1]==='user_id'&&x[2]==='u1'));assert.equal(Object.hasOwn(b.calls.find(x=>x[0]==='update')[1],'user_id'),false);assert.equal(Object.hasOwn(b.calls.find(x=>x[0]==='update')[1],'source_metadata'),false);
  b=builder();supabase={from(name){assert.equal(name,'tasks');return b;}};await createTask(supabase,{id:'u1'},{title:'Pay fee',status:'open',priority:'urgent',linked_life_item_id:'l1',linked_person_id:'',linked_trip_id:'trip1'});const taskInsert=b.calls.find(x=>x[0]==='insert')[1];assert.equal(taskInsert.user_id,'u1');assert.equal(taskInsert.linked_life_item_id,'l1');assert.equal(taskInsert.linked_person_id,null);assert.equal(taskInsert.linked_trip_id,'trip1');
  b=builder();supabase={from(){return b;}};await updateTask(supabase,{id:'u1'},'t1',{title:'Pay fee',status:'completed',priority:'normal',linked_trip_id:''});const taskUpdate=b.calls.find(x=>x[0]==='update')[1];assert.ok(b.calls.some(x=>x[0]==='eq'&&x[1]==='user_id'&&x[2]==='u1'));assert.equal(taskUpdate.linked_trip_id,null);
  await assert.rejects(()=>createLifeItem(supabase,null,{title:'No'}),/Authenticated user/);
  await assert.rejects(()=>createGmailLifeItem(supabase,null,{title:'No'},{source:'gmail'}),/Authenticated user/);
  console.log('Life Admin data tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
