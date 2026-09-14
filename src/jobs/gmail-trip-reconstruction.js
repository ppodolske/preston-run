'use strict';

const {createBackgroundSupabaseClient,resolveOwnerUserId}=require('../auth/background-supabase');
const {decodeCredentialKey}=require('../security/credential-crypto');
const {getGmailConnection}=require('../data/gmail-connections');
const tripData=require('../data/trips');
const bookingSourceData=require('../data/booking-sources');
const lifeAdminData=require('../data/life-admin');
const {createGmailProvider}=require('../services/gmail-provider');
const {resolveGmailAccessToken}=require('../services/gmail-access-token');
const {buildGmailBookingActions}=require('../services/gmail-booking-actions');
const {buildGmailLifeAdminActions}=require('../services/gmail-life-admin-actions');
const {runGmailTripReconstruction,EXPECTED_LEGACY_SHELL_COUNT}=require('../services/gmail-trip-reconstruction');

const APPLY_CONFIRMATION='gmail-trip-reconstruction-v0.13.0-apply';
function parseMode(argv=process.argv.slice(2),env=process.env){
  const known=new Set(['--dry-run','--apply']);for(const arg of argv)if(!known.has(arg))throw new Error(`Unknown reconstruction argument: ${arg}`);
  if(argv.includes('--dry-run')&&argv.includes('--apply'))throw new Error('Choose either --dry-run or --apply, not both');
  if(argv.includes('--apply'))return'apply';
  if(argv.includes('--dry-run'))return'dry-run';
  const configured=String(env.GMAIL_TRIP_RECONSTRUCTION_MODE||'').trim().toLowerCase();
  if(!configured||configured==='dry-run')return'dry-run';
  if(configured==='apply')return'apply';
  throw new Error('GMAIL_TRIP_RECONSTRUCTION_MODE must be dry-run or apply');
}
function assertApplyConfirmation(mode,env=process.env){if(mode==='apply'&&String(env.GMAIL_TRIP_RECONSTRUCTION_CONFIRM||'')!==APPLY_CONFIRMATION)throw new Error(`Apply confirmation is required: ${APPLY_CONFIRMATION}`);}
function throwIfError(result){if(result&&result.error)throw result.error;return result&&result.data||[];}
async function rowsForTrip(supabase,table,userId,column,tripId){return throwIfError(await supabase.from(table).select('id').eq('user_id',userId).eq(column,tripId));}

function createReconstructionData({supabase,userId}={}){
  const user={id:userId};
  return{
    async listLegacyTripCreateActivities(){
      const result=await supabase.from('gmail_activity_entries').select('id,source_record_id,entity_type,entity_id,action,automatic,rule_version,new_value,created_at').eq('user_id',userId).eq('entity_type','trip').eq('action','create').eq('automatic',true).like('rule_version','gmail-trip-actions-v0.12.%').order('created_at',{ascending:true});
      return throwIfError(result);
    },
    getTrip:id=>tripData.getTrip(supabase,user,id),
    async getTripDependencies(id){
      const[segments,bookings,tasks,lifeItems]=await Promise.all([
        rowsForTrip(supabase,'trip_segments',userId,'trip_id',id),
        rowsForTrip(supabase,'bookings',userId,'trip_id',id),
        rowsForTrip(supabase,'tasks',userId,'linked_trip_id',id),
        rowsForTrip(supabase,'life_items',userId,'linked_trip_id',id)
      ]);return{segments,bookings,tasks,lifeItems};
    },
    async getSource(id){const result=await supabase.from('gmail_source_records').select('id,gmail_message_id,gmail_thread_id,sender,subject,received_at,source_link').eq('user_id',userId).eq('id',id).maybeSingle();if(result.error)throw result.error;return result.data||null;},
    listTrips:()=>tripData.listTrips(supabase,user),
    findCanonicalBooking:(candidate,source)=>bookingSourceData.findCanonicalBookingForGmailCandidate(supabase,user,candidate,source),
    findLifeItem:source=>lifeAdminData.findGmailLifeItem(supabase,user,{source_record_id:source.id,gmail_message_id:source.gmail_message_id,gmail_thread_id:source.gmail_thread_id})
  };
}

async function createProvider({supabase,userId,connection,env=process.env,fetchImpl=global.fetch}={}){
  const config={calendarCredentialKey:env.CALENDAR_CREDENTIAL_KEY,gmail:{clientId:String(env.GMAIL_CLIENT_ID||''),clientSecret:String(env.GMAIL_CLIENT_SECRET||''),redirectUri:String(env.GMAIL_REDIRECT_URI||'')}};
  const accessToken=await resolveGmailAccessToken({supabase,userId,connection,config,credentialKey:decodeCredentialKey(env.CALENDAR_CREDENTIAL_KEY),fetchImpl});
  return createGmailProvider({fetch:fetchImpl,accessToken});
}

async function main({argv=process.argv.slice(2),env=process.env,fetchImpl=global.fetch}={}){
  const mode=parseMode(argv,env);assertApplyConfirmation(mode,env);
  const supabase=createBackgroundSupabaseClient({supabaseUrl:env.SUPABASE_URL,serviceRoleKey:env.SUPABASE_SERVICE_ROLE_KEY}),userId=await resolveOwnerUserId(supabase,env.OWNER_GOOGLE_EMAIL),connection=await getGmailConnection(supabase,userId);
  if(!connection||connection.status==='disconnected')throw new Error('No connected Gmail account');if(!connection.access_token_ciphertext&&!connection.refresh_token_ciphertext)throw new Error('Connected Gmail account is missing access token');
  const provider=await createProvider({supabase,userId,connection,env,fetchImpl}),data=createReconstructionData({supabase,userId});
  const lifeAdminActions=buildGmailLifeAdminActions({supabase,userId,lifeAdminData,tripData});
  const bookingActions=buildGmailBookingActions({supabase,userId,tripData,reviewData:{createReviewItem:async(source,decision)=>lifeAdminActions.createReviewItem(source,{reason:decision.reasons&&decision.reasons[0]||'confirm_match'})}});
  const result=await runGmailTripReconstruction({mode,expectedBaseline:EXPECTED_LEGACY_SHELL_COUNT,data,provider,parserVersion:'gmail-booking-parser-v0.13.0',bookingActions,lifeAdminActions,paceMs:Number(env.GMAIL_TRIP_RECONSTRUCTION_PACE_MS||1000),onProgress:progress=>console.log(`[gmail-trip-reconstruction] progress ${JSON.stringify(progress)}`)});
  console.log(`[gmail-trip-reconstruction] ${mode} ${JSON.stringify(result)}`);return result;
}

if(require.main===module){main().catch(error=>{console.error('[gmail-trip-reconstruction] failed',{message:error&&error.message});process.exitCode=1;});}
module.exports={APPLY_CONFIRMATION,parseMode,assertApplyConfirmation,createReconstructionData,createProvider,main};
