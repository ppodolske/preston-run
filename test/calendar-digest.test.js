const assert=require('node:assert/strict');
let getCalendarDigest;try{({getCalendarDigest}=require('../src/services/calendar-digest'));}catch(e){assert.fail(`Calendar digest service required: ${e.message}`);}

const now=new Date('2026-09-12T21:05:00Z'); // 2026-09-13 07:05 Sydney
function event(overrides={}){return{connection_id:'g1',calendar_source_id:'s1',provider_event_id:'e1',occurrence_key:'e1:2026-09-13T00:00:00Z',title:'Event',all_day:false,starts_at:'2026-09-13T00:00:00Z',ends_at:'2026-09-13T01:00:00Z',start_date:null,end_date:null,status:'confirmed',owner_response:'accepted',...overrides};}
function deps(overrides={}){return{
  listConnections:async()=>[
    {id:'g1',provider:'google',last_success_at:'2026-09-12T22:00:00Z'},
    {id:'a1',provider:'apple',last_success_at:'2026-09-12T22:00:00Z'}
  ],
  listSelectedSources:async()=>[
    {id:'s1',connection_id:'g1',display_name:'Personal',selected:true},
    {id:'s2',connection_id:'a1',display_name:'Home',selected:true}
  ],
  listEvents:async()=>[],...overrides};}

(async()=>{
  const d=deps({listEvents:async()=>[
    event({title:'Overnight',starts_at:'2026-09-12T13:00:00Z',ends_at:'2026-09-12T22:30:00Z',occurrence_key:'overnight'}),
    event({title:'Today 8',starts_at:'2026-09-12T22:00:00Z',ends_at:'2026-09-12T23:00:00Z',occurrence_key:'today8'}),
    event({title:'Today all day',all_day:true,starts_at:null,ends_at:null,start_date:'2026-09-13',end_date:'2026-09-14',occurrence_key:'allday-today'}),
    event({connection_id:'a1',calendar_source_id:'s2',title:'Tomorrow 9',starts_at:'2026-09-13T23:00:00Z',ends_at:'2026-09-14T00:00:00Z',occurrence_key:'tomorrow9'}),
    event({connection_id:'a1',calendar_source_id:'s2',title:'Tomorrow all day',all_day:true,starts_at:null,ends_at:null,start_date:'2026-09-14',end_date:'2026-09-15',occurrence_key:'allday-tomorrow'}),
    event({title:'After cutoff',starts_at:'2026-09-13T23:01:00Z',ends_at:'2026-09-14T00:30:00Z',occurrence_key:'after'}),
    event({title:'Cancelled',status:'cancelled',occurrence_key:'cancelled'}),
    event({title:'Declined',owner_response:'declined',occurrence_key:'declined'}),
    event({title:'Tentative',status:'tentative',starts_at:'2026-09-13T02:00:00Z',ends_at:'2026-09-13T03:00:00Z',occurrence_key:'tentative'}),
    event({calendar_source_id:'not-selected',title:'Unselected',occurrence_key:'unselected'})
  ]});
  const out=await getCalendarDigest({supabase:{},userId:'u1',now,deps:d});
  assert.equal(out.attentionNeeded,false);
  assert.deepEqual(out.events.map(x=>x.title),['Today all day','Overnight','Today 8','Tentative','Tomorrow all day','Tomorrow 9']);
  assert.equal(out.events.find(x=>x.title==='Tentative').status,'tentative');

  const stale=deps({
    listConnections:async()=>[{id:'g1',provider:'google',last_success_at:'2026-09-11T20:00:00Z'}],
    listSelectedSources:async()=>[{id:'s1',connection_id:'g1',display_name:'Personal',selected:true}],
    listEvents:async()=>[event({title:'Would otherwise show'})]
  });
  const staleOut=await getCalendarDigest({supabase:{},userId:'u1',now,deps:stale});assert.deepEqual(staleOut.events,[]);assert.equal(staleOut.attentionNeeded,true);

  const staleIrrelevant=deps({
    listConnections:async()=>[{id:'g1',provider:'google',last_success_at:'2026-09-11T20:00:00Z'}],
    listSelectedSources:async()=>[{id:'s1',connection_id:'g1',display_name:'Personal',selected:true}],
    listEvents:async()=>[event({title:'Next week',starts_at:'2026-09-20T00:00:00Z',ends_at:'2026-09-20T01:00:00Z'})]
  });
  const irrelevant=await getCalendarDigest({supabase:{},userId:'u1',now,deps:staleIrrelevant});assert.deepEqual(irrelevant.events,[]);assert.equal(irrelevant.attentionNeeded,false);

  const empty=await getCalendarDigest({supabase:{},userId:'u1',now,deps:deps()});assert.deepEqual(empty,{events:[],attentionNeeded:false});
  console.log('calendar digest tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
