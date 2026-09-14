'use strict';

const {createBackgroundSupabaseClient,resolveOwnerUserId}=require('../auth/background-supabase');
const {decodeCredentialKey}=require('../security/credential-crypto');
const {getGmailConnection}=require('../data/gmail-connections');
const bookingSourceData=require('../data/booking-sources');
const bookingData=require('../data/bookings');
const bookingLegData=require('../data/booking-legs');
const {createGmailProvider}=require('../services/gmail-provider');
const {resolveGmailAccessToken}=require('../services/gmail-access-token');
const {runGmailBookingEnrichment}=require('../services/gmail-booking-enrichment');

const APPLY_CONFIRMATION='gmail-booking-enrichment-v0.14.0-apply';
function parseMode(argv=process.argv.slice(2),env=process.env){
  const known=new Set(['--dry-run','--apply']);for(const arg of argv)if(!known.has(arg))throw new Error(`Unknown enrichment argument: ${arg}`);
  if(argv.includes('--dry-run')&&argv.includes('--apply'))throw new Error('Choose either --dry-run or --apply, not both');
  if(argv.includes('--apply'))return'apply';if(argv.includes('--dry-run'))return'dry-run';
  const configured=String(env.GMAIL_BOOKING_ENRICHMENT_MODE||'').trim().toLowerCase();if(!configured||configured==='dry-run')return'dry-run';if(configured==='apply')return'apply';throw new Error('GMAIL_BOOKING_ENRICHMENT_MODE must be dry-run or apply');
}
function assertApplyConfirmation(mode,env=process.env){if(mode==='apply'&&String(env.GMAIL_BOOKING_ENRICHMENT_CONFIRM||'')!==APPLY_CONFIRMATION)throw new Error(`Apply confirmation is required: ${APPLY_CONFIRMATION}`);}
async function createProvider({supabase,userId,connection,env=process.env,fetchImpl=global.fetch}={}){
  const config={calendarCredentialKey:env.CALENDAR_CREDENTIAL_KEY,gmail:{clientId:String(env.GMAIL_CLIENT_ID||''),clientSecret:String(env.GMAIL_CLIENT_SECRET||''),redirectUri:String(env.GMAIL_REDIRECT_URI||'')}};
  const accessToken=await resolveGmailAccessToken({supabase,userId,connection,config,credentialKey:decodeCredentialKey(env.CALENDAR_CREDENTIAL_KEY),fetchImpl});
  return createGmailProvider({fetch:fetchImpl,accessToken});
}
async function main({argv=process.argv.slice(2),env=process.env,fetchImpl=global.fetch}={}){
  const mode=parseMode(argv,env);assertApplyConfirmation(mode,env);
  const supabase=createBackgroundSupabaseClient({supabaseUrl:env.SUPABASE_URL,serviceRoleKey:env.SUPABASE_SERVICE_ROLE_KEY});
  const userId=await resolveOwnerUserId(supabase,env.OWNER_GOOGLE_EMAIL),user={id:userId};
  const connection=await getGmailConnection(supabase,userId);if(!connection||connection.status==='disconnected')throw new Error('No connected Gmail account');if(!connection.access_token_ciphertext&&!connection.refresh_token_ciphertext)throw new Error('Connected Gmail account is missing access token');
  const provider=await createProvider({supabase,userId,connection,env,fetchImpl});
  const result=await runGmailBookingEnrichment({mode,data:bookingSourceData,provider,parserVersion:'gmail-parser-v0.14.0',bookingData,bookingLegData,supabase,user});
  console.log(`[gmail-booking-enrichment] ${mode} ${JSON.stringify(result)}`);return result;
}
if(require.main===module){main().catch(error=>{console.error('[gmail-booking-enrichment] failed',{message:error&&error.message});process.exitCode=1;});}
module.exports={APPLY_CONFIRMATION,parseMode,assertApplyConfirmation,createProvider,main};
