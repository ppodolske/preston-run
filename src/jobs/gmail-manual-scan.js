'use strict';

const {loadConfig}=require('../config');
const {createBackgroundSupabaseClient,resolveOwnerUserId}=require('../auth/background-supabase');
const {getGmailConnection}=require('../data/gmail-connections');
const {startManualGmailScan}=require('../services/gmail-manual-scan');

const ACTIVE_SCAN_STATUSES=new Set(['queued','running','processing']);
const RESULT_FIELDS=['discoveredCount','processedCount','relevantCount','tripCount','lifeAdminCount','ignoredCount','recordsCreatedCount','recordsUpdatedCount','reviewItemsCreatedCount','pdfUnreadableCount'];

function required(env,key){const value=env[key];if(!value)throw new Error(`${key} is required`);return value;}
async function listRecentScans(supabase,userId,limit=1){const result=await supabase.from('gmail_scan_runs').select('status').eq('user_id',userId).order('started_at',{ascending:false}).limit(limit);if(result.error)throw result.error;return result.data||[];}
function publicResult(result){const out={status:String(result&&result.status||'')};for(const field of RESULT_FIELDS)out[field]=Number(result&&result[field]||0);return out;}

async function runGmailManualScanJob({env=process.env,deps={}}={}){
  const config=(deps.loadConfig||loadConfig)(env);
  const serviceRoleKey=required(env,'SUPABASE_SERVICE_ROLE_KEY');
  const createBackgroundClient=deps.createBackgroundClient||createBackgroundSupabaseClient;
  const ownerResolver=deps.resolveOwnerUserId||resolveOwnerUserId;
  const connectionGetter=deps.getGmailConnection||getGmailConnection;
  const scanLister=deps.listRecentScans||listRecentScans;
  const scanStarter=deps.startManualGmailScan||startManualGmailScan;
  const supabase=createBackgroundClient({supabaseUrl:config.supabaseUrl,serviceRoleKey});
  const userId=await ownerResolver(supabase,config.ownerGoogleEmail);
  const connection=await connectionGetter(supabase,userId);
  if(!connection||String(connection.status||'').toLowerCase()==='disconnected')throw new Error('Connected Gmail account is required');
  const scans=await scanLister(supabase,userId,1);
  if(scans[0]&&ACTIVE_SCAN_STATUSES.has(String(scans[0].status||'').toLowerCase()))throw new Error('An active Gmail scan already exists');
  const result=await scanStarter(supabase,userId,config);
  if(!result||result.status!=='succeeded')throw new Error(`Gmail scan failed${result&&result.error?`: ${result.error}`:''}`);
  return publicResult(result);
}

async function main(){
  try{const result=await runGmailManualScanJob();console.log(`Gmail manual scan complete ${JSON.stringify(result)}`);}
  catch(error){console.error(`Gmail manual scan job failed: ${error&&error.message?error.message:'unknown error'}`);process.exitCode=1;}
}

if(require.main===module)main();
module.exports={runGmailManualScanJob,listRecentScans,publicResult,ACTIVE_SCAN_STATUSES};
