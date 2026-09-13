'use strict';

const {createBackgroundSupabaseClient,resolveOwnerUserId}=require('../auth/background-supabase');
const {refreshFitnessContext}=require('../services/fitness-context');

const SYDNEY_TZ='Australia/Sydney';

function required(env,key){const value=env[key];if(!value)throw new Error(`${key} is required`);return value;}
function sydneyParts(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-AU',{timeZone:SYDNEY_TZ,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const out={};for(const p of parts)if(p.type!=='literal')out[p.type]=Number(p.value);return out;
}
function shouldRunFitnessContextSync(now=new Date()){
  const p=sydneyParts(now);return p.hour===7&&p.minute===15;
}
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

async function main(){
  try{
    const out=await runFitnessContextSyncJob();
    if(out.skipped){console.log('Fitness context sync skipped: inactive Sydney schedule twin');return;}
    if(out.result&&out.result.ok){console.log(`Fitness context sync complete${out.result.digestRegenerated?' with digest refresh':''}`);return;}
    console.warn('Fitness context sync failed; retained last-good cached context and digest');
  }catch(error){
    console.error(`Fitness context sync job failed: ${error&&error.message?error.message:'unknown error'}`);
    process.exitCode=1;
  }
}

if(require.main===module)main();
module.exports={runFitnessContextSyncJob,loadFitnessBackgroundConfig,shouldRunFitnessContextSync};
