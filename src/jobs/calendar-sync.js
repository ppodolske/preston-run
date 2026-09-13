'use strict';

const {shouldRunCalendarSync}=require('../domain/calendars');
const {createBackgroundSupabaseClient,resolveOwnerUserId}=require('../auth/background-supabase');
const {decodeCredentialKey}=require('../security/credential-crypto');
const {syncCalendars}=require('../services/calendar-sync');

function required(env,key){const value=env[key];if(!value)throw new Error(`${key} is required`);return value;}
function loadCalendarBackgroundConfig(env=process.env){return{
  supabaseUrl:required(env,'SUPABASE_URL'),
  serviceRoleKey:required(env,'SUPABASE_SERVICE_ROLE_KEY'),
  ownerGoogleEmail:required(env,'OWNER_GOOGLE_EMAIL').trim().toLowerCase(),
  calendarCredentialKey:required(env,'CALENDAR_CREDENTIAL_KEY'),
  googleCalendarClientId:required(env,'GOOGLE_CALENDAR_CLIENT_ID'),
  googleCalendarClientSecret:required(env,'GOOGLE_CALENDAR_CLIENT_SECRET')
};}

async function runCalendarSyncJob({now=new Date(),env=process.env,deps={}}={}){
  if(!shouldRunCalendarSync(now))return{skipped:true};
  const config=loadCalendarBackgroundConfig(env);
  const createBackgroundClient=deps.createBackgroundClient||createBackgroundSupabaseClient;
  const ownerResolver=deps.resolveOwnerUserId||resolveOwnerUserId;
  const decodeKey=deps.decodeCredentialKey||decodeCredentialKey;
  const sync=deps.syncCalendars||syncCalendars;
  const supabase=createBackgroundClient(config);
  const userId=await ownerResolver(supabase,config.ownerGoogleEmail);
  const credentialKey=decodeKey(config.calendarCredentialKey);
  const result=await sync({supabase,userId,now,credentialKey,googleConfig:{clientId:config.googleCalendarClientId,clientSecret:config.googleCalendarClientSecret}});
  return{skipped:false,result};
}

async function main(){
  try{
    const out=await runCalendarSyncJob();
    if(out.skipped){console.log('Calendar sync skipped: inactive Sydney schedule twin');return;}
    const rows=out.result&&Array.isArray(out.result.connections)?out.result.connections:[];
    const ok=rows.filter(x=>x.ok).length,failed=rows.length-ok;
    console.log(`Calendar sync complete: ${ok} connection(s) succeeded, ${failed} failed`);
  }catch(error){console.error(`Calendar sync job failed: ${error&&error.message?error.message:'unknown error'}`);process.exitCode=1;}
}
if(require.main===module)main();
module.exports={runCalendarSyncJob,loadCalendarBackgroundConfig};
