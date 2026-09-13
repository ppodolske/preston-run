const assert=require('node:assert/strict');
const {runPushTest}=require('../src/jobs/test-push');

(async()=>{
  const sends=[];
  const fakeSupabase={};
  const result=await runPushTest({
    env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'secret',OWNER_GOOGLE_EMAIL:'owner@example.com',VAPID_PUBLIC_KEY:'public',VAPID_PRIVATE_KEY:'private',VAPID_SUBJECT:'mailto:owner@example.com'},
    deps:{
      createBackgroundClient:()=>fakeSupabase,
      resolveOwnerUserId:async()=> 'user-1',
      listSubscriptions:async(supabase,userId,options)=>{assert.equal(supabase,fakeSupabase);assert.equal(userId,'user-1');assert.deepEqual(options,{activeOnly:true});return[{id:'sub-1',endpoint:'https://push.example/1',p256dh:'p',auth_secret:'a'}];},
      createTransport:()=>({send:async(subscription,payload)=>{sends.push({subscription,payload});}})
    }
  });
  assert.equal(result.sent,1);
  assert.equal(sends.length,1);
  assert.equal(sends[0].payload.title,'preston.ai test');
  assert.equal(sends[0].payload.body,'UAT push notifications are working.');
  assert.equal(sends[0].payload.url,'/notifications');
  console.log('push test job tests passed');
})().catch(error=>{console.error(error);process.exit(1);});
