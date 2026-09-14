'use strict';

const {createBackgroundSupabaseClient,resolveOwnerUserId}=require('../auth/background-supabase');
const {refreshFitnessContext}=require('../services/fitness-context');
const {withinSydneyWindow}=require('../domain/schedule');

function required(env,key){const value=env[key];if(!value)throw new Error(`${key} is required`);return value;}
function shouldRunFitnessContextSync(now=new Date()){return withinSydneyWindow(now,7,0,15);}
function loadFitnessBackgroundConfig(env=process.env){return{
  supabaseUrl:required(env,'SUPABASE_URL'),
  serviceRoleKey:required(env,'SUPABASE_SERVICE_ROLE_KEY'),
  ownerGoogleEmail:required(env,'OWNER_GOOGLE_EMAIL').trim().toLowerCase(),
  doseScaleContextUrl:required(env,'DOSE_SCALE_CONTEXT_URL'),
  doseScaleServiceToken:required(env,'DOSE_SCALE_SERVICE_TOKEN')
};}

async function runFitnessContextSyncJob({now=new Date(),env=process.env,deps={}}={}){
  if(!shouldRunFitnessContextSync(now))return{skipped:true};
  const config=loadFitnessBackgroundConfig(env);
  const createBackgroundClient=deps.createBackgroundClient||createBackgroundSupabaseClient;
  const ownerResolver=deps.resolveOwnerUserId||resolveOwnerUserId;
  const refresh=deps.refreshFitnessContext||refreshFitnessContext;
  const supabase=createBackgroundClient(config);
  const userId=await ownerResolver(supabase,config.ownerGoogleEmail);
  const result=await refresh({supabase,userId,now,forceDigest:false});
  return{skipped:false,result};
}

async function runCli({execute=runFitnessContextSyncJob,logger=console,exit=process.exit}={}){
  let code=0;
  try{
    const out=await execute();
    if(out.skipped)logger.log('Fitness context sync skipped: inactive Sydney schedule twin');
    else if(out.result&&out.result.ok)logger.log(`Fitness context sync complete${out.result.digestRegenerated?' with digest refresh':''}`);
    else logger.warn('Fitness context sync failed; retained last-good cached context and digest');
  }catch(error){
    logger.error(`Fitness context sync job failed: ${error&&error.message?error.message:'unknown error'}`);
    code=1;
  }
  exit(code);
}

if(require.main===module)runCli();
module.exports={runFitnessContextSyncJob,runCli,loadFitnessBackgroundConfig,shouldRunFitnessContextSync};
