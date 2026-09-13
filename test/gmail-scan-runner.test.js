const assert=require('node:assert/strict');
const {determineScanWindow,runGmailScan}=require('../src/services/gmail-scan-runner');

const initial=determineScanWindow({first_scan_completed_at:null},new Date('2026-09-13T12:00:00Z'),12);
assert.equal(initial.scanType,'initial');
assert.equal(initial.after,'2025/09/13');

const incremental=determineScanWindow({first_scan_completed_at:'2026-09-13T01:00:00Z',checkpoint_received_at:'2026-09-12T00:00:00Z'},new Date('2026-09-13T12:00:00Z'),12);
assert.equal(incremental.scanType,'manual_incremental');
assert.equal(incremental.after,'2026/09/12');

(async()=>{
  const processed=[];
  const result=await runGmailScan({
    supabase:{},
    userId:'user1',
    connection:{id:'conn1',gmail_account_email:'me@example.com',first_scan_completed_at:null},
    provider:{
      listMessages:async()=>({messages:[{id:'m1'}]}),
      getMessage:async()=>({id:'m1',threadId:'t1',labelIds:['INBOX'],internalDate:String(Date.parse('2026-09-13T00:00:00Z')),payload:{headers:[{name:'Subject',value:'Flight QF401 booking ABC123'}]}})
    },
    config:{scannerVersion:'scanner1',parserVersion:'parser1',initialLookbackMonths:12},
    existingTrips:[],
    persistence:{
      startScan:async()=>({id:'scan1'}),
      upsertSource:async(row)=>{processed.push(row.gmail_message_id);return {id:'src1',...row};},
      insertFacts:async()=>[],
      finishScan:async()=>({}),
      failScan:async()=>({})
    }
  });
  assert.equal(result.status,'succeeded');
  assert.deepEqual(processed,['m1']);
  console.log('gmail scan runner tests passed');
})();
