const assert=require('node:assert/strict');
const {refreshFitnessContext}=require('../src/services/fitness-context');

(async()=>{
  let writes=0;
  const failed=await refreshFitnessContext({
    supabase:{},
    userId:'u1',
    fetchContext:async()=>{throw new Error('down')},
    now:new Date('2026-09-13T21:15:00Z'),
    deps:{upsertFitnessContext:async()=>{writes+=1}}
  });
  assert.equal(failed.ok,false);
  assert.equal(writes,0,'failed fetch must not replace last-good cache');

  let saved=null;
  const payload={schemaVersion:1,generatedAt:'2026-09-13T21:10:00Z',garminSyncAt:'2026-09-13T20:55:00Z',plannedWorkouts:[]};
  const success=await refreshFitnessContext({
    supabase:{},
    userId:'u1',
    fetchContext:async()=>payload,
    now:new Date('2026-09-13T21:15:00Z'),
    forceDigest:true,
    deps:{upsertFitnessContext:async(_supabase,userId,input)=>{writes+=1;saved={userId,input};return{user_id:userId}}}
  });
  assert.equal(success.ok,true);
  assert.equal(success.payload,payload);
  assert.equal(success.forceDigest,true);
  assert.equal(writes,1);
  assert.deepEqual(saved,{
    userId:'u1',
    input:{payload,sourceGeneratedAt:'2026-09-13T21:10:00Z',garminSyncAt:'2026-09-13T20:55:00Z',fetchedAt:'2026-09-13T21:15:00.000Z'}
  });

  await assert.rejects(()=>refreshFitnessContext({supabase:{},userId:'',fetchContext:async()=>payload}),/user/i);
  console.log('fitness context service tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
