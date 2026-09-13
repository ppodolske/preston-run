const assert=require('node:assert/strict');
const {
  getCalendarConnection,getCalendarConnectionWithCredential,listCalendarConnections,upsertCalendarConnection,updateCalendarSyncState,deleteCalendarConnection,
  listCalendarSources,replaceDiscoveredCalendarSources,setCalendarSourceSelected,listSelectedCalendarSources,
  upsertCalendarEvents,listCalendarEventsForDigest,listCalendarDashboardData,deleteEventsForSource,deleteUnseenEventsForSource,deleteEventsOutsideWindow
}=require('../src/data/calendars');

function builder({rows=[],singleRow=null}={}){
  const calls=[];let payload=null,mode='select';
  const b={calls,
    select(v='*'){calls.push(['select',v]);return b;},insert(v){mode='insert';payload=v;calls.push(['insert',v]);return b;},
    upsert(v,o){mode='upsert';payload=v;calls.push(['upsert',v,o]);return b;},update(v){mode='update';payload=v;calls.push(['update',v]);return b;},delete(){mode='delete';calls.push(['delete']);return b;},
    eq(k,v){calls.push(['eq',k,v]);return b;},lt(k,v){calls.push(['lt',k,v]);return b;},gte(k,v){calls.push(['gte',k,v]);return b;},lte(k,v){calls.push(['lte',k,v]);return b;},or(v){calls.push(['or',v]);return b;},order(k,o){calls.push(['order',k,o]);return b;},
    maybeSingle(){calls.push(['maybeSingle']);return Promise.resolve({data:singleRow,error:null});},single(){calls.push(['single']);return Promise.resolve({data:singleRow||{id:'saved',...(Array.isArray(payload)?payload[0]:payload)},error:null});},
    then(resolve,reject){calls.push(['then']);return Promise.resolve({data:rows,error:null}).then(resolve,reject);}
  };return b;
}
function has(b,op,key,val){return b.calls.some(x=>x[0]===op&&(key===undefined||x[1]===key)&&(val===undefined||x[2]===val));}
function ownerFiltered(b){return has(b,'eq','user_id','u1');}

(async()=>{
  let b=builder({singleRow:{id:'c1',user_id:'u1',provider:'google',account_label:'Me'}}),s={from:t=>{assert.equal(t,'calendar_connections');return b;}};
  const c=await getCalendarConnection(s,'u1','google');assert.equal(ownerFiltered(b),true);assert.equal(c.id,'c1');
  const normalSelect=b.calls.find(x=>x[0]==='select')[1];assert.doesNotMatch(normalSelect,/credential_ciphertext/,'page-safe connection read must not select credential');
  assert.ok(has(b,'eq','provider','google'));

  b=builder({singleRow:{id:'c1',credential_ciphertext:'v1.secret'}});s={from:()=>b};await getCalendarConnectionWithCredential(s,'u1','c1');assert.equal(ownerFiltered(b),true);assert.match(b.calls.find(x=>x[0]==='select')[1],/credential_ciphertext/);

  b=builder({rows:[]});s={from:()=>b};await listCalendarConnections(s,'u1');assert.equal(ownerFiltered(b),true);assert.doesNotMatch(b.calls.find(x=>x[0]==='select')[1],/credential_ciphertext/);

  b=builder({singleRow:{id:'c1'}});s={from:()=>b};await upsertCalendarConnection(s,'u1',{user_id:'evil',provider:'google',account_external_id:'acct',account_label:'Me',credential_ciphertext:'v1.cipher'});const up=b.calls.find(x=>x[0]==='upsert');assert.equal(up[1].user_id,'u1');assert.equal(up[1].provider,'google');assert.equal(up[2].onConflict,'user_id,provider');
  b=builder({singleRow:{id:'c1'}});s={from:()=>b};await updateCalendarSyncState(s,'u1','c1',{status:'attention',last_attempt_at:'2026-09-13T00:00:00Z',last_error:'network'});assert.equal(ownerFiltered(b),true);assert.ok(has(b,'eq','id','c1'));
  b=builder({singleRow:{id:'c1'}});s={from:()=>b};await deleteCalendarConnection(s,'u1','c1');assert.equal(ownerFiltered(b),true);assert.ok(has(b,'eq','id','c1'));

  b=builder({rows:[]});s={from:t=>{assert.equal(t,'calendar_sources');return b;}};await listCalendarSources(s,'u1','c1');assert.equal(ownerFiltered(b),true);assert.ok(has(b,'eq','connection_id','c1'));
  b=builder({rows:[]});s={from:()=>b};await listSelectedCalendarSources(s,'u1','c1');assert.equal(ownerFiltered(b),true);assert.ok(has(b,'eq','selected',true));
  b=builder({singleRow:{id:'s1',selected:true}});s={from:()=>b};await setCalendarSourceSelected(s,'u1','s1',true);assert.equal(ownerFiltered(b),true);assert.ok(has(b,'eq','id','s1'));

  const existing=[{id:'s1',user_id:'u1',connection_id:'c1',provider_calendar_id:'home',display_name:'Old',selected:true,read_only:true}];
  const read=builder({rows:existing}),write=builder({rows:[]});let n=0;s={from:t=>{assert.equal(t,'calendar_sources');return n++===0?read:write;}};
  await replaceDiscoveredCalendarSources(s,'u1','c1',[{provider_calendar_id:'home',display_name:'Home'},{provider_calendar_id:'birthdays',display_name:'Birthdays'}]);
  const sourceUpsert=write.calls.find(x=>x[0]==='upsert');assert.ok(sourceUpsert);const payload=sourceUpsert[1];assert.equal(payload.find(x=>x.provider_calendar_id==='home').selected,true,'rediscovery preserves explicit selection');assert.equal(payload.find(x=>x.provider_calendar_id==='birthdays').selected,false,'new calendars default off');assert.ok(payload.every(x=>x.user_id==='u1'&&x.connection_id==='c1'));

  const events=builder({rows:[]});s={from:t=>{assert.equal(t,'calendar_events');return events;}};
  await upsertCalendarEvents(s,'u1','c1','s1',[{provider_event_id:'e1',occurrence_key:'e1@2026-09-13',title:'Meeting',all_day:false,starts_at:'2026-09-13T00:00:00Z',ends_at:'2026-09-13T01:00:00Z',start_date:null,end_date:null,status:'confirmed',owner_response:'accepted'}],'2026-09-13T05:00:00Z');
  const eventUpsert=events.calls.find(x=>x[0]==='upsert');assert.equal(eventUpsert[2].onConflict,'user_id,calendar_source_id,occurrence_key');assert.equal(eventUpsert[1][0].user_id,'u1');assert.equal(eventUpsert[1][0].connection_id,'c1');assert.equal(eventUpsert[1][0].calendar_source_id,'s1');assert.equal(eventUpsert[1][0].sync_seen_at,'2026-09-13T05:00:00Z');

  b=builder({rows:[]});s={from:()=>b};await listCalendarEventsForDigest(s,'u1');assert.equal(ownerFiltered(b),true);

  const dashboardEvents=builder({rows:[{id:'e1'}]}),dashboardSources=builder({rows:[{id:'s1',selected:true}]});
  s={from:t=>t==='calendar_events'?dashboardEvents:dashboardSources};
  const dashboardData=await listCalendarDashboardData(s,'u1');
  assert.deepEqual(dashboardData,{events:[{id:'e1'}],sources:[{id:'s1',selected:true}]});
  assert.equal(ownerFiltered(dashboardEvents),true);assert.equal(ownerFiltered(dashboardSources),true);assert.ok(has(dashboardSources,'eq','selected',true));

  b=builder({rows:[]});s={from:()=>b};await deleteEventsForSource(s,'u1','s1');assert.equal(ownerFiltered(b),true);assert.ok(has(b,'eq','calendar_source_id','s1'));
  b=builder({rows:[]});s={from:()=>b};await deleteUnseenEventsForSource(s,'u1','s1','2026-09-13T05:00:00Z');assert.equal(ownerFiltered(b),true);assert.ok(has(b,'eq','calendar_source_id','s1'));assert.ok(has(b,'lt','sync_seen_at','2026-09-13T05:00:00Z'));
  b=builder({rows:[]});s={from:()=>b};await deleteEventsOutsideWindow(s,'u1','2026-08-14','2027-09-13');assert.equal(ownerFiltered(b),true);assert.ok(b.calls.some(x=>x[0]==='or'),'window cleanup must remain one owner-scoped delete');

  await assert.rejects(()=>listCalendarConnections(s,''),/Authenticated user/);
  console.log('calendar data tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
