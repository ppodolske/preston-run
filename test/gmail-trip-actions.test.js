const assert=require('node:assert/strict');
const {buildGmailTripActions,inferTripInputFromFacts,referenceFromFacts}=require('../src/services/gmail-trip-actions');

const facts=[
  {fact_type:'trip.booking_reference',fact_value:{reference:'abc123'}},
  {fact_type:'trip.flight',fact_value:{flightNumber:'QF401'}}
];
assert.equal(referenceFromFacts(facts),'ABC123');
assert.deepEqual(inferTripInputFromFacts(facts),{
  title:'Trip booking ABC123',
  status:'planning',
  notes:'Created from Gmail booking reference ABC123.'
});
assert.equal(inferTripInputFromFacts([...facts,{fact_type:'trip.cancellation',fact_value:{status:'cancelled'}}]).status,'cancelled');

(async()=>{
  const calls=[];
  const actions=buildGmailTripActions({
    supabase:{},
    userId:'user1',
    tripData:{
      createTrip:async(_db,user,input)=>{calls.push(['createTrip',user,input]);return {id:'trip1',...input};},
      getManualFieldsForTrip:async(_db,user,tripId)=>{calls.push(['manualFields',user,tripId]);return new Set(['status']);}
    },
    gmailData:{recordGmailActivity:async(_db,userId,entry)=>{calls.push(['activity',userId,entry]);return {id:'act1',...entry};}},
    reviewData:{createGmailReviewItem:async(_db,user,decision)=>{calls.push(['review',user,decision]);return {id:'review1'};}}
  });

  const manual=await actions.getManualFieldsForMatch({tripId:'trip1'});
  assert.equal(manual.has('status'),true);

  const created=await actions.applyCreateTripFromGmail({sourceRecordId:'src1',facts});
  assert.equal(created.id,'trip1');
  assert.equal(calls.some(call=>call[0]==='activity'&&call[2].action==='create'&&call[2].entityId==='trip1'),true);

  await actions.applyUpdateTripFromGmail({sourceRecordId:'src1',tripId:'trip1',facts});
  assert.equal(calls.some(call=>call[0]==='activity'&&call[2].action==='update'&&call[2].entityId==='trip1'),true);

  await actions.createGmailReviewItem({sourceRecordId:'src1',reviewType:'resolve_conflict',reason:'gmail_conflicts_with_manual_field'});
  assert.equal(calls.some(call=>call[0]==='review'),true);
  console.log('gmail trip action tests passed');
})();
