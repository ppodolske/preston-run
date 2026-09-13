function requireUserId(userId){if(!userId)throw new Error('Authenticated user is required');}
const CONNECTION_PUBLIC_COLUMNS='id,user_id,provider,account_external_id,account_label,status,last_attempt_at,last_success_at,last_error,created_at,updated_at';
const CONNECTION_SECRET_COLUMNS=`${CONNECTION_PUBLIC_COLUMNS},credential_ciphertext`;
const SOURCE_COLUMNS='id,user_id,connection_id,provider_calendar_id,display_name,color,selected,read_only,created_at,updated_at';
const EVENT_COLUMNS='id,user_id,connection_id,calendar_source_id,provider_event_id,occurrence_key,series_id,title,all_day,starts_at,ends_at,start_date,end_date,time_zone,location,status,owner_response,external_url,provider_updated_at,sync_seen_at,created_at,updated_at';

function cleanText(value){const s=value==null?'':String(value).trim();return s||null;}
function throwIf(result){if(result.error)throw result.error;return result.data;}

async function getCalendarConnection(supabase,userId,provider){
  requireUserId(userId);const r=await supabase.from('calendar_connections').select(CONNECTION_PUBLIC_COLUMNS).eq('user_id',userId).eq('provider',provider).maybeSingle();return throwIf(r)||null;
}
async function getCalendarConnectionWithCredential(supabase,userId,id){
  requireUserId(userId);const r=await supabase.from('calendar_connections').select(CONNECTION_SECRET_COLUMNS).eq('user_id',userId).eq('id',id).maybeSingle();return throwIf(r)||null;
}
async function listCalendarConnections(supabase,userId){
  requireUserId(userId);const r=await supabase.from('calendar_connections').select(CONNECTION_PUBLIC_COLUMNS).eq('user_id',userId).order('provider',{ascending:true});return throwIf(r)||[];
}
async function upsertCalendarConnection(supabase,userId,input={}){
  requireUserId(userId);const payload={user_id:userId,provider:String(input.provider||''),account_external_id:cleanText(input.account_external_id),account_label:cleanText(input.account_label),credential_ciphertext:String(input.credential_ciphertext||''),status:input.status||'connected',last_error:input.last_error==null?null:String(input.last_error),updated_at:new Date().toISOString()};
  const r=await supabase.from('calendar_connections').upsert(payload,{onConflict:'user_id,provider'}).select(CONNECTION_PUBLIC_COLUMNS).single();return throwIf(r);
}
async function updateCalendarSyncState(supabase,userId,id,input={}){
  requireUserId(userId);const allowed=['status','last_attempt_at','last_success_at','last_error'];const patch={updated_at:new Date().toISOString()};for(const k of allowed)if(Object.prototype.hasOwnProperty.call(input,k))patch[k]=input[k];
  const r=await supabase.from('calendar_connections').update(patch).eq('user_id',userId).eq('id',id).select(CONNECTION_PUBLIC_COLUMNS).maybeSingle();return throwIf(r)||null;
}
async function deleteCalendarConnection(supabase,userId,id){
  requireUserId(userId);const r=await supabase.from('calendar_connections').delete().eq('user_id',userId).eq('id',id).select('id').maybeSingle();return throwIf(r)||null;
}

async function listCalendarSources(supabase,userId,connectionId){
  requireUserId(userId);let q=supabase.from('calendar_sources').select(SOURCE_COLUMNS).eq('user_id',userId);if(connectionId)q=q.eq('connection_id',connectionId);const r=await q.order('display_name',{ascending:true});return throwIf(r)||[];
}
async function listSelectedCalendarSources(supabase,userId,connectionId){
  requireUserId(userId);let q=supabase.from('calendar_sources').select(SOURCE_COLUMNS).eq('user_id',userId);if(connectionId)q=q.eq('connection_id',connectionId);const r=await q.eq('selected',true).order('display_name',{ascending:true});return throwIf(r)||[];
}
async function replaceDiscoveredCalendarSources(supabase,userId,connectionId,discovered=[]){
  requireUserId(userId);const existing=await listCalendarSources(supabase,userId,connectionId);const byProvider=new Map(existing.map(x=>[String(x.provider_calendar_id),x]));
  const now=new Date().toISOString();const payload=discovered.map(row=>{const old=byProvider.get(String(row.provider_calendar_id));return{user_id:userId,connection_id:connectionId,provider_calendar_id:String(row.provider_calendar_id),display_name:String(row.display_name||row.provider_calendar_id),color:cleanText(row.color),selected:old?old.selected===true:false,read_only:row.read_only!==false,updated_at:now};});
  if(!payload.length)return[];const r=await supabase.from('calendar_sources').upsert(payload,{onConflict:'user_id,connection_id,provider_calendar_id'}).select(SOURCE_COLUMNS);return throwIf(r)||[];
}
async function setCalendarSourceSelected(supabase,userId,id,selected){
  requireUserId(userId);const r=await supabase.from('calendar_sources').update({selected:Boolean(selected),updated_at:new Date().toISOString()}).eq('user_id',userId).eq('id',id).select(SOURCE_COLUMNS).maybeSingle();return throwIf(r)||null;
}

function cleanEvent(row,userId,connectionId,sourceId,syncMarker){
  return{user_id:userId,connection_id:connectionId,calendar_source_id:sourceId,provider_event_id:String(row.provider_event_id),occurrence_key:String(row.occurrence_key),series_id:cleanText(row.series_id),title:String(row.title||''),all_day:Boolean(row.all_day),starts_at:row.starts_at||null,ends_at:row.ends_at||null,start_date:row.start_date||null,end_date:row.end_date||null,time_zone:cleanText(row.time_zone),location:cleanText(row.location),status:row.status||'confirmed',owner_response:row.owner_response||'unknown',external_url:cleanText(row.external_url),provider_updated_at:row.provider_updated_at||null,sync_seen_at:syncMarker,updated_at:new Date().toISOString()};
}
async function upsertCalendarEvents(supabase,userId,connectionId,sourceId,events=[],syncMarker=new Date().toISOString()){
  requireUserId(userId);if(!events.length)return[];const payload=events.map(x=>cleanEvent(x,userId,connectionId,sourceId,syncMarker));const r=await supabase.from('calendar_events').upsert(payload,{onConflict:'user_id,calendar_source_id,occurrence_key'}).select(EVENT_COLUMNS);return throwIf(r)||[];
}
async function listCalendarEventsForDigest(supabase,userId){
  requireUserId(userId);const r=await supabase.from('calendar_events').select(EVENT_COLUMNS).eq('user_id',userId).order('starts_at',{ascending:true,nullsFirst:true});return throwIf(r)||[];
}
async function listCalendarDashboardData(supabase,userId){
  requireUserId(userId);
  const [events,sources]=await Promise.all([
    supabase.from('calendar_events').select(EVENT_COLUMNS).eq('user_id',userId),
    supabase.from('calendar_sources').select(SOURCE_COLUMNS).eq('user_id',userId).eq('selected',true)
  ]);
  return{events:throwIf(events)||[],sources:throwIf(sources)||[]};
}
async function listCalendarViewData(supabase,userId){
  return listCalendarDashboardData(supabase,userId);
}
async function deleteEventsForSource(supabase,userId,sourceId){
  requireUserId(userId);const r=await supabase.from('calendar_events').delete().eq('user_id',userId).eq('calendar_source_id',sourceId).select('id');return throwIf(r)||[];
}
async function deleteUnseenEventsForSource(supabase,userId,sourceId,syncMarker){
  requireUserId(userId);const r=await supabase.from('calendar_events').delete().eq('user_id',userId).eq('calendar_source_id',sourceId).lt('sync_seen_at',syncMarker).select('id');return throwIf(r)||[];
}
async function deleteEventsOutsideWindow(supabase,userId,startDate,endDate){
  requireUserId(userId);const startIso=`${startDate}T00:00:00Z`,endIso=`${endDate}T23:59:59Z`;const filter=`and(all_day.eq.true,end_date.lte.${startDate}),and(all_day.eq.true,start_date.gt.${endDate}),and(all_day.eq.false,ends_at.lt.${startIso}),and(all_day.eq.false,starts_at.gt.${endIso})`;
  const r=await supabase.from('calendar_events').delete().eq('user_id',userId).or(filter).select('id');return throwIf(r)||[];
}

module.exports={getCalendarConnection,getCalendarConnectionWithCredential,listCalendarConnections,upsertCalendarConnection,updateCalendarSyncState,deleteCalendarConnection,listCalendarSources,replaceDiscoveredCalendarSources,setCalendarSourceSelected,listSelectedCalendarSources,upsertCalendarEvents,listCalendarEventsForDigest,listCalendarDashboardData,listCalendarViewData,deleteEventsForSource,deleteUnseenEventsForSource,deleteEventsOutsideWindow};
