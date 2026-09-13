const assert=require('node:assert/strict');
const {startGmailScanRun,finishGmailScanRun,failGmailScanRun}=require('../src/data/gmail-scans');

function fakeSupabase(){
  const calls=[];
  const chain={
    insert(row){calls.push(['insert',row]);return chain;},
    update(row){calls.push(['update',row]);return chain;},
    select(cols){calls.push(['select',cols]);return chain;},
    eq(col,val){calls.push(['eq',col,val]);return chain;},
    single(){calls.push(['single']);return Promise.resolve({data:{id:'scan1'},error:null});}
  };
  return {calls,from(table){calls.push(['from',table]);return chain;}};
}

(async()=>{
  const supabase=fakeSupabase();
  await startGmailScanRun(supabase,'user1',{id:'conn1'},'initial',{scannerVersion:'scanner1',lookbackStartAt:'2025-09-13T00:00:00Z'});
  assert.equal(supabase.calls[0][1],'gmail_scan_runs');
  assert.equal(supabase.calls[1][1].scan_type,'initial');
  assert.equal(supabase.calls[1][1].status,'running');

  const supabase2=fakeSupabase();
  await finishGmailScanRun(supabase2,'user1','conn1','scan1',{checkpointReceivedAt:'2026-09-13T00:00:00Z',checkpointMessageId:'msg9',firstScanCompleted:true});
  const scanUpdate=supabase2.calls.find(call=>call[0]==='update'&&call[1].status==='succeeded');
  const connectionUpdate=supabase2.calls.find(call=>call[0]==='update'&&call[1].checkpoint_message_id==='msg9');
  assert.equal(scanUpdate[1].status,'succeeded');
  assert.equal(connectionUpdate[1].checkpoint_message_id,'msg9');
  assert.equal(Boolean(connectionUpdate[1].first_scan_completed_at),true);

  const supabase3=fakeSupabase();
  await failGmailScanRun(supabase3,'user1','conn1','scan1','google timeout');
  const failedScan=supabase3.calls.find(call=>call[0]==='update'&&call[1].status==='failed');
  const degradedConnection=supabase3.calls.find(call=>call[0]==='update'&&call[1].last_error==='google timeout');
  assert.equal(failedScan[1].status,'failed');
  assert.equal(degradedConnection[1].last_error,'google timeout');
  console.log('gmail scan lifecycle tests passed');
})();
