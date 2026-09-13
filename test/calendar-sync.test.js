const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {encryptCredential}=require('../src/security/credential-crypto');

const syncModule=()=>require('../src/services/calendar-sync.js');

function makeHarness({googleFails=false}={}){
  const key=crypto.randomBytes(32);
  const now=new Date('2026-09-13T20:55:00.000Z');
  const connections=[
    {id:'g1',user_id:'u1',provider:'google',status:'connected'},
    {id:'a1',user_id:'u1',provider:'apple',status:'connected'}
  ];
  const secrets={
    g1:{...connections[0],credential_ciphertext:encryptCredential({refreshToken:'google-refresh-secret'},key)},
    a1:{...connections[1],credential_ciphertext:encryptCredential({email:'owner@icloud.com',appSpecificPassword:'apple-secret'},key)}
  };
  const sourceState={
    g1:[
      {id:'gs1',connection_id:'g1',provider_calendar_id:'g-personal',display_name:'Personal',selected:true,read_only:true},
      {id:'gs2',connection_id:'g1',provider_calendar_id:'g-work',display_name:'Work',selected:false,read_only:true}
    ],
    a1:[
      {id:'as1',connection_id:'a1',provider_calendar_id:'a-personal',display_name:'iCloud',selected:true,read_only:true},
      {id:'as2',connection_id:'a1',provider_calendar_id:'a-old',display_name:'Old',selected:false,read_only:true}
    ]
  };
  const calls=[];
  const syncState=[];
  const upserts=[];
  let decrypted=[];

  const data={
    async listCalendarConnections(_supabase,userId){assert.equal(userId,'u1');return connections;},
    async getCalendarConnectionWithCredential(_supabase,userId,id){assert.equal(userId,'u1');return secrets[id];},
    async updateCalendarSyncState(_supabase,userId,id,patch){syncState.push({userId,id,patch});return {id,...patch};},
    async replaceDiscoveredCalendarSources(_supabase,userId,connectionId,discovered){
      calls.push(['discover',connectionId,discovered]);
      const existing=sourceState[connectionId];
      const byProvider=new Map(existing.map(x=>[x.provider_calendar_id,x]));
      for(const row of discovered){
        const old=byProvider.get(row.provider_calendar_id);
        if(old){Object.assign(old,{display_name:row.display_name,color:row.color,read_only:row.read_only});}
        else existing.push({id:`new-${connectionId}-${row.provider_calendar_id}`,connection_id:connectionId,...row,selected:false});
      }
      return existing;
    },
    async listCalendarSources(_supabase,userId,connectionId){assert.equal(userId,'u1');return sourceState[connectionId];},
    async listSelectedCalendarSources(_supabase,userId,connectionId){assert.equal(userId,'u1');return sourceState[connectionId].filter(x=>x.selected);},
    async upsertCalendarEvents(_supabase,userId,connectionId,sourceId,events,syncMarker){upserts.push({userId,connectionId,sourceId,events,syncMarker});return events;},
    async deleteUnseenEventsForSource(_supabase,userId,sourceId,syncMarker){calls.push(['delete-unseen',userId,sourceId,syncMarker]);},
    async deleteEventsForSource(_supabase,userId,sourceId){calls.push(['delete-source',userId,sourceId]);},
    async deleteEventsOutsideWindow(_supabase,userId,startDate,endDate){calls.push(['delete-window',userId,startDate,endDate]);}
  };

  const providers={
    google:{
      async refreshAccessToken(args){
        calls.push(['google-refresh',args.refreshToken,args.clientId,args.clientSecret]);
        if(googleFails)throw new Error('Google Calendar token refresh failed (400): google-refresh-secret raw provider body');
        return {accessToken:'short-lived-google-access'};
      },
      async listCalendars({accessToken}){calls.push(['google-calendars',accessToken]);return[
        {id:'g-personal',name:'Personal renamed',color:'#111',readOnly:true},
        {id:'g-work',name:'Work',color:'#222',readOnly:true},
        {id:'g-new',name:'New shared calendar',color:'#333',readOnly:true}
      ];},
      async listEventOccurrences({calendarId,accessToken,start,end}){calls.push(['google-events',calendarId,accessToken,start,end]);return [{providerEventId:'ge1',occurrenceKey:'ge1',seriesId:null,title:'Google Event',allDay:false,startsAt:'2026-09-13T22:00:00.000Z',endsAt:'2026-09-13T23:00:00.000Z',startDate:null,endDate:null,timeZone:'Australia/Sydney',location:null,status:'confirmed',ownerResponse:'accepted',externalUrl:null,providerUpdatedAt:null}];}
    },
    apple:{
      async listCalendars(credentials){calls.push(['apple-calendars',credentials.email,credentials.appSpecificPassword]);return[
        {id:'a-personal',name:'iCloud renamed',color:null,readOnly:true},
        {id:'a-new',name:'New Apple calendar',color:null,readOnly:true}
      ];},
      async listEventOccurrences({calendarHref,credentials,start,end}){calls.push(['apple-events',calendarHref,credentials.email,credentials.appSpecificPassword,start,end]);return [{providerEventId:'ae1',occurrenceKey:'ae1:1',seriesId:null,title:'Apple Event',allDay:true,startsAt:null,endsAt:null,startDate:'2026-09-14',endDate:'2026-09-15',timeZone:null,location:null,status:'tentative',ownerResponse:'unknown',externalUrl:null,providerUpdatedAt:null}];}
    }
  };

  const deps={
    data,
    decryptCredential(envelope,receivedKey){assert.equal(receivedKey,key);const result=require('../src/security/credential-crypto').decryptCredential(envelope,receivedKey);decrypted.push(result);return result;}
  };

  return {key,now,connections,sourceState,calls,syncState,upserts,providers,deps,getDecrypted:()=>decrypted};
}

(async()=>{
  let mod;
  try{mod=syncModule();}catch(error){assert.fail(`Calendar sync service module required: ${error.message}`);}

  {
    const h=makeHarness();
    const result=await mod.syncCalendars({supabase:{},userId:'u1',now:h.now,credentialKey:h.key,googleConfig:{clientId:'gid',clientSecret:'gsecret'},providers:h.providers,deps:h.deps});
    assert.equal(result.connections.length,2);
    assert.equal(result.connections.every(x=>x.ok),true);
    assert.equal(h.getDecrypted().length,2,'credentials decrypt only inside orchestration');
    assert.equal(h.calls.some(x=>x[0]==='google-events'&&x[1]==='g-personal'),true);
    assert.equal(h.calls.some(x=>x[0]==='google-events'&&x[1]==='g-work'),false,'deselected Google source must not fetch');
    assert.equal(h.calls.some(x=>x[0]==='apple-events'&&x[1]==='a-personal'),true);
    assert.equal(h.calls.some(x=>x[0]==='apple-events'&&x[1]==='a-old'),false,'deselected Apple source must not fetch');
    assert.equal(h.sourceState.g1.find(x=>x.provider_calendar_id==='g-personal').selected,true,'rediscovery preserves selection');
    assert.equal(h.sourceState.g1.find(x=>x.provider_calendar_id==='g-new').selected,false,'new source defaults unselected');
    assert.equal(h.sourceState.a1.find(x=>x.provider_calendar_id==='a-new').selected,false,'new Apple source defaults unselected');
    assert.equal(h.calls.some(x=>x[0]==='delete-source'&&x[2]==='gs2'),true,'deselected cached rows cleaned');
    assert.equal(h.calls.some(x=>x[0]==='delete-source'&&x[2]==='as2'),true,'deselected Apple cached rows cleaned');
    assert.equal(h.upserts.length,2);
    for(const write of h.upserts){
      assert.equal(typeof write.syncMarker,'string');
      assert.match(write.syncMarker,/Z$/);
      const row=write.events[0];
      assert.ok(Object.hasOwn(row,'provider_event_id'));
      assert.ok(Object.hasOwn(row,'occurrence_key'));
      assert.equal(Object.hasOwn(row,'providerEventId'),false,'provider rows normalized before persistence');
      assert.equal(h.calls.some(x=>x[0]==='delete-unseen'&&x[2]===write.sourceId&&x[3]===write.syncMarker),true);
    }
    assert.equal(h.calls.filter(x=>x[0]==='delete-window').length,1);
    const successUpdates=h.syncState.filter(x=>x.patch.last_success_at);
    assert.equal(successUpdates.length,2);
    assert.equal(successUpdates.every(x=>x.patch.status==='connected'&&x.patch.last_error===null),true);
    assert.equal(h.syncState.filter(x=>x.patch.last_attempt_at).length,2);
  }

  {
    const h=makeHarness({googleFails:true});
    const result=await mod.syncCalendars({supabase:{},userId:'u1',now:h.now,credentialKey:h.key,googleConfig:{clientId:'gid',clientSecret:'gsecret'},providers:h.providers,deps:h.deps});
    const google=result.connections.find(x=>x.provider==='google');
    const apple=result.connections.find(x=>x.provider==='apple');
    assert.equal(google.ok,false);
    assert.equal(apple.ok,true,'Google failure must not block Apple');
    const googleFailure=h.syncState.filter(x=>x.id==='g1').at(-1).patch;
    assert.equal(googleFailure.status,'attention','credential/token failures require attention');
    assert.match(googleFailure.last_error,/Google calendar sync needs attention/i);
    assert.doesNotMatch(googleFailure.last_error,/google-refresh-secret|raw provider body|gsecret/i);
    assert.equal(h.calls.some(x=>x[0]==='apple-events'),true);
  }

  {
    const h=makeHarness();
    h.providers.apple.listEventOccurrences=async()=>{throw new Error('socket reset apple-secret provider dump');};
    const result=await mod.syncCalendars({supabase:{},userId:'u1',now:h.now,credentialKey:h.key,googleConfig:{clientId:'gid',clientSecret:'gsecret'},providers:h.providers,deps:h.deps});
    const apple=result.connections.find(x=>x.provider==='apple');
    assert.equal(apple.ok,false);
    const failure=h.syncState.filter(x=>x.id==='a1').at(-1).patch;
    assert.equal(failure.status,'connected','transient failure retains connection');
    assert.equal(failure.last_success_at,undefined);
    assert.match(failure.last_error,/Apple calendar sync failed/i);
    assert.doesNotMatch(failure.last_error,/apple-secret|provider dump|socket reset/i);
    assert.equal(result.connections.find(x=>x.provider==='google').ok,true,'Apple failure must not block Google');
  }

  {
    const h=makeHarness();
    h.deps.decryptCredential=()=>{throw new Error('Unable to decrypt credential google-refresh-secret');};
    const result=await mod.syncCalendars({supabase:{},userId:'u1',now:h.now,credentialKey:h.key,googleConfig:{clientId:'gid',clientSecret:'gsecret'},providers:h.providers,deps:h.deps});
    assert.equal(result.connections.every(x=>!x.ok),true);
    assert.equal(h.syncState.filter(x=>x.patch.status==='attention').length,2);
    assert.equal(h.syncState.some(x=>/google-refresh-secret/.test(x.patch.last_error||'')),false);
  }

  console.log('calendar sync tests passed');
})().catch(error=>{console.error(error);process.exit(1);});
