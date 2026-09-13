const assert=require('node:assert/strict');
const {GMAIL_READONLY_SCOPE,buildGmailAuthUrl,fetchGmailProfile,exchangeGmailCode,refreshGmailAccessToken,createGmailOAuth}=require('../src/services/gmail-oauth');

const config={gmail:{clientId:'client1',clientSecret:'secret1',redirectUri:'https://preston.run/me/settings/gmail/callback'}};

const authUrl=buildGmailAuthUrl(config,{state:'state1'});
const parsed=new URL(authUrl);
assert.equal(parsed.hostname,'accounts.google.com');
assert.equal(parsed.searchParams.get('client_id'),'client1');
assert.equal(parsed.searchParams.get('redirect_uri'),config.gmail.redirectUri);
assert.equal(parsed.searchParams.get('response_type'),'code');
assert.equal(parsed.searchParams.get('access_type'),'offline');
assert.equal(parsed.searchParams.get('prompt'),'consent');
assert.equal(parsed.searchParams.get('scope'),GMAIL_READONLY_SCOPE);
assert.equal(parsed.searchParams.get('scope').includes('gmail.modify'),false);
assert.equal(parsed.searchParams.get('scope').includes('gmail.send'),false);
assert.throws(()=>buildGmailAuthUrl({gmail:{}}),/missing clientId/);

(async()=>{
  const calls=[];
  const profile=await fetchGmailProfile('access1',{fetch:async(url,opts)=>{
    calls.push({url,opts});
    return {ok:true,json:async()=>({emailAddress:'me@example.com',messagesTotal:10,threadsTotal:3})};
  }});
  assert.equal(profile.emailAddress,'me@example.com');
  assert.match(calls[0].url,/gmail\/v1\/users\/me\/profile/);
  assert.equal(calls[0].opts.headers.Authorization,'Bearer access1');

  const exchanged=await exchangeGmailCode(config,'code1',{fetch:async(url,opts)=>{
    assert.match(url,/oauth2\/v4\/token/);
    assert.equal(opts.method,'POST');
    assert.match(String(opts.body),/code=code1/);
    return {ok:true,json:async()=>({access_token:'access1',refresh_token:'refresh1',scope:GMAIL_READONLY_SCOPE,expires_in:3600,token_type:'Bearer'})};
  },fetchProfile:async(accessToken)=>({emailAddress:`${accessToken}@example.com`,id:'sub1'})});
  assert.equal(exchanged.accessToken,'access1');
  assert.equal(exchanged.refreshToken,'refresh1');
  assert.equal(exchanged.scope,GMAIL_READONLY_SCOPE);
  assert.equal(exchanged.accountEmail,'access1@example.com');

  const refreshed=await refreshGmailAccessToken(config,'refresh1',{fetch:async(url,opts)=>{
    assert.match(url,/oauth2\/v4\/token/);
    assert.equal(opts.method,'POST');
    const body=String(opts.body);
    assert.match(body,/grant_type=refresh_token/);
    assert.match(body,/refresh_token=refresh1/);
    assert.match(body,/client_id=client1/);
    assert.match(body,/client_secret=secret1/);
    return {ok:true,json:async()=>({access_token:'access2',scope:GMAIL_READONLY_SCOPE,expires_in:3600,token_type:'Bearer'})};
  }});
  assert.equal(refreshed.accessToken,'access2');
  assert.equal(refreshed.scope,GMAIL_READONLY_SCOPE);
  assert.equal(refreshed.expiresIn,3600);

  const oauth=createGmailOAuth(config,{fetch:async()=>({ok:true,json:async()=>({access_token:'a',refresh_token:'r',scope:GMAIL_READONLY_SCOPE})}),fetchProfile:async()=>({emailAddress:'me@example.com'})});
  assert.equal(typeof oauth.buildAuthUrl,'function');
  assert.equal(typeof oauth.exchangeCode,'function');
  assert.equal(oauth.buildAuthUrl({state:'x'}).includes('gmail.readonly'),true);
  console.log('gmail oauth tests passed');
})().catch(error=>{console.error(error);process.exit(1);});
