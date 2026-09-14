'use strict';

const {createBackgroundSupabaseClient,resolveOwnerUserId}=require('../auth/background-supabase');
const {getGmailConnection}=require('../data/gmail-connections');
const {decodeCredentialKey}=require('../security/credential-crypto');
const {resolveGmailAccessToken}=require('../services/gmail-access-token');
const {createGmailProvider}=require('../services/gmail-provider');
const {TARGET_SCAN_IDS}=require('../services/gmail-life-admin-backfill');

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function safeError(error){
  const body=error&&error.body||{};
  const detail=body&&body.error||{};
  const reasons=Array.isArray(detail.errors)?detail.errors.map(item=>item&&item.reason).filter(Boolean):[];
  return {status:error&&error.status||null,apiStatus:detail.status||null,reasons,message:error&&error.message||'unknown'};
}

async function main({env=process.env,fetchImpl=global.fetch}={}){
  const supabase=createBackgroundSupabaseClient({supabaseUrl:env.SUPABASE_URL,serviceRoleKey:env.SUPABASE_SERVICE_ROLE_KEY});
  const userId=await resolveOwnerUserId(supabase,env.OWNER_GOOGLE_EMAIL);
  const connection=await getGmailConnection(supabase,userId);
  const config={calendarCredentialKey:env.CALENDAR_CREDENTIAL_KEY,gmail:{clientId:env.GMAIL_CLIENT_ID,clientSecret:env.GMAIL_CLIENT_SECRET,redirectUri:env.GMAIL_REDIRECT_URI}};
  const accessToken=await resolveGmailAccessToken({supabase,userId,connection,config,credentialKey:decodeCredentialKey(env.CALENDAR_CREDENTIAL_KEY),fetchImpl});
  const provider=createGmailProvider({fetch:fetchImpl,accessToken});
  const {data,error}=await supabase.from('gmail_source_records').select('gmail_message_id,received_at').eq('user_id',userId).in('scan_run_id',TARGET_SCAN_IDS).order('received_at',{ascending:true});
  if(error)throw error;
  if((data||[]).length!==523)throw new Error(`Expected 523 sources, found ${(data||[]).length}`);
  let successes=0;
  const failures=[];
  for(let index=0;index<Math.min(data.length,200)&&failures.length<3;index+=1){
    if(index>0)await sleep(125);
    try{await provider.getMessage(data[index].gmail_message_id);successes+=1;}
    catch(err){failures.push({index:index+1,...safeError(err)});}
  }
  console.log('[gmail-backfill-error-diagnostic] '+JSON.stringify({successes,failures}));
  return {successes,failures};
}

if(require.main===module){main().catch(error=>{console.error('[gmail-backfill-error-diagnostic] '+JSON.stringify({fatal:true,...safeError(error)}));process.exitCode=1;});}

module.exports={safeError,main};
