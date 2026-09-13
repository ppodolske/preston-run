'use strict';

const defaultData=require('../data/calendars');
const {decryptCredential:defaultDecryptCredential}=require('../security/credential-crypto');
const {getCalendarSyncWindow,normalizeCalendarEvent}=require('../domain/calendars');
const defaultGoogle=require('../calendar/providers/google');
const defaultApple=require('../calendar/providers/apple-caldav');

function providerLabel(provider){return provider==='google'?'Google':provider==='apple'?'Apple':'Calendar';}

function isCredentialFailure(error){
  const message=String(error&&error.message||'');
  return /decrypt credential|credential envelope|credential key|token refresh|authentication|\(401\)|\(403\)/i.test(message)||error&&error.code==='CALENDAR_AUTH';
}

function safeFailure(provider,error){
  const label=providerLabel(provider);
  if(isCredentialFailure(error))return `${label} calendar sync needs attention`;
  return `${label} calendar sync failed`;
}

function normalizeDiscovered(calendars=[]){
  return calendars.map(calendar=>({
    provider_calendar_id:String(calendar.id||calendar.href||''),
    display_name:String(calendar.name||calendar.id||calendar.href||'Calendar'),
    color:calendar.color||null,
    read_only:calendar.readOnly!==false
  })).filter(calendar=>calendar.provider_calendar_id);
}

function providerRowToDomain(row){
  return normalizeCalendarEvent({
    provider_event_id:row.provider_event_id??row.providerEventId,
    occurrence_key:row.occurrence_key??row.occurrenceKey,
    series_id:row.series_id??row.seriesId,
    title:row.title,
    all_day:row.all_day??row.allDay,
    starts_at:row.starts_at??row.startsAt,
    ends_at:row.ends_at??row.endsAt,
    start_date:row.start_date??row.startDate,
    end_date:row.end_date??row.endDate,
    time_zone:row.time_zone??row.timeZone,
    location:row.location,
    status:row.status,
    owner_response:row.owner_response??row.ownerResponse,
    external_url:row.external_url??row.externalUrl,
    provider_updated_at:row.provider_updated_at??row.providerUpdatedAt
  });
}

async function syncCalendarConnection({supabase,userId,connection,now,credentialKey,googleConfig={},provider,data,decryptCredential}){
  const timestamp=now.toISOString();
  await data.updateCalendarSyncState(supabase,userId,connection.id,{last_attempt_at:timestamp});
  try{
    const secret=await data.getCalendarConnectionWithCredential(supabase,userId,connection.id);
    if(!secret||!secret.credential_ciphertext)throw new Error('Calendar credential unavailable');
    const credentials=decryptCredential(secret.credential_ciphertext,credentialKey);
    const window=getCalendarSyncWindow(now);

    let discovered;
    let accessToken=null;
    if(connection.provider==='google'){
      const refreshed=await provider.refreshAccessToken({
        refreshToken:credentials.refreshToken,
        clientId:googleConfig.clientId,
        clientSecret:googleConfig.clientSecret
      });
      accessToken=refreshed.accessToken;
      discovered=await provider.listCalendars({accessToken});
    }else if(connection.provider==='apple'){
      discovered=await provider.listCalendars(credentials);
    }else{
      throw new Error('Unsupported calendar provider');
    }

    await data.replaceDiscoveredCalendarSources(supabase,userId,connection.id,normalizeDiscovered(discovered));
    const allSources=await data.listCalendarSources(supabase,userId,connection.id);
    for(const source of allSources){
      if(source.selected!==true)await data.deleteEventsForSource(supabase,userId,source.id);
    }

    const selected=await data.listSelectedCalendarSources(supabase,userId,connection.id);
    for(const source of selected){
      let providerEvents;
      if(connection.provider==='google'){
        providerEvents=await provider.listEventOccurrences({calendarId:source.provider_calendar_id,accessToken,start:window.start,end:window.end});
      }else{
        providerEvents=await provider.listEventOccurrences({calendarHref:source.provider_calendar_id,credentials,start:window.start,end:window.end});
      }
      const normalized=(providerEvents||[]).map(providerRowToDomain);
      const syncMarker=now.toISOString();
      await data.upsertCalendarEvents(supabase,userId,connection.id,source.id,normalized,syncMarker);
      await data.deleteUnseenEventsForSource(supabase,userId,source.id,syncMarker);
    }

    await data.updateCalendarSyncState(supabase,userId,connection.id,{status:'connected',last_success_at:timestamp,last_error:null});
    return {provider:connection.provider,id:connection.id,ok:true};
  }catch(error){
    const attention=isCredentialFailure(error);
    const message=safeFailure(connection.provider,error);
    await data.updateCalendarSyncState(supabase,userId,connection.id,{status:attention?'attention':'connected',last_error:message});
    return {provider:connection.provider,id:connection.id,ok:false,error:message};
  }
}

async function syncCalendars({supabase,userId,now=new Date(),credentialKey,googleConfig={},providers={},deps={}}){
  if(!supabase)throw new Error('Supabase client is required');
  if(!userId)throw new Error('Calendar sync user is required');
  if(!(now instanceof Date)||Number.isNaN(now.getTime()))throw new Error('Calendar sync time is invalid');
  const data=deps.data||defaultData;
  const decryptCredential=deps.decryptCredential||defaultDecryptCredential;
  const providerMap={google:providers.google||defaultGoogle,apple:providers.apple||defaultApple};
  const connections=await data.listCalendarConnections(supabase,userId);
  const results=[];
  for(const connection of connections){
    const provider=providerMap[connection.provider];
    if(!provider){
      const error=new Error('Unsupported calendar provider');
      const message=safeFailure(connection.provider,error);
      await data.updateCalendarSyncState(supabase,userId,connection.id,{last_attempt_at:now.toISOString(),status:'connected',last_error:message});
      results.push({provider:connection.provider,id:connection.id,ok:false,error:message});
      continue;
    }
    results.push(await syncCalendarConnection({supabase,userId,connection,now,credentialKey,googleConfig,provider,data,decryptCredential}));
  }
  const window=getCalendarSyncWindow(now);
  await data.deleteEventsOutsideWindow(supabase,userId,window.startDate,window.endDate);
  return {connections:results,window};
}

module.exports={syncCalendars,syncCalendarConnection,safeFailure,isCredentialFailure};
