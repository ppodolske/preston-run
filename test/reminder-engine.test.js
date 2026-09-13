const assert=require('node:assert/strict');
const {runMorningSummary,runUrgentCheck}=require('../src/services/reminder-engine');

function deps(overrides={}){
  const calls={sent:[],occurrences:[],deliveries:[],failures:[]};
  return {calls,
    listPeople:async()=>[],listLifeItems:async()=>[],listTasks:async()=>[],listTrips:async()=>[],
    getSettings:async()=>({birthday_offsets:[30,14,7,1],renewal_offsets:[60,30,14,7,1],deadline_offsets:[14,7,3,0],appointment_offsets:[7,1,0],trip_offsets:[14,7,1]}),
    getOverride:async()=>null,listSubscriptions:async()=>[{id:'d1',endpoint:'e1',p256dh:'p',auth_secret:'a',active:true},{id:'d2',endpoint:'e2',p256dh:'p',auth_secret:'a',active:true}],
    getOccurrence:async()=>null,upsertOccurrence:async(_s,_u,row)=>{const saved={id:'r'+(calls.occurrences.length+1),...row};calls.occurrences.push(saved);return saved;},
    markSent:async()=>{},recordDelivery:async(_s,_u,row)=>{calls.deliveries.push(row);},markSubscriptionFailure:async(_s,_u,id,row)=>{calls.failures.push({id,...row});},
    ...overrides};
}
function transport(calls,handler){return{send:async(subscription,payload)=>{calls.sent.push({subscription,payload});if(handler)return handler(subscription,payload);return{statusCode:201};}};}

(async()=>{
  const d=deps({
    listPeople:async()=>[{id:'p1',name:'Alice',active:true,birthday_month:9,birthday_day:20}],
    listLifeItems:async()=>[{id:'l1',title:'Renew licence',category:'renewal',status:'upcoming',priority:'normal',due_at:'2026-10-13T00:00:00Z'}],
    listTasks:async()=>[{id:'k1',title:'Submit form',status:'open',priority:'high',due_at:'2026-09-16T00:00:00Z'}],
    listTrips:async()=>[{id:'t1',title:'Melbourne',status:'upcoming',start_date:'2026-09-20'}]
  });
  const result=await runMorningSummary({supabase:{},userId:'u1',now:new Date('2026-09-12T21:05:00Z'),pushTransport:transport(d.calls),deps:d});
  assert.equal(result.sent,true);assert.equal(d.calls.sent.length,2,'one logical summary should fan out to two devices');
  assert.match(d.calls.sent[0].payload.body,/Alice/);assert.match(d.calls.sent[0].payload.body,/Renew licence/);assert.match(d.calls.sent[0].payload.body,/Submit form/);assert.match(d.calls.sent[0].payload.body,/Melbourne/);
  assert.equal(d.calls.sent[0].payload.tag,'preston-daily-2026-09-13');assert.equal(d.calls.sent[0].payload.url,'/');

  const custom=deps({listPeople:async()=>[{id:'p1',name:'Alice',active:true,birthday_month:9,birthday_day:20}],getOverride:async(_s,_u,type,id)=>type==='person'&&id==='p1'?{enabled:true,offsets:[2]}:null});
  const noCustom=await runMorningSummary({supabase:{},userId:'u1',now:new Date('2026-09-12T21:05:00Z'),pushTransport:transport(custom.calls),deps:custom});
  assert.equal(noCustom.sent,false);assert.equal(custom.calls.sent.length,0,'custom offsets replace defaults');

  const empty=deps();const emptyResult=await runMorningSummary({supabase:{},userId:'u1',now:new Date('2026-09-12T21:05:00Z'),pushTransport:transport(empty.calls),deps:empty});assert.equal(emptyResult.sent,false);

  const normal=deps({listTasks:async()=>[{id:'k1',title:'Normal overdue',status:'open',priority:'normal',due_at:'2026-09-10T00:00:00Z'}]});
  const normalResult=await runUrgentCheck({supabase:{},userId:'u1',now:new Date('2026-09-13T02:00:00Z'),mode:'noon',pushTransport:transport(normal.calls),deps:normal});assert.equal(normalResult.sent,false);assert.equal(normal.calls.sent.length,0);

  const urgent=deps({listTasks:async()=>[{id:'k2',title:'Urgent payment',status:'open',priority:'urgent',due_at:'2026-09-13T00:00:00Z'}]});
  const urgentResult=await runUrgentCheck({supabase:{},userId:'u1',now:new Date('2026-09-13T02:00:00Z'),mode:'noon',pushTransport:transport(urgent.calls),deps:urgent});assert.equal(urgentResult.sent,true);assert.equal(urgent.calls.sent.length,2);assert.match(urgent.calls.sent[0].payload.body,/Urgent payment/);

  const dedup=deps({listTasks:async()=>[{id:'k2',title:'Urgent payment',status:'open',priority:'urgent',due_at:'2026-09-13T00:00:00Z'}],getOccurrence:async()=>({id:'existing',status:'sent'})});
  const dedupResult=await runUrgentCheck({supabase:{},userId:'u1',now:new Date('2026-09-13T08:00:00Z'),mode:'evening',pushTransport:transport(dedup.calls),deps:dedup});assert.equal(dedupResult.sent,false);assert.equal(dedup.calls.sent.length,0);
  const ack=deps({listTasks:async()=>[{id:'k2',title:'Urgent payment',status:'open',priority:'urgent'}],getOccurrence:async()=>({id:'existing',status:'acknowledged'})});
  assert.equal((await runUrgentCheck({supabase:{},userId:'u1',now:new Date('2026-09-13T02:00:00Z'),mode:'noon',pushTransport:transport(ack.calls),deps:ack})).sent,false);

  const failures=deps({listTasks:async()=>[{id:'k3',title:'Urgent booking',status:'open',priority:'urgent'}]});
  const failTransport=transport(failures.calls,subscription=>{if(subscription.endpoint==='e1'){const e=new Error('gone');e.statusCode=410;throw e;}return{statusCode:201};});
  const failResult=await runUrgentCheck({supabase:{},userId:'u1',now:new Date('2026-09-13T02:00:00Z'),mode:'noon',pushTransport:failTransport,deps:failures});assert.equal(failResult.sent,true);assert.equal(failures.calls.failures.length,1);assert.equal(failures.calls.failures[0].id,'d1');assert.equal(failures.calls.failures[0].permanent,true);assert.ok(failures.calls.deliveries.some(x=>x.status==='permanent_failure'));assert.ok(failures.calls.deliveries.some(x=>x.status==='delivered'));

  console.log('reminder engine tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
