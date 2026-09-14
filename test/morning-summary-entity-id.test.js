const assert=require('node:assert/strict');
const {runMorningSummary}=require('../src/services/reminder-engine');

(async()=>{
  const userId='11111111-1111-4111-8111-111111111111';
  let savedOccurrence=null;
  const deps={
    listPeople:async()=>[],
    listLifeItems:async()=>[],
    listTasks:async()=>[],
    listTrips:async()=>[],
    getSettings:async()=>({birthday_offsets:[30,14,7,1],renewal_offsets:[60,30,14,7,1],deadline_offsets:[14,7,3,0],appointment_offsets:[7,1,0],trip_offsets:[14,7,1]}),
    getOverride:async()=>null,
    getCalendarDigest:async()=>({events:[{title:'Morning event',all_day:true,start_date:'2026-09-15',status:'confirmed'}],attentionNeeded:false}),
    getMorningDigest:async()=>null,
    getLatestGmailScan:async()=>null,
    listGmailReviewItems:async()=>[],
    getOccurrence:async()=>null,
    upsertOccurrence:async(_supabase,_userId,row)=>{
      savedOccurrence=row;
      return {id:'22222222-2222-4222-8222-222222222222',...row};
    },
    listSubscriptions:async()=>[],
    markSent:async()=>{},
    recordDelivery:async()=>{},
    markSubscriptionFailure:async()=>{}
  };

  await runMorningSummary({
    supabase:{},
    userId,
    now:new Date('2026-09-14T21:15:00Z'),
    pushTransport:{send:async()=>({statusCode:201})},
    deps
  });

  assert.ok(savedOccurrence,'morning summary should create a reminder occurrence');
  assert.equal(savedOccurrence.entity_type,'summary');
  assert.equal(savedOccurrence.entity_id,userId,'summary reminder entity_id must be a UUID; use the owner user UUID');
  assert.equal(savedOccurrence.target_date,'2026-09-15');
  console.log('morning summary entity id regression test passed');
})().catch(error=>{console.error(error);process.exit(1);});
