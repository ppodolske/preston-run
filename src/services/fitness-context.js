'use strict';

const {fetchDoseScaleContext}=require('./dose-scale-client');
const defaultData=require('../data/fitness-context');
const defaultDomain=require('../domain/morning-digest');

const SYDNEY_TZ='Australia/Sydney';

function sydneyDateKey(value=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:SYDNEY_TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value);
  const get=type=>parts.find(part=>part.type===type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

async function defaultFetchContext(){
  return fetchDoseScaleContext({
    url:process.env.DOSE_SCALE_CONTEXT_URL,
    token:process.env.DOSE_SCALE_SERVICE_TOKEN
  });
}

async function refreshFitnessContext({supabase,userId,fetchContext=defaultFetchContext,now=new Date(),forceDigest=false,deps={}}={}){
  if(!supabase)throw new Error('Supabase client is required');
  if(!userId)throw new Error('Fitness context user is required');
  if(typeof fetchContext!=='function')throw new Error('Fitness context fetcher is required');
  if(!(now instanceof Date)||Number.isNaN(now.getTime()))throw new Error('Fitness context refresh time is invalid');
  const upsertFitnessContext=deps.upsertFitnessContext||defaultData.upsertFitnessContext;
  const getMorningDigest=deps.getMorningDigest||defaultData.getMorningDigest;
  const upsertMorningDigest=deps.upsertMorningDigest||defaultData.upsertMorningDigest;
  const buildMorningDigest=deps.buildMorningDigest||defaultDomain.buildMorningDigest;
  try{
    const payload=await fetchContext();
    await upsertFitnessContext(supabase,userId,{
      payload,
      sourceGeneratedAt:payload.generatedAt||null,
      garminSyncAt:payload.garminSyncAt||null,
      fetchedAt:now.toISOString()
    });

    const dateKey=sydneyDateKey(now);
    const currentDigest=await getMorningDigest(supabase,userId,dateKey);
    const currentSource=currentDigest?.source_generated_at??currentDigest?.sourceGeneratedAt??null;
    const nextSource=payload.generatedAt||null;
    const regenerate=Boolean(forceDigest)||!currentDigest||currentSource!==nextSource;
    let digest=currentDigest;
    if(regenerate){
      digest=buildMorningDigest(payload,dateKey,now);
      await upsertMorningDigest(supabase,userId,digest);
    }
    return {ok:true,payload,digest,forceDigest:Boolean(forceDigest)};
  }catch(error){
    return {ok:false,error};
  }
}

module.exports={refreshFitnessContext,sydneyDateKey};
