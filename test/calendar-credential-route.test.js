const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {handleCalendarsRoute}=require('../src/routes/calendars');
const {encryptCredential}=require('../src/security/credential-crypto');
const realGoogle=require('../src/calendar/providers/google');

function res(){return{status:null,headers:{},body:'',writeHead(s,h={}){this.status=s;this.headers={...this.headers,...h};},end(b=''){this.body+=b||'';}};}
function req(url,state){const r=Readable.from([]);r.method='GET';r.url=url;r.headers={cookie:`calendar_oauth_state=${encodeURIComponent(state)}`};return r;}
function ownerSupabase(){return{auth:{getUser:async()=>({data:{user:{id:'u1',email:'owner@example.com'}},error:null}),signOut:async()=>{}}};}

(async()=>{
  const state='abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
  const saved=[];
  const config={
    siteUrl:'https://preston.run',
    ownerGoogleEmail:'owner@example.com',
    isProduction:true,
    googleCalendarClientId:'client-123',
    googleCalendarClientSecret:'client-secret',
    calendarCredentialKey:Buffer.alloc(32,7).toString('base64url')
  };
  const deps={
    encryptCredential,
    reportCalendarError:()=>{},
    googleProvider:{
      ...realGoogle,
      exchangeAuthorizationCode:async()=>({accessToken:'access-token',refreshToken:'refresh-token'}),
      listCalendars:async()=>[{id:'primary@example.com',name:'Personal',primary:true,readOnly:true}],
      getAccountIdentity:()=>({externalId:'primary@example.com',label:'primary@example.com'})
    },
    upsertCalendarConnection:async(_s,_u,input)=>{saved.push(input);return{id:'g1',...input};},
    replaceDiscoveredCalendarSources:async()=>[]
  };
  const r=res();
  await handleCalendarsRoute(req(`/settings/calendars/google/callback?code=code-1&state=${encodeURIComponent(state)}`,state),r,{supabase:ownerSupabase(),config,calendarDeps:deps});
  assert.equal(r.status,302);
  assert.equal(r.headers.location,'/settings/calendars?connected=google');
  assert.equal(saved.length,1);
  assert.match(saved[0].credential_ciphertext,/^v1\./);
  assert.equal(saved[0].credential_ciphertext.includes('refresh-token'),false);
  console.log('calendar credential route test passed');
})().catch(error=>{console.error(error);process.exit(1);});
