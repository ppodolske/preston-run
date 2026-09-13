const assert=require('node:assert/strict');
const {createGmailRouter,isGmailPath,buildGmailAuthUrl,completeGmailOAuthCallback,GMAIL_READONLY_SCOPE,tokenEncryptors,stateCookie,validOAuthState}=require('../src/routes/gmail');

assert.equal(typeof createGmailRouter,'function');
const router=createGmailRouter({});
assert.equal(typeof router,'function');
assert.equal(isGmailPath('/me/settings/gmail'),true);
assert.equal(isGmailPath('/me/settings/gmail/scan-now'),true);
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

(async()=>{
  let saved=null;
  let scanStarted=false;
  const result=await completeGmailOAuthCallback({
    supabase:{},
    userId:'user1',
    code:'code1',
    config:{gmail:{redirectUri:'https://preston.run/me/settings/gmail/callback'}},
    googleOAuth:{exchangeCode:async(code,opts)=>({accountEmail:'me@example.com',googleSubject:'sub1',accessToken:`access:${code}:${opts.redirectUri}`,refreshToken:'refresh',scope:GMAIL_READONLY_SCOPE})},
    encryptAccessToken:value=>`enc-access:${value}`,
    encryptRefreshToken:value=>`enc-refresh:${value}`,
    upsertGmailConnection:async(_db,userId,input)=>{saved={userId,input};return {id:'conn1'};},
    startScanNow:async()=>{scanStarted=true;throw new Error('scan should not start on callback');}
  });
  assert.equal(result.id,'conn1');
  assert.equal(saved.userId,'user1');
  assert.equal(saved.input.gmailAccountEmail,'me@example.com');
  assert.equal(saved.input.googleSubject,'sub1');
  assert.match(saved.input.accessTokenCiphertext,/^enc-access:access:code1:/);
  assert.equal(saved.input.refreshTokenCiphertext,'enc-refresh:refresh');
  assert.equal(saved.input.scope,GMAIL_READONLY_SCOPE);
  assert.equal(scanStarted,false,'OAuth callback must not start the first scan automatically');
  console.log('gmail route tests passed');
})();
