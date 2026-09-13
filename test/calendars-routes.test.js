const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const realGoogle=require('../src/calendar/providers/google');
let handleCalendarsRoute;
try{({handleCalendarsRoute}=require('../src/routes/calendars'));}catch(error){assert.fail(`Calendars route module required: ${error.message}`);}

function res(){return{status:null,headers:{},body:'',writeHead(s,h={}){this.status=s;this.headers={...this.headers,...h};},end(b=''){this.body+=b||'';}};}
function req(method,url,body='',headers={}){const r=Readable.from(body?[Buffer.from(body)]:[]);r.method=method;r.url=url;r.headers={...(method==='POST'?{'content-type':'application/x-www-form-urlencoded',origin:'https://preston.run'}:{}),...headers};return r;}
function ownerSupabase(owner=true){return{auth:{getUser:async()=>owner?{data:{user:{id:'u1',email:'owner@example.com'}},error:null}:{data:{user:null},error:null},signOut:async()=>{}}};}
const config={siteUrl:'https://preston.run',ownerGoogleEmail:'owner@example.com',isProduction:true,googleCalendarClientId:'client-123',googleCalendarClientSecret:'client-secret',calendarCredentialKey:'key'};

(async()=>{
 const calls=[];
 const state={connections:[],sources:[]};
 const deps={
  listCalendarConnections:async()=>state.connections,
  listCalendarSources:async()=>state.sources,
  upsertCalendarConnection:async(_s,_u,input)=>{const row={id:input.provider==='google'?'g1':'a1',...input};state.connections=state.connections.filter(x=>x.provider!==input.provider).concat(row);calls.push(['upsert',input]);return row;},
  replaceDiscoveredCalendarSources:async(_s,_u,connectionId,rows)=>{state.sources=rows.map((x,i)=>({id:`s${i+1}`,connection_id:connectionId,provider_calendar_id:x.provider_calendar_id,display_name:x.display_name,selected:false,read_only:true}));calls.push(['discover',connectionId,rows]);return state.sources;},
  setCalendarSourceSelected:async(_s,_u,id,selected)=>{const row=state.sources.find(x=>x.id===id);if(row)row.selected=selected;calls.push(['toggle',id,selected]);return row||null;},
  deleteCalendarConnection:async(_s,_u,id)=>{state.connections=state.connections.filter(x=>x.id!==id);state.sources=state.sources.filter(x=>x.connection_id!==id);calls.push(['disconnect',id]);return{id};},
  syncCalendars:async()=>{calls.push(['sync']);return{connections:1,succeeded:1,failed:0};},
  encryptCredential:()=> 'encrypted-envelope',
  googleProvider:{...realGoogle,exchangeAuthorizationCode:async()=>({accessToken:'access-token',refreshToken:'refresh-token',expiresIn:3600}),listCalendars:async()=>[{id:'primary@example.com',name:'Personal',primary:true,color:null,readOnly:true}],getAccountIdentity:()=>({externalId:'primary@example.com',label:'primary@example.com'})},
  appleProvider:{validateAppleCredentials:async()=>true,listCalendars:async()=>[{id:'/cal/home',name:'Home',color:null,readOnly:true}]}
 };
 
 let r=res();await handleCalendarsRoute(req('GET','/settings/calendars'),r,{supabase:ownerSupabase(false),config,calendarDeps:deps});assert.equal(r.status,302);assert.equal(r.headers.location,'/');
 
 r=res();await handleCalendarsRoute(req('GET','/settings/calendars/google/connect'),r,{supabase:ownerSupabase(),config,calendarDeps:deps});assert.equal(r.status,302);const auth=new URL(r.headers.location);assert.equal(auth.origin,'https://accounts.google.com');assert.equal(auth.searchParams.get('scope'),'https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events.readonly');assert.ok((r.headers['set-cookie']||'').includes('calendar_oauth_state='));assert.ok((r.headers['set-cookie']||'').includes('HttpOnly'));assert.ok((r.headers['set-cookie']||'').includes('SameSite=Lax'));assert.ok((r.headers['set-cookie']||'').includes('Secure'));
 const stateValue=decodeURIComponent((r.headers['set-cookie'].match(/calendar_oauth_state=([^;]+)/)||[])[1]);
 
 r=res();await handleCalendarsRoute(req('GET','/settings/calendars/google/callback?code=x&state=wrong','',{cookie:`calendar_oauth_state=${encodeURIComponent(stateValue)}`}),r,{supabase:ownerSupabase(),config,calendarDeps:deps});assert.equal(r.status,400);
 
 r=res();await handleCalendarsRoute(req('GET',`/settings/calendars/google/callback?code=code-1&state=${encodeURIComponent(stateValue)}`,'',{cookie:`calendar_oauth_state=${encodeURIComponent(stateValue)}`}),r,{supabase:ownerSupabase(),config,calendarDeps:deps});assert.equal(r.status,302);assert.equal(r.headers.location,'/settings/calendars?connected=google');const googleUpsert=calls.find(x=>x[0]==='upsert'&&x[1].provider==='google');assert.ok(googleUpsert);assert.equal(googleUpsert[1].credential_ciphertext,'encrypted-envelope');assert.equal(JSON.stringify(googleUpsert).includes('refresh-token'),false);assert.equal(state.sources[0].selected,false);

 const diagnostics=[];const failingDeps={...deps,reportCalendarError:(provider,stage,error)=>diagnostics.push({provider,stage,message:error&&error.message}),googleProvider:{...deps.googleProvider,listCalendars:async()=>{throw new Error('Google Calendar calendar discovery failed (403)');}}};
 r=res();await handleCalendarsRoute(req('GET',`/settings/calendars/google/callback?code=code-2&state=${encodeURIComponent(stateValue)}`,'',{cookie:`calendar_oauth_state=${encodeURIComponent(stateValue)}`}),r,{supabase:ownerSupabase(),config,calendarDeps:failingDeps});assert.equal(r.status,302);assert.equal(r.headers.location,'/settings/calendars?error=google');assert.deepEqual(diagnostics,[{provider:'google',stage:'calendar_discovery',message:'Google Calendar calendar discovery failed (403)'}]);
 
 r=res();await handleCalendarsRoute(req('POST','/settings/calendars/apple/connect','email=icloud%40example.com&app_specific_password=app-password-secret'),r,{supabase:ownerSupabase(),config,calendarDeps:deps});assert.equal(r.status,302);assert.equal(r.headers.location,'/settings/calendars?connected=apple');const appleUpsert=calls.find(x=>x[0]==='upsert'&&x[1].provider==='apple');assert.ok(appleUpsert);assert.equal(appleUpsert[1].credential_ciphertext,'encrypted-envelope');assert.equal(JSON.stringify(appleUpsert).includes('app-password-secret'),false);
 
 const sourceId=state.sources[0].id;r=res();await handleCalendarsRoute(req('POST',`/settings/calendars/sources/${sourceId}/toggle`,'selected=true'),r,{supabase:ownerSupabase(),config,calendarDeps:deps});assert.equal(r.status,302);assert.equal(state.sources[0].selected,true);
 r=res();const bad=req('POST','/settings/calendars/sync','');bad.headers.origin='https://evil.example';await handleCalendarsRoute(bad,r,{supabase:ownerSupabase(),config,calendarDeps:deps});assert.equal(r.status,403);
 r=res();await handleCalendarsRoute(req('POST','/settings/calendars/sync',''),r,{supabase:ownerSupabase(),config,calendarDeps:deps});assert.equal(r.status,302);assert.equal(calls.filter(x=>x[0]==='sync').length,1);
 
 const apple=state.connections.find(x=>x.provider==='apple');r=res();await handleCalendarsRoute(req('POST','/settings/calendars/apple/disconnect',''),r,{supabase:ownerSupabase(),config,calendarDeps:deps});assert.equal(r.status,302);assert.ok(calls.some(x=>x[0]==='disconnect'&&x[1]===apple.id));
 console.log('calendar settings route tests passed');
})().catch(e=>{console.error(e);process.exit(1)});