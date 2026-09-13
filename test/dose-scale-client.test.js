const assert=require('node:assert/strict');
const {fetchDoseScaleContext}=require('../src/services/dose-scale-client');

(async()=>{
  let calls=0;
  const payload=await fetchDoseScaleContext({
    fetchImpl:async(url,opts)=>{
      calls+=1;
      assert.equal(url,'https://dose.test/api/preston/daily-context');
      assert.equal(opts.headers.Authorization,'Bearer secret');
      assert.equal(opts.cache,'no-store');
      assert.equal(opts.method,'GET');
      return {ok:true,status:200,json:async()=>({schemaVersion:1,plannedWorkouts:[]})};
    },
    url:'https://dose.test/api/preston/daily-context',
    token:'secret',
    timeoutMs:1000
  });
  assert.equal(calls,1);
  assert.equal(payload.schemaVersion,1);

  await assert.rejects(()=>fetchDoseScaleContext({fetchImpl:async()=>{},url:'',token:'secret'}),/URL/i);
  await assert.rejects(()=>fetchDoseScaleContext({fetchImpl:async()=>{},url:'https://dose.test',token:''}),/token/i);
  await assert.rejects(()=>fetchDoseScaleContext({fetchImpl:async()=>({ok:false,status:503,json:async()=>({})}),url:'https://dose.test',token:'secret'}),/503/);
  await assert.rejects(()=>fetchDoseScaleContext({fetchImpl:async()=>({ok:true,status:200,json:async()=>({schemaVersion:2,plannedWorkouts:[]})}),url:'https://dose.test',token:'secret'}),/schema/i);
  await assert.rejects(()=>fetchDoseScaleContext({fetchImpl:async()=>({ok:true,status:200,json:async()=>({schemaVersion:1,plannedWorkouts:null})}),url:'https://dose.test',token:'secret'}),/plannedWorkouts/i);

  console.log('dose scale client tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
