const assert=require('node:assert/strict');
const {runGmailScan}=require('../src/services/gmail-scan-runner');

function provider({subject,snippet='',sender='Sender <sender@example.com>'}){
  return {
    listMessages:async()=>({messages:[{id:'m1'}]}),
    getMessage:async()=>({
      id:'m1',threadId:'t1',labelIds:['INBOX'],internalDate:String(Date.parse('2026-09-13T00:00:00Z')),snippet,
      payload:{headers:[{name:'From',value:sender},{name:'Subject',value:subject}]}
    })
  };
}

function persistence(progress,statuses){
  return {
    startScan:async()=>({id:'scan1'}),
    upsertSource:async(row)=>({id:'src1',...row}),
    insertFacts:async(facts)=>facts,
    updateScanProgress:async(_id,patch)=>progress.push({...patch}),
    updateSourceStatus:async(sourceId,patch)=>statuses.push({sourceId,patch}),
    finishScan:async()=>({}),
    failScan:async()=>({})
  };
}

async function runCase(message,{tripActions={},lifeAdminActions={}}={}){
  const progress=[];
  const statuses=[];
  const result=await runGmailScan({
    supabase:{},userId:'user1',connection:{id:'conn1',gmail_account_email:'me@example.com',first_scan_completed_at:null},
    provider:provider(message),config:{scannerVersion:'scanner2',parserVersion:'parser2',initialLookbackMonths:12},existingTrips:[],
    persistence:persistence(progress,statuses),actions:tripActions,lifeAdminActions
  });
  return {result,progress,statuses};
}

(async()=>{
  const life=[];
  const physio=await runCase({sender:'Physiotherapy <noreply@nookal.com>',subject:'Booking Confirmation - Physiotherapy',snippet:'Your appointment is confirmed.'},{
    tripActions:{applyCreateTripFromGmail:async()=>assert.fail('physio must not create a trip')},
    lifeAdminActions:{createLifeAdminItem:async(source,candidate,classification)=>life.push({source,candidate,classification})}
  });
  assert.equal(physio.result.status,'succeeded');
  assert.equal(physio.result.lifeAdminCount,1);
  assert.equal(physio.result.tripCount,0);
  assert.equal(physio.result.reviewItemsCreatedCount,0);
  assert.equal(life.length,1);
  assert.equal(life[0].candidate.category,'appointment');
  assert.equal(life[0].source.id,'src1');

  const reviews=[];
  const ambiguous=await runCase({sender:'Uber <no-reply@uber.com>',subject:'Reservation confirmed for Sunday 5 July'},{
    tripActions:{applyCreateTripFromGmail:async()=>assert.fail('ambiguous booking must not create a trip')},
    lifeAdminActions:{createReviewItem:async(source,classification)=>reviews.push({source,classification})}
  });
  assert.equal(ambiguous.result.tripCount,0);
  assert.equal(ambiguous.result.lifeAdminCount,0);
  assert.equal(ambiguous.result.reviewItemsCreatedCount,1);
  assert.equal(reviews.length,1);

  const marketing=await runCase({sender:'Commonwealth Bank <No-reply@edm.cba.com.au>',subject:'Preston, book your next holiday with your CommBank credit card'});
  assert.equal(marketing.result.ignoredCount,1);
  assert.equal(marketing.result.relevantCount,0);
  assert.equal(marketing.result.tripCount,0);
  assert.equal(marketing.result.lifeAdminCount,0);

  const trips=[];
  const flight=await runCase({sender:'Virgin Australia <no-reply@virginaustralia.com>',subject:'Your Virgin Australia Travel Reminder',snippet:'Flight VA123. Booking reference ABC123.'},{
    tripActions:{getManualFieldsForMatch:async()=>new Set(),applyCreateTripFromGmail:async(decision)=>trips.push(decision)}
  });
  assert.equal(flight.result.tripCount,1);
  assert.equal(flight.result.lifeAdminCount,0);
  assert.equal(flight.result.relevantCount,1);
  assert.equal(trips.length,1);
  assert.equal(flight.progress.at(-1).tripCount,1);
  assert.equal(flight.progress.at(-1).lifeAdminCount,0);

  for(const row of [physio,ambiguous,marketing,flight]){
    assert.deepEqual(row.statuses,[{sourceId:'src1',patch:{processing_status:'processed',processing_reason:null}}]);
  }

  console.log('gmail scan routing tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
