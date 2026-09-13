const assert=require('node:assert/strict');
const {determineScanWindow,runGmailScan}=require('../src/services/gmail-scan-runner');

const initial=determineScanWindow({first_scan_completed_at:null},new Date('2026-09-13T12:00:00Z'),12);
assert.equal(initial.scanType,'initial');
assert.equal(initial.after,'2025/09/13');

const incremental=determineScanWindow({first_scan_completed_at:'2026-09-13T01:00:00Z',checkpoint_received_at:'2026-09-12T00:00:00Z'},new Date('2026-09-13T12:00:00Z'),12);
assert.equal(incremental.scanType,'manual_incremental');
assert.equal(incremental.after,'2026/09/12');

function baseProvider(snippet='Booking reference ABC123 Flight QF401'){
  return {
    listMessages:async()=>({messages:[{id:'m1'}]}),
    getMessage:async()=>({
      id:'m1',
      threadId:'t1',
      labelIds:['INBOX'],
      internalDate:String(Date.parse('2026-09-13T00:00:00Z')),
      snippet,
      payload:{headers:[{name:'Subject',value:'Flight QF401 booking ABC123'}]}
    })
  };
}

function basePersistence(processed){
  return {
    startScan:async()=>({id:'scan1'}),
    upsertSource:async(row)=>{processed.push(row.gmail_message_id);return {id:'src1',...row};},
    insertFacts:async(facts)=>facts,
    finishScan:async()=>({}),
    failScan:async()=>({})
  };
}

async function runWithActions(actions,existingTrips=[{id:'trip1',bookingReferences:['ABC123'],title:'Melbourne'}]){
  const processed=[];
  const result=await runGmailScan({
    supabase:{},
    userId:'user1',
    connection:{id:'conn1',gmail_account_email:'me@example.com',first_scan_completed_at:null},
    provider:baseProvider(),
    config:{scannerVersion:'scanner1',parserVersion:'parser1',initialLookbackMonths:12},
    existingTrips,
    persistence:basePersistence(processed),
    actions
  });
  return {processed,result};
}

(async()=>{
  const {processed,result}=await runWithActions({});
  assert.equal(result.status,'succeeded');
  assert.deepEqual(processed,['m1']);

  const applied=[];
  const automatic=await runWithActions({
    getManualFieldsForMatch:async()=>new Set(),
    applyUpdateTripFromGmail:async(decision)=>applied.push(decision),
    applyCreateTripFromGmail:async()=>assert.fail('matched source should not create a new trip'),
    createGmailReviewItem:async()=>assert.fail('high-confidence non-conflict should not create review')
  });
  assert.equal(automatic.result.status,'succeeded');
  assert.equal(applied.length,1);
  assert.equal(applied[0].type,'update_trip');
  assert.equal(applied[0].tripId,'trip1');
  assert.equal(applied[0].sourceRecordId,'src1');

  const reviewed=[];
  await runWithActions({
    getManualFieldsForMatch:async()=>new Set(['flightNumber']),
    applyUpdateTripFromGmail:async()=>assert.fail('manual conflict must not update trip'),
    createGmailReviewItem:async(decision)=>reviewed.push(decision)
  });
  assert.equal(reviewed.length,1);
  assert.equal(reviewed[0].type,'review');
  assert.equal(reviewed[0].reviewType,'resolve_conflict');

  const created=[];
  await runWithActions({
    getManualFieldsForMatch:async()=>new Set(),
    applyCreateTripFromGmail:async(decision)=>created.push(decision),
    applyUpdateTripFromGmail:async()=>assert.fail('unmatched source should create, not update')
  },[]);
  assert.equal(created.length,1);
  assert.equal(created[0].type,'create_trip');
  console.log('gmail scan runner tests passed');
})();
