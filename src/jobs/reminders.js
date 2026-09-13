const {shouldRunScheduledMode}=require('../domain/reminders');
const {createBackgroundSupabaseClient,resolveOwnerUserId}=require('../auth/background-supabase');
const {createPushTransport}=require('../push/web-push');
const {runMorningSummary,runUrgentCheck}=require('../services/reminder-engine');

function required(env,key){const value=env[key];if(!value)throw new Error(`${key} is required`);return value;}
function loadBackgroundConfig(env=process.env){return{supabaseUrl:required(env,'SUPABASE_URL'),serviceRoleKey:required(env,'SUPABASE_SERVICE_ROLE_KEY'),ownerGoogleEmail:required(env,'OWNER_GOOGLE_EMAIL').trim().toLowerCase(),vapidPublicKey:required(env,'VAPID_PUBLIC_KEY'),vapidPrivateKey:required(env,'VAPID_PRIVATE_KEY'),vapidSubject:required(env,'VAPID_SUBJECT')};}

async function runReminderJob({mode,now=new Date(),env=process.env,deps={}}={}){
  if(!['morning','noon','evening'].includes(mode))throw new Error('Invalid reminder job mode');
  if(!shouldRunScheduledMode(mode,now))return{skipped:true,mode};
  const config=loadBackgroundConfig(env);
  const createBackgroundClient=deps.createBackgroundClient||createBackgroundSupabaseClient;
  const ownerResolver=deps.resolveOwnerUserId||resolveOwnerUserId;
  const createTransport=deps.createTransport||createPushTransport;
  const morning=deps.runMorning||runMorningSummary;
  const urgent=deps.runUrgent||runUrgentCheck;
  const supabase=createBackgroundClient(config);
  const userId=await ownerResolver(supabase,config.ownerGoogleEmail);
  const pushTransport=createTransport({publicKey:config.vapidPublicKey,privateKey:config.vapidPrivateKey,subject:config.vapidSubject});
  const result=mode==='morning'?await morning({supabase,userId,now,pushTransport}):await urgent({supabase,userId,now,pushTransport,mode});
  return{skipped:false,mode,result};
}

async function main(){try{await runReminderJob({mode:process.argv[2]});}catch(error){console.error(`Reminder job failed: ${error&&error.message?error.message:'unknown error'}`);process.exitCode=1;}}
if(require.main===module)main();
module.exports={runReminderJob,loadBackgroundConfig};
