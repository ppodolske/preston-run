const assert=require('node:assert/strict');
const {runFitnessContextSyncJob,runCli,shouldRunFitnessContextSync}=require('../src/jobs/fitness-context-sync');

(async()=>{
  // AEST: 07:15 Sydney = 21:15 UTC previous day.
  assert.equal(shouldRunFitnessContextSync(new Date('2026-09-12T21:15:00Z')),true);
  assert.equal(shouldRunFitnessContextSync(new Date('2026-09-12T20:15:00Z')),false);
  // AEDT: 07:15 Sydney = 20:15 UTC previous day.
  assert.equal(shouldRunFitnessContextSync(new Date('2026-01-14T20:15:00Z')),true);
  assert.equal(shouldRunFitnessContextSync(new Date('2026-01-14T21:15:00Z')),false);

  let refreshCalls=0;
  const skipped=await runFitnessContextSyncJob({
    now:new Date('2026-09-12T20:15:00Z'),
    env:{},
    deps:{refreshFitnessContext:async()=>{refreshCalls+=1}}
  });
  assert.deepEqual(skipped,{skipped:true});
  assert.equal(refreshCalls,0);

  let captured=null;
  const ran=await runFitnessContextSyncJob({
    now:new Date('2026-09-12T21:15:00Z'),
    env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service',OWNER_GOOGLE_EMAIL:'owner@example.com',DOSE_SCALE_CONTEXT_URL:'https://dose.test/api/preston/daily-context',DOSE_SCALE_SERVICE_TOKEN:'secret'},
    deps:{
      createBackgroundClient:config=>({config}),
      resolveOwnerUserId:async()=> 'u1',
      refreshFitnessContext:async args=>{refreshCalls+=1;captured=args;return{ok:true,digestRegenerated:true};}
    }
  });
  assert.equal(ran.skipped,false);
  assert.equal(ran.result.ok,true);
  assert.equal(captured.userId,'u1');
  assert.equal(captured.forceDigest,false);
  assert.equal(captured.now.toISOString(),'2026-09-12T21:15:00.000Z');
  assert.equal(refreshCalls,1);

  const silentLogger={log(){},warn(){},error(){}};
  let exitCode=null;
  await runCli({execute:async()=>({skipped:false,result:{ok:true}}),logger:silentLogger,exit:code=>{exitCode=code;}});
  assert.equal(exitCode,0);

  exitCode=null;
  await runCli({execute:async()=>{throw new Error('boom')},logger:silentLogger,exit:code=>{exitCode=code;}});
  assert.equal(exitCode,1);

  console.log('fitness context job tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
