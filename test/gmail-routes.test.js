const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {createGmailRouter,handleGmailRoute,isGmailPath,buildGmailAuthUrl,completeGmailOAuthCallback,GMAIL_READONLY_SCOPE,tokenEncryptors,stateCookie,validOAuthState}=require('../src/routes/gmail');

assert.equal(typeof createGmailRouter,'function');
const router=createGmailRouter({});
assert.equal(typeof router,'function');
assert.equal(isGmailPath('/me/settings/gmail'),true);
assert.equal(isGmailPath('/me/settings/gmail/scan-now'),true);
assert.equal(isGmailPath('/me/settings/gmail/scan-status'),true);
assert.equal(isGmailPath('/me/settings/gmail/activity/act1/undo'),true);
assert.equal(isGmailPath('/me/settings'),false);

let authArgs;
const authUrl=buildGmailAuthUrl({buildAuthUrl:args=>{authArgs=args;return '/google-auth';}},{gmail:{redirectUri:'https://preston.run/me/settings/gmail/callback'}},'state1');
assert.equal(authUrl,'/google-auth');
assert.deepEqual(authArgs.scope,[GMAIL_READONLY_SCOPE]);
assert.equal(authArgs.state,'state1');
assert.equal(authArgs.scope.includes('https://www.googleapis.com/auth/gmail.modify'),false);
assert.equal(authArgs.scope.includes('https://www.googleapis.com/auth/gmail.send'),false);
assert.equal(tokenEncryptors({encrypt:value=>`legacy:${value}`}).encryptAccessToken('a'),'legacy:a');
assert.equal(tokenEncryptors({encryptAccessToken:value=>`access:${value}`,encryptRefreshToken:value=>`refresh:${value}`}).encryptRefreshToken('r'),'refresh:r');

const longState='x'.repeat(43);
assert.equal(validOAuthState(longState,longState),true);
assert.equal(validOAuthState(longState,'y'.repeat(43)),false);
assert.match(stateCookie(longState,{isProduction:true}),/Secure/);
assert.match(stateCookie('',{isProduction:true},{clear:true}),/Max-Age=0/);

function response(){return{status:null,headers:{},body:'',writeHead(status,headers={}){this.status=status;this.headers={...this.headers,...headers};},end(body=''){this.body+=body||'';}};}
function request(method,url,body='',headers={}){const req=Readable.from(body?[Buffer.from(body)]:[]);req.method=method;req.url=url;req.headers={...headers};if(method==='POST'){req.headers['content-type']='application/x-www-form-urlencoded';req.headers.origin='https://preston.run';}return req;}
function ownerDb(){return{auth:{getUser:async()=>({data:{user:{id:'user1',email:'owner@example.com'}},error:null}),signOut:async()=>{}}};}
const routeConfig={siteUrl:'https://preston.run',ownerGoogleEmail:'owner@example.com',isProduction:true,gmail:{redirectUri:'https://preston.run/me/settings/gmail/callback'}};

(async()=>{
  let saved=null;
  let scanStarted=false;
  const result=await completeGmailOAuthCallback({
    supabase:{},userId:'user1',code:'code1',config:routeConfig,
    googleOAuth:{exchangeCode:async(code,opts)=>({accountEmail:'me@example.com',googleSubject:'sub1',accessToken:`access:${code}:${opts.redirectUri}`,refreshToken:'refresh',scope:GMAIL_READONLY_SCOPE})},
    encryptAccessToken:value=>`enc-access:${value}`,encryptRefreshToken:value=>`enc-refresh:${value}`,
    upsertGmailConnection:async(_db,userId,input)=>{saved={userId,input};return {id:'conn1'};},
    startScanNow:async()=>{scanStarted=true;throw new Error('scan should not start on callback');}
  });
  assert.equal(result.id,'conn1');assert.equal(saved.userId,'user1');assert.equal(saved.input.gmailAccountEmail,'me@example.com');assert.equal(saved.input.googleSubject,'sub1');assert.match(saved.input.accessTokenCiphertext,/^enc-access:access:code1:/);assert.equal(saved.input.refreshTokenCiphertext,'enc-refresh:refresh');assert.equal(saved.input.scope,GMAIL_READONLY_SCOPE);assert.equal(scanStarted,false,'OAuth callback must not start the first scan automatically');

  let resolveScan;const scanPromise=new Promise(resolve=>{resolveScan=resolve;});scanStarted=false;
  let r=response();const startedAt=Date.now();await handleGmailRoute(request('POST','/me/settings/gmail/scan-now','csrf=x'),r,{supabase:ownerDb(),config:routeConfig,gmailDeps:{startScanNow:()=>{scanStarted=true;return scanPromise;}}});const elapsed=Date.now()-startedAt;
  assert.equal(r.status,302);assert.equal(r.headers.location,'/me/settings/gmail?scan=1');assert.equal(scanStarted,true);assert.ok(elapsed<75,`scan POST should return immediately, took ${elapsed}ms`);resolveScan({status:'succeeded'});

  r=response();await handleGmailRoute(request('GET','/me/settings/gmail/scan-status'),r,{supabase:ownerDb(),config:routeConfig,gmailDeps:{listRecentScans:async()=>[{id:'scan1',status:'running',processed_count:4,relevant_count:3,trip_count:1,life_admin_count:1,ignored_count:1,review_items_created_count:1,started_at:'2026-09-13T00:00:00Z'}]}});assert.equal(r.status,200);assert.match(r.headers['content-type'],/application\/json/);const status=JSON.parse(r.body);assert.equal(status.latestScan.id,'scan1');assert.equal(status.latestScan.status,'running');assert.equal(status.latestScan.processed_count,4);assert.equal(status.latestScan.trip_count,1);assert.equal(status.latestScan.life_admin_count,1);assert.equal(status.latestScan.review_items_created_count,1);

  r=response();await handleGmailRoute(request('GET',`/me/settings/gmail/callback?code=bad&state=${longState}`,'',{cookie:`gmail_oauth_state=${longState}`}),r,{supabase:ownerDb(),config:routeConfig,gmailDeps:{googleOAuth:{exchangeCode:async()=>{throw new Error('token exchange failed');}},encryptAccessToken:v=>v,encryptRefreshToken:v=>v,upsertGmailConnection:async()=>({})}});assert.equal(r.status,302);assert.equal(r.headers.location,'/me/settings/gmail?oauth_error=1');
  console.log('gmail route tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
