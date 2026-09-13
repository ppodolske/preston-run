'use strict';

const AUTH_URL='https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL='https://oauth2.googleapis.com/token';
const API_ROOT='https://www.googleapis.com/calendar/v3';
const SCOPES=[
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly'
];

function providerError(action,status){
  const suffix=Number.isInteger(status)?` (${status})`:'';
  return new Error(`Google Calendar ${action} failed${suffix}`);
}

async function requestJson(fetchImpl,url,options,action){
  let response;
  try{response=await fetchImpl(url,options);}catch(_error){throw providerError(action);}
  if(!response||!response.ok)throw providerError(action,response&&response.status);
  try{return await response.json();}catch(_error){throw providerError(action,response.status);}
}

function buildAuthorizationUrl({clientId,redirectUri,state}){
  const url=new URL(AUTH_URL);
  url.searchParams.set('client_id',clientId);
  url.searchParams.set('redirect_uri',redirectUri);
  url.searchParams.set('response_type','code');
  url.searchParams.set('scope',SCOPES.join(' '));
  url.searchParams.set('access_type','offline');
  url.searchParams.set('prompt','consent');
  url.searchParams.set('state',state);
  return url.toString();
}

function mapTokenPayload(body){
  return {
    accessToken:body.access_token,
    refreshToken:body.refresh_token||null,
    expiresIn:body.expires_in||null,
    tokenType:body.token_type||null,
    scope:body.scope||null
  };
}

async function exchangeAuthorizationCode({code,clientId,clientSecret,redirectUri,fetch=globalThis.fetch}){
  const body=new URLSearchParams({
    code,
    client_id:clientId,
    client_secret:clientSecret,
    redirect_uri:redirectUri,
    grant_type:'authorization_code'
  });
  const payload=await requestJson(fetch,TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()},'authorization');
  if(!payload.access_token)throw providerError('authorization');
  return mapTokenPayload(payload);
}

async function refreshAccessToken({refreshToken,clientId,clientSecret,fetch=globalThis.fetch}){
  const body=new URLSearchParams({
    refresh_token:refreshToken,
    client_id:clientId,
    client_secret:clientSecret,
    grant_type:'refresh_token'
  });
  const payload=await requestJson(fetch,TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()},'token refresh');
  if(!payload.access_token)throw providerError('token refresh');
  return mapTokenPayload(payload);
}

function authHeaders(accessToken){return {Authorization:`Bearer ${accessToken}`};}

async function listCalendars({accessToken,fetch=globalThis.fetch}){
  const calendars=[];
  let pageToken=null;
  do{
    const url=new URL(`${API_ROOT}/users/me/calendarList`);
    url.searchParams.set('maxResults','250');
    if(pageToken)url.searchParams.set('pageToken',pageToken);
    const payload=await requestJson(fetch,url.toString(),{headers:authHeaders(accessToken)},'calendar discovery');
    for(const item of payload.items||[]){
      calendars.push({
        id:item.id,
        name:item.summary||item.id,
        primary:item.primary===true,
        color:item.backgroundColor||null,
        readOnly:true
      });
    }
    pageToken=payload.nextPageToken||null;
  }while(pageToken);
  return calendars;
}

function getAccountIdentity(calendars){
  const primary=(calendars||[]).find(calendar=>calendar.primary)||(calendars||[])[0];
  if(!primary||!primary.id)throw providerError('account identity');
  return {externalId:primary.id,label:primary.id};
}

function normalizeOwnerResponse(attendees){
  const self=(attendees||[]).find(attendee=>attendee&&attendee.self===true);
  const value=self&&self.responseStatus;
  if(value==='accepted'||value==='tentative'||value==='declined'||value==='needsAction'){
    return value==='needsAction'?'needs_action':value;
  }
  return 'unknown';
}

function normalizeStatus(status){
  if(status==='cancelled')return 'cancelled';
  if(status==='tentative')return 'tentative';
  return 'confirmed';
}

function normalizeOccurrence(item){
  const allDay=Boolean(item.start&&item.start.date);
  const original=(item.originalStartTime&&(item.originalStartTime.dateTime||item.originalStartTime.date))||(item.start&&(item.start.dateTime||item.start.date))||'';
  const occurrenceKey=item.recurringEventId?`${item.id}:${original}`:item.id;
  return {
    providerEventId:item.id,
    occurrenceKey,
    seriesId:item.recurringEventId||null,
    title:item.summary||'(Untitled event)',
    allDay,
    startsAt:allDay?null:new Date(item.start.dateTime).toISOString(),
    endsAt:allDay?null:new Date(item.end.dateTime).toISOString(),
    startDate:allDay?item.start.date:null,
    endDate:allDay?item.end.date:null,
    timeZone:(item.start&&item.start.timeZone)||(item.end&&item.end.timeZone)||null,
    location:item.location||null,
    externalUrl:item.htmlLink||null,
    providerUpdatedAt:item.updated||null,
    status:normalizeStatus(item.status),
    ownerResponse:normalizeOwnerResponse(item.attendees)
  };
}

async function listEventOccurrences({calendarId,start,end,accessToken,fetch=globalThis.fetch}){
  const events=[];
  let pageToken=null;
  do{
    const url=new URL(`${API_ROOT}/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set('singleEvents','true');
    url.searchParams.set('showDeleted','true');
    url.searchParams.set('timeMin',start);
    url.searchParams.set('timeMax',end);
    url.searchParams.set('maxResults','2500');
    if(pageToken)url.searchParams.set('pageToken',pageToken);
    const payload=await requestJson(fetch,url.toString(),{headers:authHeaders(accessToken)},'event sync');
    for(const item of payload.items||[])events.push(normalizeOccurrence(item));
    pageToken=payload.nextPageToken||null;
  }while(pageToken);
  return events;
}

module.exports={
  SCOPES,
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  refreshAccessToken,
  getAccountIdentity,
  listCalendars,
  listEventOccurrences,
  normalizeOccurrence
};
