const assert=require('node:assert/strict');
const {runScheduledGmailSyncJob,shouldRunScheduledGmailMode}=require('../src/jobs/gmail-scheduled-sync');

function harness({recentScans=[]}={}){
  const calls=[];
  const deps={
    loadConfig:()=>({supabaseUrl:'https://example.supabase.co',ownerGoogleEmail:'owner@example.com',calendarCredentialKey:'key',gmail:{}}),
    createBackgroundClient:()=>({db:true}),
    resolveOwnerUserId:async()=> 'u1',
    listRecentScans:async()=>recentScans,
    startManualGmailScan:async()=>{calls.push('scan');return{status:'succeeded',recordsCreatedCount:1};},
    createTransport:()=>({send:async()=>({statusCode:201})}),
    runUrgent:async({mode})=>{calls.push(`urgent:${mode}`);return{sent:false};}
  };
  return{calls,deps};
}

(async()=>{
  // 06:45 Gmail sync is DST-safe and delay tolerant.
  assert.equal(shouldRunScheduledGmailMode('morning',new Date('2026-07-01T20:45:00Z')),true);
  assert.equal(shouldRunScheduledGmailMode('morning',new Date('2026-07-01T20:55:00Z')),true);
  assert.equal(shouldRunScheduledGmailMode('morning',new Date('2026-07-01T21:00:00Z')),false);
  assert.equal(shouldRunScheduledGmailMode('morning',new Date('2026-01-01T19:45:00Z')),true);
  assert.equal(shouldRunScheduledGmailMode('morning',new Date('2026-01-01T20:45:00Z')),false);
  assert.equal(shouldRunScheduledGmailMode('noon',new Date('2026-07-02T02:08:00Z')),true);
  assert.equal(shouldRunScheduledGmailMode('evening',new Date('2026-07-02T08:08:00Z')),true);
  assert.equal(shouldRunScheduledGmailMode('night',new Date('2026-07-02T11:08:00Z')),true);
  assert.throws(()=>shouldRunScheduledGmailMode('bad',new Date()),/mode/i);

  let h=harness();
  let out=await runScheduledGmailSyncJob({mode:'morning',now:new Date('2026-07-01T20:50:00Z'),env:{},deps:h.deps});
  assert.equal(out.skipped,false);assert.deepEqual(h.calls,['scan'],'06:45 slot should sync Gmail without an urgent push');

  h=harness();
  out=await runScheduledGmailSyncJob({mode:'noon',now:new Date('2026-07-02T02:04:00Z'),env:{},deps:h.deps});
  assert.equal(out.skipped,false);assert.deepEqual(h.calls,['scan','urgent:noon'],'noon must run Gmail before checking all urgent items');

  h=harness({recentScans:[{status:'succeeded',started_at:'2026-07-02T02:01:00.000Z'}]});
  out=await runScheduledGmailSyncJob({mode:'noon',now:new Date('2026-07-02T02:06:00Z'),env:{},deps:h.deps});
  assert.equal(out.scanSkipped,true,'a completed scan in the same slot must make a retry idempotent');
  assert.deepEqual(h.calls,['urgent:noon'],'urgent notification must still be evaluated on an idempotent retry');

  h=harness();
  await runScheduledGmailSyncJob({mode:'evening',now:new Date('2026-07-02T08:03:00Z'),env:{},deps:h.deps});
  assert.deepEqual(h.calls,['scan','urgent:evening']);

  h=harness();
  await runScheduledGmailSyncJob({mode:'night',now:new Date('2026-07-02T11:03:00Z'),env:{},deps:h.deps});
  assert.deepEqual(h.calls,['scan','urgent:night']);

  h=harness();
  out=await runScheduledGmailSyncJob({mode:'noon',now:new Date('2026-07-02T02:20:00Z'),env:{},deps:h.deps});
  assert.equal(out.skipped,true);assert.deepEqual(h.calls,[],'outside the grace window no privileged work should start');

  console.log('gmail scheduled sync job tests passed');
})().catch(error=>{console.error(error);process.exit(1);});
