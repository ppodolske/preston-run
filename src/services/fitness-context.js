'use strict';

const {fetchDoseScaleContext}=require('./dose-scale-client');
const defaultData=require('../data/fitness-context');

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
  try{
    const payload=await fetchContext();
    await upsertFitnessContext(supabase,userId,{
      payload,
      sourceGeneratedAt:payload.generatedAt||null,
      garminSyncAt:payload.garminSyncAt||null,
      fetchedAt:now.toISOString()
    });
    return {ok:true,payload,forceDigest:Boolean(forceDigest)};
  }catch(error){
    return {ok:false,error};
  }
}

module.exports={refreshFitnessContext};
