const assert=require('node:assert/strict');
let runCalendarSyncJob,loadCalendarBackgroundConfig;try{({runCalendarSyncJob,loadCalendarBackgroundConfig}=require('../src/jobs/calendar-sync'));}catch(e){assert.fail(`Calendar sync job module required: ${e.message}`);}

const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service-secret',OWNER_GOOGLE_EMAIL:'owner@example.com',CALENDAR_CREDENTIAL_KEY:'calendar-key',GOOGLE_CALENDAR_CLIENT_ID:'calendar-client',GOOGLE_CALENDAR_CLIENT_SECRET:'calendar-secret'};
function harness(){const calls={client:0,owner:0,sync:0,args:null};return{calls,deps:{createBackgroundClient:config=>{calls.client++;assert.equal(Object.hasOwn(config,'vapidPrivateKey'),false);return{};},resolveOwnerUserId:async()=>{calls.owner++;return'u1';},decodeCredentialKey:value=>{assert.equal(value,'calendar-key');return Buffer.alloc(32,1);},syncCalendars:async args=>{calls.sync++;calls.args=args;return{connections:[{provider:'google',ok:true},{provider:'apple',ok:false}]};}}};}

(async()=>{
  let h=harness();let out=await runCalendarSyncJob({now:new Date('2026-07-01T19:55:00Z'),env,deps:h.deps});assert.equal(out.skipped,true);assert.equal(h.calls.client,0,'inactive AEST twin must exit before privileged client creation');assert.equal(h.calls.owner,0);assert.equal(h.calls.sync,0);
  h=harness();out=await runCalendarSyncJob({now:new Date('2026-07-01T20:55:00Z'),env,deps:h.deps});assert.equal(out.skipped,false);assert.equal(h.calls.client,1);assert.equal(h.calls.owner,1);assert.equal(h.calls.sync,1);assert.equal(h.calls.args.userId,'u1');assert.equal(h.calls.args.googleConfig.clientId,'calendar-client');assert.equal(h.calls.args.googleConfig.clientSecret,'calendar-secret');assert.ok(Buffer.isBuffer(h.calls.args.credentialKey));
  h=harness();out=await runCalendarSyncJob({now:new Date('2026-01-01T20:55:00Z'),env,deps:h.deps});assert.equal(out.skipped,true);assert.equal(h.calls.client,0,'inactive AEDT twin must exit before privileged client creation');
  h=harness();out=await runCalendarSyncJob({now:new Date('2026-01-01T19:55:00Z'),env,deps:h.deps});assert.equal(out.skipped,false);assert.equal(h.calls.sync,1,'AEDT 06:55 should execute');
  const config=loadCalendarBackgroundConfig(env);assert.equal(config.ownerGoogleEmail,'owner@example.com');assert.equal(Object.hasOwn(config,'vapidPrivateKey'),false);assert.equal(Object.hasOwn(config,'vapidPublicKey'),false);assert.equal(Object.hasOwn(config,'vapidSubject'),false);
  for(const missing of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','OWNER_GOOGLE_EMAIL','CALENDAR_CREDENTIAL_KEY','GOOGLE_CALENDAR_CLIENT_ID','GOOGLE_CALENDAR_CLIENT_SECRET']){const copy={...env};delete copy[missing];assert.throws(()=>loadCalendarBackgroundConfig(copy),new RegExp(missing));}
  console.log('calendar sync job tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
