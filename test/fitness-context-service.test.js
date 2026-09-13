const assert=require('node:assert/strict');
const {refreshFitnessContext}=require('../src/services/fitness-context');

(async()=>{
  let contextWrites=0,digestWrites=0,digestBuilds=0,digestReads=0;
  const failed=await refreshFitnessContext({
    supabase:{},
    userId:'u1',
    fetchContext:async()=>{throw new Error('down')},
    now:new Date('2026-09-12T22:15:00Z'),
    deps:{
      upsertFitnessContext:async()=>{contextWrites+=1},
      getMorningDigest:async()=>{digestReads+=1},
      upsertMorningDigest:async()=>{digestWrites+=1},
      buildMorningDigest:()=>{digestBuilds+=1;return{}}
    }
  });
  assert.equal(failed.ok,false);
  assert.equal(contextWrites,0,'failed fetch must not replace last-good cache');
  assert.equal(digestReads,0,'failed fetch must not inspect/regenerate digest');
  assert.equal(digestBuilds,0,'failed fetch must not build digest');
  assert.equal(digestWrites,0,'failed fetch must not replace digest');

  const payload={
    schemaVersion:1,
    generatedAt:'2026-09-12T22:10:00Z',
    garminSyncAt:'2026-09-12T21:55:00Z',
    recovery:null,baseline:{days:0},weightTrend:null,recentTraining:{sessions:0,runs:0,lifts:0,distanceKm:0},phase:null,intervention:null,plannedWorkouts:[],actualActivities:[]
  };
  let savedContext=null,savedDigest=null;
  const generatedDigest={schemaVersion:1,date:'2026-09-13',status:'insufficient',headline:'Waiting',cards:[],bullets:[],generatedAt:'2026-09-12T22:15:00.000Z',sourceGeneratedAt:payload.generatedAt,garminSyncAt:payload.garminSyncAt};
  const success=await refreshFitnessContext({
    supabase:{},userId:'u1',fetchContext:async()=>payload,now:new Date('2026-09-12T22:15:00Z'),
    deps:{
      upsertFitnessContext:async(_supabase,userId,input)=>{contextWrites+=1;savedContext={userId,input}},
      getMorningDigest:async(_supabase,userId,dateKey)=>{digestReads+=1;assert.equal(userId,'u1');assert.equal(dateKey,'2026-09-13');return null},
      buildMorningDigest:(context,dateKey,now)=>{digestBuilds+=1;assert.equal(context,payload);assert.equal(dateKey,'2026-09-13');assert.equal(now.toISOString(),'2026-09-12T22:15:00.000Z');return generatedDigest},
      upsertMorningDigest:async(_supabase,userId,digest)=>{digestWrites+=1;savedDigest={userId,digest}}
    }
  });
  assert.equal(success.ok,true);
  assert.equal(success.payload,payload);
  assert.equal(success.digest,generatedDigest);
  assert.equal(contextWrites,1);
  assert.equal(digestReads,1);
  assert.equal(digestBuilds,1);
  assert.equal(digestWrites,1);
  assert.equal(savedContext.userId,'u1');
  assert.equal(savedDigest.userId,'u1');
  assert.equal(savedDigest.digest,generatedDigest);

  // Same source timestamp: keep current digest unless forceDigest is true.
  digestBuilds=0;digestWrites=0;
  const existing={...generatedDigest,id:'d1'};
  const unchanged=await refreshFitnessContext({
    supabase:{},userId:'u1',fetchContext:async()=>payload,now:new Date('2026-09-12T22:20:00Z'),
    deps:{
      upsertFitnessContext:async()=>{},
      getMorningDigest:async()=>existing,
      buildMorningDigest:()=>{digestBuilds+=1;return generatedDigest},
      upsertMorningDigest:async()=>{digestWrites+=1}
    }
  });
  assert.equal(unchanged.ok,true);
  assert.equal(unchanged.digest,existing);
  assert.equal(digestBuilds,0);
  assert.equal(digestWrites,0);

  digestBuilds=0;digestWrites=0;
  const forced=await refreshFitnessContext({
    supabase:{},userId:'u1',fetchContext:async()=>payload,now:new Date('2026-09-12T22:25:00Z'),forceDigest:true,
    deps:{
      upsertFitnessContext:async()=>{},
      getMorningDigest:async()=>existing,
      buildMorningDigest:()=>{digestBuilds+=1;return generatedDigest},
      upsertMorningDigest:async()=>{digestWrites+=1}
    }
  });
  assert.equal(forced.ok,true);
  assert.equal(digestBuilds,1);
  assert.equal(digestWrites,1);

  // A changed source timestamp regenerates without force.
  digestBuilds=0;digestWrites=0;
  const newerPayload={...payload,generatedAt:'2026-09-12T22:30:00Z'};
  await refreshFitnessContext({
    supabase:{},userId:'u1',fetchContext:async()=>newerPayload,now:new Date('2026-09-12T22:31:00Z'),
    deps:{
      upsertFitnessContext:async()=>{},
      getMorningDigest:async()=>existing,
      buildMorningDigest:()=>{digestBuilds+=1;return{...generatedDigest,sourceGeneratedAt:newerPayload.generatedAt}},
      upsertMorningDigest:async()=>{digestWrites+=1}
    }
  });
  assert.equal(digestBuilds,1);
  assert.equal(digestWrites,1);

  await assert.rejects(()=>refreshFitnessContext({supabase:{},userId:'',fetchContext:async()=>payload}),/user/i);
  console.log('fitness context service tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
