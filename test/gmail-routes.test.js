const assert=require('node:assert/strict');
const {createGmailRouter,isGmailPath,buildGmailAuthUrl,completeGmailOAuthCallback,GMAIL_READONLY_SCOPE}=require('../src/routes/gmail');

assert.equal(typeof createGmailRouter,'function');
const router=createGmailRouter({});
assert.equal(typeof router,'function');
assert.equal(isGmailPath('/me/settings/gmail'),true);
assert.equal(isGmailPath('/me/settings/gmail/scan-now'),true);
assert.equal(isGmailPath('/me/settings'),false);

let authArgs;
const authUrl=buildGmailAuthUrl({buildAuthUrl:args=>{authArgs=args;return '/google-auth';}},{gmail:{redirectUri:'https://preston.run/me/settings/gmail/callback'}});
assert.equal(authUrl,'/google-auth');
assert.deepEqual(authArgs.scope,[GMAIL_READONLY_SCOPE]);
assert.equal(authArgs.scope.includes('https://www.googleapis.com/auth/gmail.modify'),false);
assert.equal(authArgs.scope.includes('https://www.googleapis.com/auth/gmail.send'),false);

(async()=>{
  let saved=null;
  let scanStarted=false;
  const result=await completeGmailOAuthCallback({
    supabase:{},
    userId:'user1',
    code:'code1',
    config:{gmail:{redirectUri:'https://preston.run/me/settings/gmail/callback'}},
    googleOAuth:{exchangeCode:async(code,opts)=>({accountEmail:'me@example.com',googleSubject:'sub1',accessToken:`access:${code}:${opts.redirectUri}`,refreshToken:'refresh',scope:GMAIL_READONLY_SCOPE})},
    encrypt:value=>`enc:${value}`,
    upsertGmailConnection:async(_db,userId,input)=>{saved={userId,input};return {id:'conn1'};},
    startScanNow:async()=>{scanStarted=true;throw new Error('scan should not start on callback');}
  });
  assert.equal(result.id,'conn1');
  assert.equal(saved.userId,'user1');
  assert.equal(saved.input.gmailAccountEmail,'me@example.com');
  assert.equal(saved.input.googleSubject,'sub1');
  assert.match(saved.input.accessTokenCiphertext,/^enc:access:code1:/);
  assert.equal(saved.input.refreshTokenCiphertext,'enc:refresh');
  assert.equal(saved.input.scope,GMAIL_READONLY_SCOPE);
  assert.equal(scanStarted,false,'OAuth callback must not start the first scan automatically');
  console.log('gmail route tests passed');
})();
