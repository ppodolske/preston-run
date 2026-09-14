const assert=require('node:assert/strict');
const {runGmailManualScanJob}=require('../src/jobs/gmail-manual-scan');

(async()=>{
  const env={SUPABASE_SERVICE_ROLE_KEY:'service-role'};
  const config={supabaseUrl:'https://example.supabase.co',ownerGoogleEmail:'owner@example.com'};
  const supabase={name:'background-client'};
  const calls=[];
  const deps={
    loadConfig:()=>config,
    createBackgroundClient:input=>{calls.push(['createBackgroundClient',input]);return supabase;},
    resolveOwnerUserId:async(client,email)=>{calls.push(['resolveOwnerUserId',client,email]);return'u1';},
    getGmailConnection:async(client,userId)=>{calls.push(['getGmailConnection',client,userId]);return{id:'conn1',status:'connected'};},
    listRecentScans:async(client,userId,limit)=>{calls.push(['listRecentScans',client,userId,limit]);return[];},
    startManualGmailScan:async(client,userId,receivedConfig)=>{calls.push(['startManualGmailScan',client,userId,receivedConfig]);return{status:'succeeded',discoveredCount:7,processedCount:7,relevantCount:2,tripCount:1,lifeAdminCount:1,ignoredCount:5,recordsCreatedCount:1,recordsUpdatedCount:0,reviewItemsCreatedCount:0,pdfUnreadableCount:0};}
  };

  const out=await runGmailManualScanJob({env,deps});
  assert.deepEqual(out,{status:'succeeded',discoveredCount:7,processedCount:7,relevantCount:2,tripCount:1,lifeAdminCount:1,ignoredCount:5,recordsCreatedCount:1,recordsUpdatedCount:0,reviewItemsCreatedCount:0,pdfUnreadableCount:0});
  assert.deepEqual(calls[0],['createBackgroundClient',{supabaseUrl:config.supabaseUrl,serviceRoleKey:'service-role'}]);
  assert.deepEqual(calls.find(c=>c[0]==='resolveOwnerUserId').slice(1),[supabase,'owner@example.com']);
  assert.equal(calls.filter(c=>c[0]==='startManualGmailScan').length,1);

  let started=false;
  await assert.rejects(()=>runGmailManualScanJob({env,deps:{...deps,listRecentScans:async()=>[{status:'running'}],startManualGmailScan:async()=>{started=true;return{status:'succeeded'};}}}),/active Gmail scan/i);
  assert.equal(started,false,'active scan guard must prevent a duplicate scan');

  await assert.rejects(()=>runGmailManualScanJob({env,deps:{...deps,getGmailConnection:async()=>null}}),/connected Gmail account/i);
  await assert.rejects(()=>runGmailManualScanJob({env,deps:{...deps,startManualGmailScan:async()=>({status:'failed',error:'provider failure'})}}),/Gmail scan failed: provider failure/i);
  await assert.rejects(()=>runGmailManualScanJob({env:{},deps}),/SUPABASE_SERVICE_ROLE_KEY is required/i);

  console.log('gmail manual scan job tests passed');
})().catch(error=>{console.error(error);process.exit(1);});
