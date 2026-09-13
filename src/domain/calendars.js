const SYDNEY_TZ='Australia/Sydney';
const DAY_MS=86400000;

function localParts(value=new Date(),timeZone=SYDNEY_TZ){
  const parts=new Intl.DateTimeFormat('en-AU',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(value);
  const out={};for(const p of parts)if(p.type!=='literal')out[p.type]=Number(p.value);return out;
}
function dateKey({year,month,day}){return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}
function keyToUtcDate(key){const[y,m,d]=String(key).split('-').map(Number);return new Date(Date.UTC(y,m-1,d));}
function shiftDateKey(key,{days=0,months=0}={}){const d=keyToUtcDate(key);d.setUTCMonth(d.getUTCMonth()+months);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function localDateTimeToInstant(date,hour=0,minute=0,second=0,timeZone=SYDNEY_TZ){
  const[y,m,d]=String(date).split('-').map(Number);let guess=new Date(Date.UTC(y,m-1,d,hour,minute,second));
  for(let i=0;i<4;i++){
    const p=localParts(guess,timeZone);
    const wanted=Date.UTC(y,m-1,d,hour,minute,second),got=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);
    const delta=wanted-got;if(delta===0)break;guess=new Date(guess.getTime()+delta);
  }
  return guess;
}
function currentSydneyDate(now=new Date()){return dateKey(localParts(now,SYDNEY_TZ));}

function getCalendarSyncWindow(now=new Date()){
  const today=currentSydneyDate(now),startDate=shiftDateKey(today,{days:-30}),endDate=shiftDateKey(today,{months:12});
  return{startDate,endDate,start:localDateTimeToInstant(startDate).toISOString(),end:localDateTimeToInstant(endDate,23,59,59).toISOString()};
}
function getMorningCalendarWindow(now=new Date()){
  const today=currentSydneyDate(now),tomorrow=shiftDateKey(today,{days:1});
  return{today,tomorrow,startOfToday:localDateTimeToInstant(today).toISOString(),timedCutoff:localDateTimeToInstant(tomorrow,9,0,0).toISOString()};
}
function getDashboardCalendarWindow(now=new Date()){
  const today=currentSydneyDate(now),tomorrow=shiftDateKey(today,{days:1});
  return{today,tomorrow,startOfToday:localDateTimeToInstant(today).toISOString(),startOfTomorrow:localDateTimeToInstant(tomorrow).toISOString(),timedCutoff:localDateTimeToInstant(tomorrow,9,0,0).toISOString()};
}
function shouldRunCalendarSync(now=new Date()){
  const p=localParts(now,SYDNEY_TZ);return p.hour===6&&p.minute===55;
}

function requiredText(value,label){const text=String(value||'').trim();if(!text)throw new Error(`Calendar event ${label} is required`);return text;}
function validDateKey(value){return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''));}
function normalizeCalendarEvent(input={}){
  const out={provider_event_id:requiredText(input.provider_event_id,'provider ID'),occurrence_key:requiredText(input.occurrence_key,'occurrence key'),series_id:input.series_id?String(input.series_id):null,title:requiredText(input.title,'title'),all_day:Boolean(input.all_day),status:input.status||'confirmed',owner_response:input.owner_response||'unknown',time_zone:input.time_zone?String(input.time_zone):null,location:input.location?String(input.location):null,external_url:input.external_url?String(input.external_url):null,provider_updated_at:input.provider_updated_at||null};
  if(!['confirmed','tentative','cancelled'].includes(out.status))throw new Error('Invalid calendar event status');
  if(!['accepted','tentative','declined','needs_action','unknown'].includes(out.owner_response))throw new Error('Invalid calendar event owner response');
  if(out.all_day){
    if(!validDateKey(input.start_date)||!validDateKey(input.end_date))throw new Error('Calendar event date range is required');
    if(keyToUtcDate(input.end_date).getTime()<=keyToUtcDate(input.start_date).getTime())throw new Error('Calendar event date range is invalid');
    out.start_date=String(input.start_date);out.end_date=String(input.end_date);out.starts_at=null;out.ends_at=null;
  }else{
    const start=new Date(input.starts_at),end=new Date(input.ends_at);
    if(!input.starts_at||!input.ends_at||Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end.getTime()<start.getTime())throw new Error('Calendar event time range is invalid');
    out.starts_at=start.toISOString();out.ends_at=end.toISOString();out.start_date=null;out.end_date=null;
  }
  return out;
}

function allDayOverlapsDate(event,key){return event.start_date<=key&&event.end_date>key;}
function isCalendarEventDigestEligible(event,window){
  if(!event||!window||event.status==='cancelled'||event.owner_response==='declined')return false;
  if(event.all_day)return allDayOverlapsDate(event,window.today)||allDayOverlapsDate(event,window.tomorrow);
  const start=new Date(event.starts_at).getTime(),end=new Date(event.ends_at).getTime();
  const dayStart=new Date(window.startOfToday).getTime(),cutoff=new Date(window.timedCutoff).getTime();
  return Number.isFinite(start)&&Number.isFinite(end)&&end>dayStart&&start<=cutoff;
}
function isDashboardCalendarEventEligible(event,window){
  if(!event||!window||event.status==='cancelled'||event.owner_response==='declined')return false;
  if(event.all_day)return allDayOverlapsDate(event,window.today)||allDayOverlapsDate(event,window.tomorrow);
  const start=new Date(event.starts_at).getTime(),end=new Date(event.ends_at).getTime();
  const visibleStart=new Date(window.startOfToday).getTime(),cutoff=new Date(window.timedCutoff).getTime();
  return Number.isFinite(start)&&Number.isFinite(end)&&end>visibleStart&&start<=cutoff;
}
function sortCalendarDigestEvents(events=[],window){
  function bucket(e){if(e.all_day)return allDayOverlapsDate(e,window.today)?0:2;return new Date(e.starts_at).getTime()<new Date(localDateTimeToInstant(window.tomorrow).toISOString()).getTime()?1:3;}
  return [...events].sort((a,b)=>{const ba=bucket(a),bb=bucket(b);if(ba!==bb)return ba-bb;if(a.all_day&&b.all_day){const c=String(a.start_date).localeCompare(String(b.start_date));if(c)return c;return String(a.title).localeCompare(String(b.title));}if(!a.all_day&&!b.all_day){const c=new Date(a.starts_at)-new Date(b.starts_at);if(c)return c;return String(a.title).localeCompare(String(b.title));}return (a.all_day?-1:1);});
}

function dashboardSourceGroup(source={}){
  const name=String(source.display_name||'').trim().toLowerCase();
  if(name==='ppodolske@gmail.com'||name==='home')return'personal';
  if(name.includes('holiday'))return'holidays';
  if(name.includes('reminder'))return'reminders';
  return null;
}
function dashboardDay(event,window){
  if(event.all_day)return allDayOverlapsDate(event,window.today)?'today':'tomorrow';
  return new Date(event.starts_at).getTime()<new Date(window.startOfTomorrow).getTime()?'today':'tomorrow';
}
function dashboardSortValue(event,window){
  if(event.allDay)return new Date(event.day==='today'?window.startOfToday:window.startOfTomorrow).getTime();
  return new Date(event.startsAt).getTime();
}
function buildDashboardCalendar({events=[],sources=[],now=new Date()}={}){
  const window=getDashboardCalendarWindow(now);
  const groups={personal:[],holidays:[],reminders:[]};
  const sourceGroups=new Map();
  for(const source of sources){if(source.selected===false)continue;const group=dashboardSourceGroup(source);if(group)sourceGroups.set(String(source.id),group);}
  for(const event of events){
    const group=sourceGroups.get(String(event.calendar_source_id));
    if(!group||!isDashboardCalendarEventEligible(event,window))continue;
    groups[group].push({id:event.id,title:String(event.title||''),allDay:Boolean(event.all_day),startsAt:event.starts_at||null,endsAt:event.ends_at||null,startDate:event.start_date||null,endDate:event.end_date||null,location:event.location||null,externalUrl:event.external_url||null,day:dashboardDay(event,window)});
  }
  for(const group of Object.values(groups))group.sort((a,b)=>dashboardSortValue(a,window)-dashboardSortValue(b,window)||String(a.title).localeCompare(String(b.title)));
  return groups;
}

function isConnectionStale(connection={},now=new Date()){
  if(!connection.last_success_at)return true;const last=new Date(connection.last_success_at).getTime();if(!Number.isFinite(last))return true;return now.getTime()-last>DAY_MS;
}

module.exports={SYDNEY_TZ,getCalendarSyncWindow,getMorningCalendarWindow,getDashboardCalendarWindow,shouldRunCalendarSync,normalizeCalendarEvent,isCalendarEventDigestEligible,isDashboardCalendarEventEligible,sortCalendarDigestEvents,buildDashboardCalendar,isConnectionStale};
