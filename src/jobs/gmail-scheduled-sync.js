'use strict';

const {createBackgroundSupabaseClient,resolveOwnerUserId}=require('../auth/background-supabase');
const {startManualGmailScan}=require('../services/gmail-manual-scan');
const {createPushTransport}=require('../push/web-push');
const {runUrgentCheck}=require('../services/reminder-engine');
const {withinSydneyWindow,sameSydneyDate}=require('../domain/schedule');

const MODES={morning:[6,45],noon:[12,0],evening:[18,0],night:[21,0]};
const ACTIVE_SCAN_STATUSES=new Set(['queued','running','processing']);

function required(env,key){const value=env[key];if(!value)throw new Error(`${key} is required`);return value;}
function loadScheduledGmailConfig(env=process.env){
  return{
    supabaseUrl:required(env,'SUPABASE_URL'),
    serviceRoleKey:required(env,'SUPABASE_SERVICE_ROLE_KEY'),
    ownerGoogleEmail:required(env,'OWNER_GOOGLE_EMAIL').trim().toLowerCase(),
    calendarCredentialKey:required(env,'CALENDAR_CREDENTIAL_KEY'),
    gmail:{
      clientId:required(env,'GMAIL_CLIENT_ID'),
      clientSecret:required(env,'GMAIL_CLIENT_SECRET'),
      redirectUri:required(env,'GMAIL_REDIRECT_URI'),
      scannerVersion:'gmail-scanner-v0.14.0',
      parserVersion:'gmail-parser-v0.14.0',
      initialLookbackMonths:12
    },
    vapidPublicKey:String(env.VAPID_PUBLIC_KEY||''),
    vapidPrivateKey:String(env.VAPID_PRIVATE_KEY||''),
    vapidSubject:String(env.VAPID_SUBJECT||'')
  };
}

function shouldRunScheduledGmailMode(mode,now=new Date()){
  const time=MODES[mode];if(!time)throw new Error('Invalid scheduled Gmail mode');
  return withinSydneyWindow(now,time[0],time[1],15);
}

async function listRecentScheduledScans(supabase,userId,limit=8){
  const result=await supabase.from('gmail_scan_runs').select('status,started_at').eq('user_id',userId).order('started_at',{ascending:false}).limit(limit);
  if(result.error)throw result.error;return result.data||[];
}
function scanAlreadyRanForSlot(scans,mode,now){
  return(scans||[]).some(scan=>scan&&scan.started_at&&sameSydneyDate(new Date(scan.started_at),now)&&shouldRunScheduledGmailMode(mode,new Date(scan.started_at))&&['succeeded','partial','running','queued','processing'].includes(String(scan.status||'').toLowerCase()));
}
function activeScanExists(scans){return(scans||[]).some(scan=>ACTIVE_SCAN_STATUSES.has(String(scan&&scan.status||'').toLowerCase()));}

async function runScheduledGmailSyncJob({mode,now=new Date(),env=process.env,deps={}}={}){
  if(!MODES[mode])throw new Error('Invalid scheduled Gmail mode');
  if(!shouldRunScheduledGmailMode(mode,now))return{skipped:true,mode};
  const loadConfig=deps.loadConfig||loadScheduledGmailConfig,config=loadConfig(env);
  const createBackgroundClient=deps.createBackgroundClient||createBackgroundSupabaseClient;
  const ownerResolver=deps.resolveOwnerUserId||resolveOwnerUserId;
  const scanLister=deps.listRecentScans||listRecentScheduledScans;
  const scanStarter=deps.startManualGmailScan||startManualGmailScan;
  const supabase=createBackgroundClient(config);
  const userId=await ownerResolver(supabase,config.ownerGoogleEmail);
  const recent=await scanLister(supabase,userId,8);
  const scanSkipped=scanAlreadyRanForSlot(recent,mode,now)||activeScanExists(recent);
  let scanResult=null;
  if(!scanSkipped){
    scanResult=await scanStarter(supabase,userId,config);
    if(!scanResult||scanResult.status!=='succeeded')throw new Error(`Scheduled Gmail sync failed${scanResult&&scanResult.error?`: ${scanResult.error}`:''}`);
  }
  let urgentResult=null;
  if(mode!=='morning'){
    const createTransport=deps.createTransport||createPushTransport;
    const urgent=deps.runUrgent||runUrgentCheck;
    const pushTransport=createTransport({publicKey:required(config,'vapidPublicKey'),privateKey:required(config,'vapidPrivateKey'),subject:required(config,'vapidSubject')});
    urgentResult=await urgent({supabase,userId,now,pushTransport,mode});
  }
  return{skipped:false,mode,scanSkipped,scanResult,urgentResult};
}

async function main(){
  try{const result=await runScheduledGmailSyncJob({mode:process.argv[2]});console.log(`Scheduled Gmail sync complete ${JSON.stringify({mode:result.mode,scanSkipped:result.scanSkipped,urgentSent:Boolean(result.urgentResult&&result.urgentResult.sent)})}`);}
  catch(error){console.error(`Scheduled Gmail sync failed: ${error&&error.message?error.message:'unknown error'}`);process.exitCode=1;}
}
if(require.main===module)main();
module.exports={runScheduledGmailSyncJob,shouldRunScheduledGmailMode,loadScheduledGmailConfig,listRecentScheduledScans,scanAlreadyRanForSlot,activeScanExists};
