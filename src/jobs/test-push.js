const {createBackgroundSupabaseClient,resolveOwnerUserId}=require('../auth/background-supabase');
const {listPushSubscriptions}=require('../data/reminders');
const {createPushTransport}=require('../push/web-push');

function required(env,key){const value=env[key];if(!value)throw new Error(`${key} is required`);return value;}
function loadConfig(env=process.env){return{supabaseUrl:required(env,'SUPABASE_URL'),serviceRoleKey:required(env,'SUPABASE_SERVICE_ROLE_KEY'),ownerGoogleEmail:required(env,'OWNER_GOOGLE_EMAIL').trim().toLowerCase(),vapidPublicKey:required(env,'VAPID_PUBLIC_KEY'),vapidPrivateKey:required(env,'VAPID_PRIVATE_KEY'),vapidSubject:required(env,'VAPID_SUBJECT')};}

async function runPushTest({env=process.env,deps={}}={}){
  const config=loadConfig(env);
  const createBackgroundClient=deps.createBackgroundClient||createBackgroundSupabaseClient;
  const ownerResolver=deps.resolveOwnerUserId||resolveOwnerUserId;
  const listSubscriptions=deps.listSubscriptions||listPushSubscriptions;
  const createTransport=deps.createTransport||createPushTransport;
  const supabase=createBackgroundClient(config);
  const userId=await ownerResolver(supabase,config.ownerGoogleEmail);
  const subscriptions=await listSubscriptions(supabase,userId,{activeOnly:true});
  if(!subscriptions.length)return{sent:0};
  const transport=createTransport({publicKey:config.vapidPublicKey,privateKey:config.vapidPrivateKey,subject:config.vapidSubject});
  const payload={title:'preston.ai test',body:'UAT push notifications are working.',url:'/notifications',tag:'preston-uat-push-test'};
  let sent=0;
  for(const row of subscriptions){
    await transport.send({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth_secret}},payload);
    sent++;
  }
  return{sent};
}

async function main(){try{const result=await runPushTest();console.log(`Push test sent to ${result.sent} device(s).`);}catch(error){console.error(`Push test failed: ${error&&error.message?error.message:'unknown error'}`);process.exitCode=1;}}
if(require.main===module)main();
module.exports={runPushTest,loadConfig};
