'use strict';

const {createBackgroundSupabaseClient,resolveOwnerUserId}=require('../auth/background-supabase');
const {getGmailConnection}=require('../data/gmail-connections');
const {decodeCredentialKey}=require('../security/credential-crypto');
const {resolveGmailAccessToken}=require('../services/gmail-access-token');
const {createGmailProvider}=require('../services/gmail-provider');
const {TARGET_SCAN_IDS}=require('../services/gmail-life-admin-backfill');

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
  const indexes=[0,50,99,124,149,199,249,299,349,399,449,499,522];
  const results=[];
  for(const index of indexes){
    const row=data[index];
    try{await provider.getMessage(row.gmail_message_id);results.push({index:index+1,ok:true,status:200});}
    catch(err){results.push({index:index+1,ok:false,status:err&&err.status||null,message:err&&err.message||'unknown'});}
  }
  console.log('[gmail-backfill-error-diagnostic] '+JSON.stringify(results));
  return results;
}

if(require.main===module){main().catch(error=>{console.error('[gmail-backfill-error-diagnostic] '+JSON.stringify({fatal:true,status:error&&error.status||null,message:error&&error.message||'unknown'}));process.exitCode=1;});}

module.exports={main};
