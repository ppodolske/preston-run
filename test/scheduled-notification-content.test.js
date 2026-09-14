const assert=require('node:assert/strict');
const {runMorningSummary,runUrgentCheck}=require('../src/services/reminder-engine');

function deps(overrides={}){
  const calls={sent:[],occurrences:[]};
  return {calls,
    listPeople:async()=>[],listLifeItems:async()=>[],listTasks:async()=>[],listTrips:async()=>[],
    getSettings:async()=>({}),getOverride:async()=>null,
    listSubscriptions:async()=>[{id:'d1',endpoint:'e1',p256dh:'p',auth_secret:'a',active:true}],
    getOccurrence:async()=>null,
    upsertOccurrence:async(_s,_u,row)=>{const saved={id:`r${calls.occurrences.length+1}`,...row};calls.occurrences.push(saved);return saved;},
    markSent:async()=>{},recordDelivery:async()=>{},markSubscriptionFailure:async()=>{},
    getCalendarDigest:async()=>({events:[],attentionNeeded:false}),
    getMorningDigest:async()=>null,
    getLatestGmailScan:async()=>null,
    listGmailReviewItems:async()=>[],
    ...overrides};
}
function transport(calls){return{send:async(_subscription,payload)=>{calls.sent.push(payload);return{statusCode:201};}};}

(async()=>{
  const morning=deps({
    getMorningDigest:async()=>({headline:'Recovery signals look broadly normal.',bullets:['Today’s plan is Easy run.']}),
    getLatestGmailScan:async()=>({records_created_count:2,records_updated_count:1,review_items_created_count:1,status:'succeeded'}),
    listGmailReviewItems:async()=>[{id:'review1',title:'Review Gmail: Qantas booking',status:'needs_action'}]
  });
  const morningResult=await runMorningSummary({supabase:{},userId:'u1',now:new Date('2026-09-12T21:15:00Z'),pushTransport:transport(morning.calls),deps:morning});
  assert.equal(morningResult.sent,true,'fitness/Gmail content alone should be enough to send the 07:15 digest');
  assert.match(morning.calls.sent[0].body,/Recovery signals look broadly normal/);
  assert.match(morning.calls.sent[0].body,/Easy run/);
  assert.match(morning.calls.sent[0].body,/Gmail/i);
  assert.match(morning.calls.sent[0].body,/2 created/);
  assert.match(morning.calls.sent[0].body,/1 updated/);
  assert.match(morning.calls.sent[0].body,/Review Gmail: Qantas booking/);

  for(const mode of ['noon','evening','night']){
    const urgent=deps({listTasks:async()=>[{id:'k1',title:'Urgent payment',status:'open',priority:'urgent'}]});
    const result=await runUrgentCheck({supabase:{},userId:'u1',now:new Date('2026-09-13T02:00:00Z'),mode,pushTransport:transport(urgent.calls),deps:urgent});
    assert.equal(result.sent,true);
    assert.match(urgent.calls.occurrences[0].occurrence_key,new RegExp(`^urgent:${mode}:task:k1:`),`urgent reminder key must be slot-specific for ${mode}`);
  }

  console.log('scheduled notification content tests passed');
})().catch(error=>{console.error(error);process.exit(1);});
