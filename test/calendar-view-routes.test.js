'use strict';
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {handleCalendarsRoute}=require('../src/routes/calendars');

function res(){return{status:null,headers:{},body:'',writeHead(s,h={}){this.status=s;this.headers={...this.headers,...h};},end(b=''){this.body+=b||'';}};}
function req(url){const r=Readable.from([]);r.method='GET';r.url=url;r.headers={};return r;}
function ownerSupabase(owner=true){return{auth:{getUser:async()=>owner?{data:{user:{id:'u1',email:'owner@example.com'}},error:null}:{data:{user:null},error:null},signOut:async()=>{}}};}
const config={siteUrl:'https://preston.run',ownerGoogleEmail:'owner@example.com',isProduction:true,calendarCredentialKey:Buffer.alloc(32,7).toString('base64url')};

(async()=>{
  let providerCalled=false,syncCalled=false;
  const deps={
    listCalendarViewData:async()=>({
      sources:[{id:'s1',display_name:'Home',color:'#123456',selected:true}],
      events:[{id:'e1',calendar_source_id:'s1',title:'Dinner',all_day:false,starts_at:'2026-09-15T08:00:00Z',ends_at:'2026-09-15T09:00:00Z',status:'confirmed',owner_response:'accepted',location:'Sydney',external_url:'https://calendar.example/e1'}]
    }),
    syncCalendars:async()=>{syncCalled=true;},
    googleProvider:{listCalendars:async()=>{providerCalled=true;return[];}},
    appleProvider:{listCalendars:async()=>{providerCalled=true;return[];}}
  };
  let r=res();await handleCalendarsRoute(req('/calendar'),r,{supabase:ownerSupabase(false),config,calendarDeps:deps});assert.equal(r.status,302);assert.equal(r.headers.location,'/');
  r=res();await handleCalendarsRoute(req('/calendar?month=2026-09'),r,{supabase:ownerSupabase(),config,calendarDeps:deps});assert.equal(r.status,200);assert.match(r.body,/Calendar/);assert.match(r.body,/September 2026/);assert.match(r.body,/Dinner/);assert.match(r.body,/Back to dashboard/);assert.match(r.body,/Calendar Settings/);assert.match(r.body,/month=2026-08/);assert.match(r.body,/month=2026-10/);assert.equal(providerCalled,false);assert.equal(syncCalled,false);
  const failing={...deps,listCalendarViewData:async()=>{throw new Error('db unavailable');}};
  r=res();await handleCalendarsRoute(req('/calendar?month=2026-09'),r,{supabase:ownerSupabase(),config,calendarDeps:failing});assert.equal(r.status,200);assert.match(r.body,/Calendar data is temporarily unavailable/);assert.match(r.body,/Calendar Settings/);
  console.log('calendar view route tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
