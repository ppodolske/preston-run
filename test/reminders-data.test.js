const assert=require('node:assert/strict');
const data=require('../src/data/reminders');

function builder(resultData={id:'row'}){const calls=[];let payload=null;const b={calls,insert(v){payload=v;calls.push(['insert',v]);return b;},upsert(v){payload=v;calls.push(['upsert',v]);return b;},update(v){payload=v;calls.push(['update',v]);return b;},delete(){calls.push(['delete']);return b;},select(v='*'){calls.push(['select',v]);return b;},eq(k,v){calls.push(['eq',k,v]);return b;},neq(k,v){calls.push(['neq',k,v]);return b;},gt(k,v){calls.push(['gt',k,v]);return b;},lte(k,v){calls.push(['lte',k,v]);return b;},order(){return b;},maybeSingle(){return Promise.resolve({data:payload?{...resultData,...payload}:resultData,error:null});},single(){return Promise.resolve({data:payload?{...resultData,...payload}:resultData,error:null});},then(resolve){resolve({data:Array.isArray(resultData)?resultData:[resultData],error:null});}};return b;}

(async()=>{
  let b=builder(null),supabase={from(name){assert.equal(name,'reminder_settings');return b;}};
  await data.getReminderSettings(supabase,'u1'); assert.ok(b.calls.some(x=>x[0]==='eq'&&x[1]==='user_id'&&x[2]==='u1'));

  b=builder();supabase={from(){return b;}};
  await data.upsertReminderSettings(supabase,'u1',{user_id:'evil',birthday_offsets:[30,7]});
  const upsert=b.calls.find(x=>x[0]==='upsert')[1]; assert.equal(upsert.user_id,'u1');

  b=builder();supabase={from(){return b;}};
  await data.upsertReminderOccurrence(supabase,'u1',{occurrence_key:'k',entity_type:'person',entity_id:'p1',reminder_class:'birthday',target_date:'2026-09-20',effective_trigger_at:'2026-09-13T21:05:00Z',deep_link:'/people/p1',policy_source:'default'});
  assert.equal(b.calls.find(x=>x[0]==='upsert')[1].user_id,'u1');

  b=builder([]);supabase={from(name){assert.equal(name,'reminders');return b;}};
  await data.cancelFutureInheritedOccurrences(supabase,'u1','2026-09-13T00:00:00Z');
  for(const expected of [['eq','user_id','u1'],['eq','status','pending'],['eq','policy_source','default']]) assert.ok(b.calls.some(x=>JSON.stringify(x)===JSON.stringify(expected)));
  assert.ok(b.calls.some(x=>x[0]==='gt'&&x[1]==='effective_trigger_at'));

  b=builder();supabase={from(){return b;}};
  await data.acknowledgeReminder(supabase,'u1','r1'); assert.ok(b.calls.some(x=>x[0]==='eq'&&x[1]==='user_id'&&x[2]==='u1'));
  b=builder();supabase={from(){return b;}};
  await data.setPushSubscriptionActive(supabase,'u1','s1',false); assert.ok(b.calls.some(x=>x[0]==='eq'&&x[1]==='user_id'&&x[2]==='u1'));

  console.log('Reminder data tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
