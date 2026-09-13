const assert=require('node:assert/strict');
const {createApp,createGmailDeps}=require('../src/app');
const {GMAIL_READONLY_SCOPE}=require('../src/services/gmail-oauth');

const key=Buffer.alloc(32,7).toString('base64url');
const config={
  siteUrl:'https://preston.run',
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
