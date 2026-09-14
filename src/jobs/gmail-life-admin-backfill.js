'use strict';

const {createBackgroundSupabaseClient,resolveOwnerUserId}=require('../auth/background-supabase');
const {decodeCredentialKey}=require('../security/credential-crypto');
const {getGmailConnection}=require('../data/gmail-connections');
const lifeAdminData=require('../data/life-admin');
const {createGmailProvider}=require('../services/gmail-provider');
const {resolveGmailAccessToken}=require('../services/gmail-access-token');
const {buildGmailLifeAdminActions}=require('../services/gmail-life-admin-actions');
const {runGmailLifeAdminBackfill,TARGET_SCAN_IDS}=require('../services/gmail-life-admin-backfill');

const BACKFILL_CONFIRMATION='gmail-life-admin-backfill-v0.12.3';

function assertBackfillConfirmation(env=process.env){
  if(String(env.GMAIL_LIFE_ADMIN_BACKFILL_CONFIRM||'')!==BACKFILL_CONFIRMATION){
    throw new Error(`Gmail Life Admin backfill confirmation is required: ${BACKFILL_CONFIRMATION}`);
  }
}

function normalizeAccessToken(value){
  if(typeof value==='string'&&value)return value;
  if(value&&typeof value.accessToken==='string'&&value.accessToken)return value.accessToken;
  if(value&&typeof value.access_token==='string'&&value.access_token)return value.access_token;
  throw new Error('Decrypted Gmail credential is missing access token');
}

async function listBackfillSources(supabase,userId){
  const result=await supabase.from('gmail_source_records')
    .select('id,gmail_message_id,gmail_thread_id,sender,subject,received_at,source_link,scan_run_id')
    .eq('user_id',userId)
    .in('scan_run_id',TARGET_SCAN_IDS)
    .order('received_at',{ascending:true});
  if(result.error)throw result.error;
  return result.data||[];
}

function lookupMetadata(source){
  return {
    source_record_id:source.id,
    gmail_message_id:source.gmail_message_id||null,
    gmail_thread_id:source.gmail_thread_id||null
  };
}

async function createBackfillProvider({
  supabase,
  userId,
  connection,
  env=process.env,
  fetchImpl=global.fetch,
  decodeCredentialKey:decode=decodeCredentialKey,
  resolveGmailAccessToken:resolveAccess=resolveGmailAccessToken,
  createGmailProvider:providerFactory=createGmailProvider
}={}){
  const config={
    calendarCredentialKey:env.CALENDAR_CREDENTIAL_KEY,
    gmail:{
      clientId:String(env.GMAIL_CLIENT_ID||''),
      clientSecret:String(env.GMAIL_CLIENT_SECRET||''),
      redirectUri:String(env.GMAIL_REDIRECT_URI||'')
    }
  };
  const accessToken=await resolveAccess({
    supabase,
    userId,
    connection,
    config,
    credentialKey:decode(env.CALENDAR_CREDENTIAL_KEY),
    fetchImpl
  });
  return providerFactory({fetch:fetchImpl,accessToken});
}

async function main({env=process.env,fetchImpl=global.fetch}={}){
  assertBackfillConfirmation(env);
  const supabase=createBackgroundSupabaseClient({supabaseUrl:env.SUPABASE_URL,serviceRoleKey:env.SUPABASE_SERVICE_ROLE_KEY});
  const userId=await resolveOwnerUserId(supabase,env.OWNER_GOOGLE_EMAIL);
  const connection=await getGmailConnection(supabase,userId);
  if(!connection||connection.status==='disconnected')throw new Error('No connected Gmail account');
  if(!connection.access_token_ciphertext&&!connection.refresh_token_ciphertext)throw new Error('Connected Gmail account is missing access token');
  const provider=await createBackfillProvider({supabase,userId,connection,env,fetchImpl});
  const sources=await listBackfillSources(supabase,userId);
  if(sources.length!==523)throw new Error(`Expected exactly 523 historical Gmail source records, found ${sources.length}`);
  const actions=buildGmailLifeAdminActions({supabase,userId,lifeAdminData});
  const isAlreadyHandled=async source=>Boolean(await lifeAdminData.findGmailLifeItem(supabase,{id:userId},lookupMetadata(source)));
  const result=await runGmailLifeAdminBackfill({
    sources,
    provider,
    actions,
    isAlreadyHandled,
    onProgress:progress=>console.log(`[gmail-life-admin-backfill] ${JSON.stringify(progress)}`)
  });
  console.log(`[gmail-life-admin-backfill] final ${JSON.stringify(result)}`);
  if(result.errors)throw new Error(`Gmail Life Admin backfill completed with ${result.errors} message errors`);
  return result;
}

if(require.main===module){
  main().catch(error=>{console.error('[gmail-life-admin-backfill] failed',{message:error&&error.message});process.exitCode=1;});
}

module.exports={BACKFILL_CONFIRMATION,assertBackfillConfirmation,normalizeAccessToken,listBackfillSources,lookupMetadata,createBackfillProvider,main};
