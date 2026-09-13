const assert = require('node:assert/strict');
const Module = require('node:module');
const { handleAuthRoute } = require('../src/routes/auth');
const { handleSiteRoute } = require('../src/routes/site');

function fakeRes(){
  return {status:null,headers:{},body:'',writeHead(status,headers={}){this.status=status;this.headers={...this.headers,...headers};},end(body=''){this.body+=body||'';},getHeader(name){return this.headers[name];},setHeader(name,val){this.headers[name]=val;}};
}
const config={siteUrl:'https://preston.run',ownerGoogleEmail:'owner@example.com',isProduction:true,supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'pub'};
(async()=>{
  let oauthArgs;
  let supabase={auth:{signInWithOAuth:async args=>{oauthArgs=args;return {data:{url:'https://accounts.google.com/x'},error:null};}}};
  let res=fakeRes(); assert.equal(await handleAuthRoute({method:'GET',url:'/auth/google'},res,{supabase,config}),true); assert.equal(res.status,302); assert.equal(res.headers.location,'https://accounts.google.com/x'); assert.deepEqual(oauthArgs,{provider:'google',options:{redirectTo:'https://preston.run/auth/callback'}}); assert.ok(!JSON.stringify(oauthArgs).toLowerCase().includes('gmail'));
  let exchanged=false,signedOut=false;
  supabase={auth:{exchangeCodeForSession:async code=>{exchanged=code==='abc';return {error:null};},getUser:async()=>({data:{user:{email:'owner@example.com'}},error:null}),signOut:async()=>{signedOut=true;}}};
  res=fakeRes(); await handleAuthRoute({method:'GET',url:'/auth/callback?code=abc'},res,{supabase,config}); assert.ok(exchanged); assert.equal(res.headers.location,'/'); assert.equal(signedOut,false);
  supabase={auth:{exchangeCodeForSession:async()=>({error:null}),getUser:async()=>({data:{user:{email:'other@example.com'}},error:null}),signOut:async()=>{signedOut=true;}}};
  signedOut=false;res=fakeRes();await handleAuthRoute({method:'GET',url:'/auth/callback?code=abc'},res,{supabase,config});assert.ok(signedOut);assert.equal(res.headers.location,'/auth/denied');
  supabase={auth:{signOut:async()=>{signedOut=true;}}};signedOut=false;res=fakeRes();await handleAuthRoute({method:'POST',url:'/auth/logout'},res,{supabase,config});assert.ok(signedOut);assert.equal(res.headers.location,'/');
  supabase={auth:{getUser:async()=>({data:{user:null},error:null}),signOut:async()=>{}}};res=fakeRes();await handleSiteRoute({method:'GET',url:'/'},res,{supabase,config});assert.equal(res.status,200);assert.ok(res.body.includes('Sign in with Google'));assert.ok(!res.body.includes('Website admin'));

  let manualRefreshCalls=0;
  res=fakeRes();
  assert.equal(await handleSiteRoute({method:'POST',url:'/fitness-context/refresh'},res,{supabase,config,siteDeps:{refreshFitnessContext:async()=>{manualRefreshCalls+=1;return{ok:true};}}}),true);
  assert.equal(res.status,302);assert.equal(res.headers.location,'/');assert.equal(manualRefreshCalls,0,'unauthenticated manual refresh must not run');

  supabase={auth:{getUser:async()=>({data:{user:{id:'u1',email:'owner@example.com',user_metadata:{name:'Preston'}}},error:null}),signOut:async()=>{}}};
  const baseSiteDeps={listPeople:async()=>[],listLifeItems:async()=>[],listTasks:async()=>[],listTrips:async()=>[],getUpcomingBirthdays:()=>[],getComingUpLifeItems:()=>[],getAttentionBuckets:()=>({overdue:[],today:[]}),excludeAttentionFromComingUp:rows=>rows,getUpcomingTrips:()=>[]};
  res=fakeRes();
  assert.equal(await handleSiteRoute({method:'POST',url:'/fitness-context/refresh'},res,{supabase,config,siteDeps:{refreshFitnessContext:async args=>{manualRefreshCalls+=1;assert.equal(args.userId,'u1');assert.equal(args.forceDigest,true);return{ok:true};}}}),true);
  assert.equal(res.status,302);assert.equal(res.headers.location,'/?fitness_refresh=ok');assert.equal(manualRefreshCalls,1);
  res=fakeRes();
  await handleSiteRoute({method:'POST',url:'/fitness-context/refresh'},res,{supabase,config,siteDeps:{refreshFitnessContext:async()=>({ok:false,error:new Error('down')})}});
  assert.equal(res.status,302);assert.equal(res.headers.location,'/?fitness_refresh=stale');

  const siteDeps={...baseSiteDeps,listCalendarDashboardData:async()=>({sources:[{id:'s1',display_name:'Home',selected:true}],events:[{id:'e1',calendar_source_id:'s1',title:'Breakfast',all_day:false,starts_at:'2026-09-13T00:00:00Z',ends_at:'2026-09-13T01:00:00Z',status:'confirmed',owner_response:'accepted'}]}),buildDashboardCalendar:()=>({personal:[{id:'e1',title:'Breakfast',allDay:false,startsAt:'2026-09-13T00:00:00Z',day:'today'}],holidays:[],reminders:[]})};
  res=fakeRes();await handleSiteRoute({method:'GET',url:'/'},res,{supabase,config,siteDeps});assert.equal(res.status,200);assert.ok(res.body.includes('Website admin'));assert.ok(res.body.includes('Breakfast'));assert.equal(res.headers['cache-control'],'private, no-store');
  const failingSiteDeps={...siteDeps,listCalendarDashboardData:async()=>{throw new Error('calendar down');}};
  res=fakeRes();await handleSiteRoute({method:'GET',url:'/'},res,{supabase,config,siteDeps:failingSiteDeps});assert.equal(res.status,200);assert.ok(res.body.includes('Calendar data is temporarily unavailable.'));assert.ok(res.body.includes('Birthdays'));assert.ok(res.body.includes('Trips'));

  const originalLoad=Module._load;
  Module._load=function(request,parent,isMain){if(request==='@supabase/ssr') return {createServerClient:()=>({})};return originalLoad.call(this,request,parent,isMain);};
  delete require.cache[require.resolve('../src/auth/supabase')]; delete require.cache[require.resolve('../src/app')];
  const {createApp}=require('../src/app'); Module._load=originalLoad;
  const ownerClient={auth:{getUser:async()=>({data:{user:{id:'u1',email:'owner@example.com'}},error:null}),signOut:async()=>{}}};
  const calendarDeps={listCalendarConnections:async()=>[],listCalendarSources:async()=>[]};
  const app=createApp(config,{createRequestSupabase:()=>ownerClient,calendarDeps});
  res=fakeRes();await app({method:'GET',url:'/settings/calendars',headers:{}},res);assert.equal(res.status,200);assert.match(res.body,/Calendars/);
  res=fakeRes();await app({method:'GET',url:'/private/secret',headers:{}},res);assert.equal(res.status,404);
  res=fakeRes();await app({method:'GET',url:'/manifest.webmanifest',headers:{}},res);assert.equal(res.status,200);assert.match(res.headers['content-type'],/manifest/);
  res=fakeRes();await app({method:'GET',url:'/../server.js',headers:{}},res);assert.equal(res.status,404);
  console.log('route tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
