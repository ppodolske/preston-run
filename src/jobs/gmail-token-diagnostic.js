'use strict';

const {createBackgroundSupabaseClient,resolveOwnerUserId}=require('../auth/background-supabase');
const {getGmailConnection}=require('../data/gmail-connections');
const {resolveGmailAccessToken}=require('../services/gmail-access-token');
const {fetchGmailProfile}=require('../services/gmail-oauth');

async function main({env=process.env,fetchImpl=global.fetch}={}){
  const supabase=createBackgroundSupabaseClient({supabaseUrl:env.SUPABASE_URL,serviceRoleKey:env.SUPABASE_SERVICE_ROLE_KEY});
  const userId=await resolveOwnerUserId(supabase,env.OWNER_GOOGLE_EMAIL);
  const connection=await getGmailConnection(supabase,userId);
  if(!connection)throw new Error('No Gmail connection');
  const config={
    calendarCredentialKey:env.CALENDAR_CREDENTIAL_KEY,
    gmail:{clientId:env.GMAIL_CLIENT_ID,clientSecret:env.GMAIL_CLIENT_SECRET,redirectUri:env.GMAIL_REDIRECT_URI}
  };
  try{
    const token=await resolveGmailAccessToken({supabase,userId,connection,config,fetchImpl});
    const profile=await fetchGmailProfile(token,{fetch:fetchImpl});
    console.log('[gmail-token-diagnostic] '+JSON.stringify({ok:true,refreshUsed:Boolean(connection.refresh_token_ciphertext),profileReadable:Boolean(profile&&profile.emailAddress)}));
    return 0;
  }catch(error){
    console.error('[gmail-token-diagnostic] '+JSON.stringify({ok:false,status:error&&error.status||null,message:error&&error.message||'unknown error'}));
    return 1;
  }
}

if(require.main===module){main().then(code=>{process.exitCode=code;}).catch(error=>{console.error('[gmail-token-diagnostic] '+JSON.stringify({ok:false,status:error&&error.status||null,message:error&&error.message||'unknown error'}));process.exitCode=1;});}

module.exports={main};
