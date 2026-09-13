const assert=require('node:assert/strict');
const {runReminderJob,loadBackgroundConfig}=require('../src/jobs/reminders');

function harness(){const calls={client:0,morning:0,urgent:[]};return{calls,deps:{createBackgroundClient:()=>{calls.client++;return{};},resolveOwnerUserId:async()=> 'u1',createTransport:()=>({send:async()=>{}}),runMorning:async()=>{calls.morning++;return{sent:false};},runUrgent:async args=>{calls.urgent.push(args.mode);return{sent:false};}}};}
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'secret',OWNER_GOOGLE_EMAIL:'owner@example.com',VAPID_PUBLIC_KEY:'public',VAPID_PRIVATE_KEY:'private',VAPID_SUBJECT:'mailto:owner@example.com'};

(async()=>{
  let h=harness();let out=await runReminderJob({mode:'morning',now:new Date('2026-07-01T20:05:00Z'),env,deps:h.deps});assert.equal(out.skipped,true);assert.equal(h.calls.client,0,'inactive DST twin must not create privileged client');
  h=harness();await runReminderJob({mode:'morning',now:new Date('2026-07-01T21:05:00Z'),env,deps:h.deps});assert.equal(h.calls.client,1);assert.equal(h.calls.morning,1);
  h=harness();await runReminderJob({mode:'morning',now:new Date('2026-01-01T20:05:00Z'),env,deps:h.deps});assert.equal(h.calls.morning,1,'AEDT morning should run at UTC 20:05');
  h=harness();await runReminderJob({mode:'noon',now:new Date('2026-07-02T02:00:00Z'),env,deps:h.deps});assert.deepEqual(h.calls.urgent,['noon']);
  h=harness();await runReminderJob({mode:'noon',now:new Date('2026-01-02T01:00:00Z'),env,deps:h.deps});assert.deepEqual(h.calls.urgent,['noon']);
  h=harness();await runReminderJob({mode:'evening',now:new Date('2026-07-02T08:00:00Z'),env,deps:h.deps});assert.deepEqual(h.calls.urgent,['evening']);
  h=harness();await runReminderJob({mode:'evening',now:new Date('2026-01-02T07:00:00Z'),env,deps:h.deps});assert.deepEqual(h.calls.urgent,['evening']);
  assert.throws(()=>loadBackgroundConfig({}),/SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY/);
  await assert.rejects(()=>runReminderJob({mode:'morning',now:new Date('2026-07-01T21:05:00Z'),env:{SUPABASE_URL:'x'},deps:harness().deps}),/SUPABASE_SERVICE_ROLE_KEY/);
  await assert.rejects(()=>runReminderJob({mode:'bad',now:new Date(),env,deps:harness().deps}),/mode/i);
  console.log('reminder job tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
