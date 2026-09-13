'use strict';

const {createBackgroundSupabaseClient,resolveOwnerUserId}=require('../auth/background-supabase');
const {decodeCredentialKey,decryptCredential}=require('../security/credential-crypto');
const {getGmailConnection}=require('../data/gmail-connections');
const {fetchGmailProfile}=require('../services/gmail-oauth');

function normalizeAccessToken(value){
  if(typeof value==='string'&&value)return value;
  if(value&&typeof value.accessToken==='string'&&value.accessToken)return value.accessToken;
  if(value&&typeof value.access_token==='string'&&value.access_token)return value.access_token;
  throw new Error('Decrypted Gmail credential is missing access token');
}

async function main({env=process.env,fetchImpl=global.fetch}={}){
  const supabase=createBackgroundSupabaseClient({supabaseUrl:env.SUPABASE_URL,serviceRoleKey:env.SUPABASE_SERVICE_ROLE_KEY});
  const userId=await resolveOwnerUserId(supabase,env.OWNER_GOOGLE_EMAIL);
  const connection=await getGmailConnection(supabase,userId);
  if(!connection)throw new Error('No Gmail connection');
  const key=decodeCredentialKey(env.CALENDAR_CREDENTIAL_KEY);
  const token=normalizeAccessToken(decryptCredential(connection.access_token_ciphertext,key));
  try{
    const profile=await fetchGmailProfile(token,{fetch:fetchImpl});
    console.log('[gmail-token-diagnostic] '+JSON.stringify({ok:true,emailMatches:Boolean(profile&&profile.emailAddress)}));
    return 0;
  }catch(error){
    console.error('[gmail-token-diagnostic] '+JSON.stringify({ok:false,status:error&&error.status||null,message:error&&error.message||'unknown error'}));
    return 1;
  }
}

if(require.main===module){main().then(code=>{process.exitCode=code;}).catch(error=>{console.error('[gmail-token-diagnostic] '+JSON.stringify({ok:false,status:error&&error.status||null,message:error&&error.message||'unknown error'}));process.exitCode=1;});}

module.exports={normalizeAccessToken,main};
