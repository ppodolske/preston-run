const assert=require('node:assert/strict');
const {createApp,createGmailDeps}=require('../src/app');
const {GMAIL_READONLY_SCOPE}=require('../src/services/gmail-oauth');

const key=Buffer.alloc(32,7).toString('base64url');
const config={
  siteUrl:'https://preston.run',
  supabaseUrl:'https://example.supabase.co',
  supabaseServiceRoleKey:'service-role-key',
  calendarCredentialKey:key,
  gmail:{clientId:'client1',clientSecret:'secret1',redirectUri:'https://preston.run/me/settings/gmail/callback',scannerVersion:'scanner1',parserVersion:'parser1',initialLookbackMonths:12}
};
const deps=createGmailDeps(config,{startScanNow:async()=>({status:'stubbed'})});
assert.equal(typeof deps.googleOAuth.buildAuthUrl,'function');
assert.equal(typeof deps.upsertGmailConnection,'function');
assert.equal(typeof deps.startScanNow,'function');
const authUrl=deps.googleOAuth.buildAuthUrl({state:'state1'});
assert.equal(new URL(authUrl).searchParams.get('scope'),GMAIL_READONLY_SCOPE);
const encrypted=deps.encryptAccessToken('access1');
assert.match(encrypted,/^v1\./);

(async()=>{
  const requestDb={kind:'request'};
  const backgroundDb={kind:'background'};
  let factoryArgs=null;
  let capturedScanDb=null;
  let capturedUserId=null;
  const backgroundDeps=createGmailDeps(config,{
    createBackgroundSupabaseClient:args=>{factoryArgs=args;return backgroundDb;},
    startManualGmailScan:async(db,userId)=>{capturedScanDb=db;capturedUserId=userId;return {status:'succeeded'};}
  });
  const scanResult=await backgroundDeps.startScanNow(requestDb,'user1');
  assert.equal(scanResult.status,'succeeded');
  assert.equal(capturedScanDb,backgroundDb,'detached Gmail scan must not keep using the request-scoped Supabase client after the HTTP response ends');
  assert.equal(capturedUserId,'user1');
  assert.deepEqual(factoryArgs,{supabaseUrl:'https://example.supabase.co',serviceRoleKey:'service-role-key'});

  let capturedContext=null;
  const app=createApp(config,{
    createRequestSupabase:()=>({auth:{signOut:async()=>{}},from:()=>({select(){return this;},eq(){return this;},order(){return this;},limit(){return Promise.resolve({data:[],error:null});},maybeSingle(){return Promise.resolve({data:null,error:null});}})}),
    gmailDeps:{
      getGmailConnection:async()=>null,
      listRecentScans:async()=>[],
      startScanNow:async()=>({status:'overridden'})
    }
  });
  assert.equal(typeof app,'function');

  console.log('gmail app wiring tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
