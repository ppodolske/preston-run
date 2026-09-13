'use strict';

const {XMLParser}=require('fast-xml-parser');

const CALDAV_ROOT='https://caldav.icloud.com/';
const DAV_NS='DAV:';
const CALDAV_NS='urn:ietf:params:xml:ns:caldav';
const APPLE_ICAL_NS='http://apple.com/ns/ical/';

const xmlParser=new XMLParser({
  ignoreAttributes:false,
  removeNSPrefix:true,
  trimValues:false,
  parseTagValue:false,
  cdataPropName:false
});

let icalModulePromise;
async function getIcal(){
  if(!icalModulePromise)icalModulePromise=import('ical.js').then(mod=>mod.default||mod);
  return icalModulePromise;
}

function providerError(action,status){
  const suffix=Number.isInteger(status)?` (${status})`:'';
  return new Error(`Apple Calendar ${action} failed${suffix}`);
}

function asArray(value){return value==null?[]:(Array.isArray(value)?value:[value]);}

function isTrustedIcloudUrl(value){
  try{
    const url=new URL(value);
    if(url.protocol!=='https:')return false;
    const host=url.hostname.toLowerCase();
    return host==='caldav.icloud.com'||(host.endsWith('.icloud.com')&&host.includes('caldav'));
  }catch(_error){return false;}
}

function resolveTrustedHref(href,base){
  let resolved;
  try{resolved=new URL(href,base).toString();}catch(_error){throw providerError('discovery');}
  if(!isTrustedIcloudUrl(resolved))throw providerError('discovery');
  return resolved;
}

function basicAuthorization(credentials){
  const email=String(credentials&&credentials.email||'');
  const password=String(credentials&&credentials.appSpecificPassword||'');
  if(!email||!password)throw providerError('authentication');
  return `Basic ${Buffer.from(`${email}:${password}`,'utf8').toString('base64')}`;
}

async function davRequest({url,credentials,fetch,method,depth,body,action}){
  if(!isTrustedIcloudUrl(url))throw providerError(action);
  const fetchImpl=fetch||globalThis.fetch;
  let current=url;
  for(let redirects=0;redirects<4;redirects+=1){
    let response;
    try{
      response=await fetchImpl(current,{
        method,
        redirect:'manual',
        headers:{
          Authorization:basicAuthorization(credentials),
          Depth:String(depth),
          'Content-Type':'application/xml; charset=utf-8',
          Accept:'application/xml, text/xml'
        },
        body
      });
    }catch(_error){throw providerError(action);}
    if(response&&response.status>=300&&response.status<400){
      const location=response.headers&&response.headers.get&&response.headers.get('location');
      if(!location)throw providerError(action,response.status);
      current=resolveTrustedHref(location,current);
      continue;
    }
    if(!response||!response.ok)throw providerError(action,response&&response.status);
    try{return {url:current,text:await response.text()};}catch(_error){throw providerError(action,response.status);}
  }
  throw providerError(action);
}

function parseXml(text,action){
  try{return xmlParser.parse(text);}catch(_error){throw providerError(action);}
}

function responsesFromXml(text,action){
  const parsed=parseXml(text,action);
  const multi=parsed.multistatus||parsed['multistatus'];
  if(!multi)return [];
  return asArray(multi.response);
}

function successfulProps(response){
  for(const propstat of asArray(response&&response.propstat)){
    const status=String(propstat&&propstat.status||'');
    if(!status||/\s2\d\d\s/.test(` ${status} `)||status.includes(' 200 '))return propstat.prop||{};
  }
  return {};
}

function nestedHref(value){
  if(value==null)return null;
  if(typeof value==='string')return value;
  if(typeof value==='object')return value.href||null;
  return null;
}

async function discoverCalendarHome(credentials,{fetch}={}){
  const principalBody=`<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="${DAV_NS}"><d:prop><d:current-user-principal/></d:prop></d:propfind>`;
  const principalResponse=await davRequest({url:CALDAV_ROOT,credentials,fetch,method:'PROPFIND',depth:0,body:principalBody,action:'principal discovery'});
  const principalRows=responsesFromXml(principalResponse.text,'principal discovery');
  const principalHref=nestedHref(successfulProps(principalRows[0])['current-user-principal']);
  if(!principalHref)throw providerError('principal discovery');
  const principalUrl=resolveTrustedHref(principalHref,principalResponse.url);

  const homeBody=`<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="${DAV_NS}" xmlns:c="${CALDAV_NS}"><d:prop><c:calendar-home-set/></d:prop></d:propfind>`;
  const homeResponse=await davRequest({url:principalUrl,credentials,fetch,method:'PROPFIND',depth:0,body:homeBody,action:'calendar home discovery'});
  const homeRows=responsesFromXml(homeResponse.text,'calendar home discovery');
  const homeHref=nestedHref(successfulProps(homeRows[0])['calendar-home-set']);
  if(!homeHref)throw providerError('calendar home discovery');
  return resolveTrustedHref(homeHref,homeResponse.url);
}

function hasCalendarResource(resourceType){
  return Boolean(resourceType&&typeof resourceType==='object'&&Object.prototype.hasOwnProperty.call(resourceType,'calendar'));
}

async function listCalendars(credentials,{fetch}={}){
  const homeUrl=await discoverCalendarHome(credentials,{fetch});
  const body=`<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="${DAV_NS}" xmlns:c="${CALDAV_NS}" xmlns:a="${APPLE_ICAL_NS}"><d:prop><d:displayname/><d:resourcetype/><a:calendar-color/></d:prop></d:propfind>`;
  const result=await davRequest({url:homeUrl,credentials,fetch,method:'PROPFIND',depth:1,body,action:'calendar discovery'});
  const calendars=[];
  for(const row of responsesFromXml(result.text,'calendar discovery')){
    const props=successfulProps(row);
    if(!hasCalendarResource(props.resourcetype))continue;
    const href=row.href;
    if(!href)continue;
    const url=resolveTrustedHref(href,result.url);
    calendars.push({
      id:url,
      href:url,
      name:typeof props.displayname==='string'&&props.displayname.trim()?props.displayname.trim():url,
      color:typeof props['calendar-color']==='string'?props['calendar-color']:null,
      readOnly:true
    });
  }
  return calendars;
}

async function validateAppleCredentials(credentials,{fetch}={}){
  try{
    const calendars=await listCalendars(credentials,{fetch});
    return {valid:true,calendars};
  }catch(error){
    if(error&&/^Apple Calendar /.test(error.message))throw error;
    throw providerError('authentication');
  }
}

function compactUtc(value){
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))throw providerError('event sync');
  return date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
}

function reportBody(start,end){
  const from=compactUtc(start);
  const to=compactUtc(end);
  return `<?xml version="1.0" encoding="utf-8"?><c:calendar-query xmlns:d="${DAV_NS}" xmlns:c="${CALDAV_NS}"><d:prop><d:getetag/><c:calendar-data><c:expand start="${from}" end="${to}"/></c:calendar-data></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${from}" end="${to}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`;
}

function propertyText(component,name){
  const value=component.getFirstPropertyValue(name);
  if(value==null)return null;
  return String(value);
}

function formatDateOnly(time){
  const year=String(time.year).padStart(4,'0');
  const month=String(time.month).padStart(2,'0');
  const day=String(time.day).padStart(2,'0');
  return `${year}-${month}-${day}`;
}

function timeIdentity(time){
  if(!time)return '';
  if(time.isDate)return formatDateOnly(time);
  try{return time.toJSDate().toISOString();}catch(_error){return String(time);}
}

function ownerResponse(component,email){
  const target=String(email||'').trim().toLowerCase();
  for(const property of component.getAllProperties('attendee')){
    const address=String(property.getFirstValue()||'').replace(/^mailto:/i,'').trim().toLowerCase();
    if(target&&address!==target)continue;
    const partstat=String(property.getParameter('partstat')||'').toUpperCase();
    if(partstat==='ACCEPTED')return 'accepted';
    if(partstat==='TENTATIVE')return 'tentative';
    if(partstat==='DECLINED')return 'declined';
    if(partstat==='NEEDS-ACTION')return 'needs_action';
    return 'unknown';
  }
  return 'unknown';
}

function normalizeStatus(value){
  const status=String(value||'CONFIRMED').toUpperCase();
  if(status==='CANCELLED')return 'cancelled';
  if(status==='TENTATIVE')return 'tentative';
  return 'confirmed';
}

async function parseCalendarData(ics,credentials){
  const ICAL=await getIcal();
  let root;
  try{root=new ICAL.Component(ICAL.parse(ics));}catch(_error){throw providerError('event parsing');}
  const events=[];
  for(const component of root.getAllSubcomponents('vevent')){
    if(component.getFirstProperty('rrule')&&!component.getFirstProperty('recurrence-id')){
      throw providerError('recurrence expansion');
    }
    let event;
    try{event=new ICAL.Event(component);}catch(_error){throw providerError('event parsing');}
    const uid=event.uid||propertyText(component,'uid');
    if(!uid)throw providerError('event parsing');
    const start=event.startDate;
    const end=event.endDate;
    if(!start||!end)throw providerError('event parsing');
    const recurrence=component.getFirstPropertyValue('recurrence-id');
    const allDay=Boolean(start.isDate);
    const dtstart=component.getFirstProperty('dtstart');
    const tzid=dtstart&&dtstart.getParameter('tzid')||null;
    const identity=recurrence?timeIdentity(recurrence):timeIdentity(start);
    const lastModified=component.getFirstPropertyValue('last-modified')||component.getFirstPropertyValue('dtstamp');
    events.push({
      providerEventId:uid,
      occurrenceKey:`${uid}:${identity}`,
      seriesId:recurrence?uid:null,
      title:propertyText(component,'summary')||'(Untitled event)',
      allDay,
      startsAt:allDay?null:start.toJSDate().toISOString(),
      endsAt:allDay?null:end.toJSDate().toISOString(),
      startDate:allDay?formatDateOnly(start):null,
      endDate:allDay?formatDateOnly(end):null,
      timeZone:tzid,
      location:propertyText(component,'location'),
      externalUrl:propertyText(component,'url'),
      providerUpdatedAt:lastModified&&typeof lastModified.toJSDate==='function'?lastModified.toJSDate().toISOString():null,
      status:normalizeStatus(propertyText(component,'status')),
      ownerResponse:ownerResponse(component,credentials.email)
    });
  }
  return events;
}

async function listEventOccurrences({calendarHref,start,end,credentials,fetch=globalThis.fetch}){
  if(!isTrustedIcloudUrl(calendarHref))throw providerError('event sync');
  const result=await davRequest({url:calendarHref,credentials,fetch,method:'REPORT',depth:1,body:reportBody(start,end),action:'event sync'});
  const events=[];
  for(const row of responsesFromXml(result.text,'event sync')){
    const props=successfulProps(row);
    const calendarData=props['calendar-data'];
    if(typeof calendarData!=='string'||!calendarData.trim())continue;
    events.push(...await parseCalendarData(calendarData,credentials));
  }
  return events;
}

module.exports={
  CALDAV_ROOT,
  validateAppleCredentials,
  listCalendars,
  listEventOccurrences,
  isTrustedIcloudUrl,
  reportBody
};
