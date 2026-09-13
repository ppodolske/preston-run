const assert=require('node:assert/strict');
const {
  getFitnessContext,upsertFitnessContext,getMorningDigest,upsertMorningDigest
}=require('../src/data/fitness-context');

function builder({singleRow=null}={}){
  const calls=[];let payload=null;
  const b={calls,
    select(v='*'){calls.push(['select',v]);return b;},
    upsert(v,o){payload=v;calls.push(['upsert',v,o]);return b;},
    eq(k,v){calls.push(['eq',k,v]);return b;},
    maybeSingle(){calls.push(['maybeSingle']);return Promise.resolve({data:singleRow,error:null});},
    single(){calls.push(['single']);return Promise.resolve({data:singleRow||payload,error:null});}
  };
  return b;
}
function has(b,op,key,val){return b.calls.some(x=>x[0]===op&&(key===undefined||x[1]===key)&&(val===undefined||x[2]===val));}
function ownerFiltered(b){return has(b,'eq','user_id','u1');}

(async()=>{
  let b=builder({singleRow:{user_id:'u1',payload:{schemaVersion:1}}});
  let s={from:t=>{assert.equal(t,'fitness_context_cache');return b;}};
  const context=await getFitnessContext(s,'u1');
  assert.equal(ownerFiltered(b),true);
  assert.equal(context.payload.schemaVersion,1);

  b=builder({singleRow:{user_id:'u1'}});s={from:t=>{assert.equal(t,'fitness_context_cache');return b;}};
  await upsertFitnessContext(s,'u1',{
    payload:{schemaVersion:1,plannedWorkouts:[]},
    sourceGeneratedAt:'2026-09-13T21:00:00Z',
    garminSyncAt:'2026-09-13T20:55:00Z',
    fetchedAt:'2026-09-13T21:15:00Z'
  });
  const contextUpsert=b.calls.find(x=>x[0]==='upsert');
  assert.equal(contextUpsert[1].user_id,'u1');
  assert.equal(contextUpsert[1].payload.schemaVersion,1);
  assert.equal(contextUpsert[1].source_generated_at,'2026-09-13T21:00:00Z');
  assert.equal(contextUpsert[1].garmin_sync_at,'2026-09-13T20:55:00Z');
  assert.equal(contextUpsert[1].fetched_at,'2026-09-13T21:15:00Z');
  assert.equal(contextUpsert[2].onConflict,'user_id');

  b=builder({singleRow:{user_id:'u1',digest_date:'2026-09-13',status:'good'}});s={from:t=>{assert.equal(t,'morning_digests');return b;}};
  const digest=await getMorningDigest(s,'u1','2026-09-13');
  assert.equal(ownerFiltered(b),true);
  assert.ok(has(b,'eq','digest_date','2026-09-13'));
  assert.equal(digest.status,'good');

  b=builder({singleRow:{id:'d1'}});s={from:t=>{assert.equal(t,'morning_digests');return b;}};
  await upsertMorningDigest(s,'u1',{
    date:'2026-09-13',schemaVersion:1,sourceGeneratedAt:'2026-09-13T21:00:00Z',garminSyncAt:'2026-09-13T20:55:00Z',
    status:'watch',headline:'Recovery has a few watch signals.',cards:[{key:'recovery'}],bullets:['Sleep was short.'],generatedAt:'2026-09-13T21:16:00Z'
  });
  const digestUpsert=b.calls.find(x=>x[0]==='upsert');
  assert.equal(digestUpsert[1].user_id,'u1');
  assert.equal(digestUpsert[1].digest_date,'2026-09-13');
  assert.equal(digestUpsert[1].schema_version,1);
  assert.deepEqual(digestUpsert[1].cards,[{key:'recovery'}]);
  assert.deepEqual(digestUpsert[1].bullets,['Sleep was short.']);
  assert.equal(digestUpsert[2].onConflict,'user_id,digest_date');

  await assert.rejects(()=>getFitnessContext(s,''),/Authenticated user/);
  await assert.rejects(()=>getMorningDigest(s,'u1',''),/digest date/i);
  await assert.rejects(()=>upsertFitnessContext(s,'u1',{payload:null}),/payload/i);
  await assert.rejects(()=>upsertMorningDigest(s,'u1',{date:'2026-09-13'}),/status/i);

  console.log('fitness context data tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
