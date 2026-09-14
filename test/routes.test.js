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

  supabase={auth:{getUser:async()=>({data:{user:{id:'u1',email:'owner@example.com',user_metadata:{name:'Preston'}}},error:null}),signOut:async()=>{}}};
  const baseSiteDeps={listPeople:async()=>[],listLifeItems:async()=>[],listTasks:async()=>[],listTrips:async()=>[],getUpcomingBirthdays:()=>[],getComingUpLifeItems:()=>[],getAttentionBuckets:()=>({overdue:[],today:[]}),excludeAttentionFromComingUp:rows=>rows,getUpcomingTrips:()=>[]};
  const siteDeps={...baseSiteDeps,listCalendarDashboardData:async()=>({sources:[{id:'s1',display_name:'Home',selected:true}],events:[{id:'e1',calendar_source_id:'s1',title:'Breakfast',all_day:false,starts_at:'2026-09-13T00:00:00Z',ends_at:'2026-09-13T01:00:00Z',status:'confirmed',owner_response:'accepted'}]}),buildDashboardCalendar:()=>({personal:[{id:'e1',title:'Breakfast',allDay:false,startsAt:'2026-09-13T00:00:00Z',day:'today'}],holidays:[],reminders:[],plannedWorkouts:[]})};
  res=fakeRes();await handleSiteRoute({method:'GET',url:'/'},res,{supabase,config,siteDeps});assert.equal(res.status,200);assert.ok(res.body.includes('Website admin'));assert.ok(res.body.includes('Breakfast'));assert.equal(res.headers['cache-control'],'private, no-store');
  const failingSiteDeps={...siteDeps,listCalendarDashboardData:async()=>{throw new Error('calendar down');}};
  res=fakeRes();await handleSiteRoute({method:'GET',url:'/'},res,{supabase,config,siteDeps:failingSiteDeps});assert.equal(res.status,200);assert.ok(res.body.includes('Calendar data is temporarily unavailable.'));assert.ok(res.body.includes('Birthdays'));assert.ok(res.body.includes('Trips'));

  const travelTrip={id:'qt',title:'Queenstown',status:'upcoming',start_date:'2026-10-01',end_date:'2026-10-08'};
  let travelCalls=0,travelLoadArgs=null,travelRenderArgs=null;
  const travelDeps={...siteDeps,
    listTrips:async()=>[travelTrip,{id:'old',title:'Old',status:'completed',start_date:'2026-01-01',end_date:'2026-01-02'}],
    getUpcomingTrips:trips=>trips.filter(t=>t.id==='qt'),
    loadTravelDashboard:async args=>{travelCalls+=1;travelLoadArgs=args;return[{trip:travelTrip,inventory:['Flight'],items:[]}];},
    renderHomePage:args=>{travelRenderArgs=args;return'<!doctype html><title>travel home</title>';}
  };
  res=fakeRes();await handleSiteRoute({method:'GET',url:'/'},res,{supabase,config,siteDeps:travelDeps});
  assert.equal(res.status,200);assert.equal(travelCalls,1,'home must load travel dashboard once');assert.deepEqual(travelLoadArgs.trips,[travelTrip],'travel dashboard must receive already-filtered upcoming Trips');assert.equal(travelRenderArgs.travelTrips.length,1);assert.equal(travelRenderArgs.travelTrips[0].trip.id,'qt');assert.equal(travelRenderArgs.travelDataUnavailable,false);

  travelCalls=0;travelRenderArgs=null;
  const travelFailDeps={...travelDeps,loadTravelDashboard:async()=>{travelCalls+=1;throw new Error('travel down');},renderHomePage:args=>{travelRenderArgs=args;return'<!doctype html><title>travel degraded</title>';}};
  res=fakeRes();await handleSiteRoute({method:'GET',url:'/'},res,{supabase,config,siteDeps:travelFailDeps});
  assert.equal(res.status,200);assert.equal(travelCalls,1);assert.deepEqual(travelRenderArgs.travelTrips,[]);assert.equal(travelRenderArgs.travelDataUnavailable,true,'travel failure must degrade independently');

  let liveFetchCalls=0,calendarArgs=null,renderArgs=null;
  const cachedContext={payload:{schemaVersion:1,plannedWorkouts:[{id:'pw1',date:'2026-09-13',name:'Workout A',sport:'strength'}],actualActivities:[{id:'a1',date:'2026-09-13',name:'Workout A',type:'lift'}]},fetched_at:'2026-09-13T21:15:00Z'};
  const cachedDigest={digest_date:'2026-09-13',status:'good',headline:'Recovery signals look broadly normal.',cards:[],bullets:[],generated_at:'2026-09-13T21:16:00Z'};
  const cacheOnlyDeps={...siteDeps,
    getFitnessContext:async()=>cachedContext,
    getMorningDigest:async()=>cachedDigest,
    fetchDoseScaleContext:async()=>{liveFetchCalls+=1;throw new Error('page load must not fetch D&S');},
    buildDashboardCalendar:args=>{calendarArgs=args;return{personal:[],holidays:[],reminders:[],plannedWorkouts:[{id:'pw1',title:'Workout A',day:'today',completed:true}]};},
    renderHomePage:args=>{renderArgs=args;return '<!doctype html><title>cached home</title>';}
  };
  res=fakeRes();await handleSiteRoute({method:'GET',url:'/'},res,{supabase,config,siteDeps:cacheOnlyDeps});
  assert.equal(res.status,200);assert.equal(liveFetchCalls,0,'home GET must use cache only');
  assert.deepEqual(calendarArgs.plannedWorkouts,cachedContext.payload.plannedWorkouts);assert.deepEqual(calendarArgs.actualActivities,cachedContext.payload.actualActivities);
  assert.equal(renderArgs.morningDigest,cachedDigest);assert.equal(renderArgs.fitnessContext,cachedContext);assert.equal(renderArgs.fitnessUnavailable,false);

  renderArgs=null;
  const fitnessFailDeps={...cacheOnlyDeps,getFitnessContext:async()=>{throw new Error('fitness db down');},getMorningDigest:async()=>{throw new Error('digest db down');},buildDashboardCalendar:args=>{calendarArgs=args;return{personal:[],holidays:[],reminders:[],plannedWorkouts:[]};},renderHomePage:args=>{renderArgs=args;return '<!doctype html><title>degraded home</title>';}};
  res=fakeRes();await handleSiteRoute({method:'GET',url:'/'},res,{supabase,config,siteDeps:fitnessFailDeps});
  assert.equal(res.status,200);assert.equal(renderArgs.fitnessUnavailable,true);assert.equal(renderArgs.morningDigest,null);assert.deepEqual(calendarArgs.plannedWorkouts,[]);

  let refreshCalls=0;
  const refreshDeps={...siteDeps,refreshFitnessContext:async args=>{refreshCalls+=1;assert.equal(args.userId,'u1');assert.equal(args.forceDigest,true);return{ok:true};}};
  res=fakeRes();await handleSiteRoute({method:'POST',url:'/fitness-context/refresh'},res,{supabase,config,siteDeps:refreshDeps});assert.equal(refreshCalls,1);assert.equal(res.status,302);assert.equal(res.headers.location,'/?fitness_refresh=ok');
  const anonSupabase={auth:{getUser:async()=>({data:{user:null},error:null}),signOut:async()=>{}}};
  res=fakeRes();await handleSiteRoute({method:'POST',url:'/fitness-context/refresh'},res,{supabase:anonSupabase,config,siteDeps:refreshDeps});assert.equal(refreshCalls,1,'unauthenticated refresh must not run');assert.equal(res.status,302);assert.equal(res.headers.location,'/');

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
