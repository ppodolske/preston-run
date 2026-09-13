const {getNextBirthday}=require('../domain/birthdays');
const {resolveOffsets,shouldIncludeOnDate,isUrgentEntity,getSydneyLocalParts}=require('../domain/reminders');
const {getReminderSettings,getReminderOverride,listPushSubscriptions,upsertReminderOccurrence,markReminderSent,markPushSubscriptionFailure,recordNotificationDelivery}=require('../data/reminders');
const {getCalendarDigest}=require('./calendar-digest');
const {classifyPushError}=require('../push/web-push');

function dateKeyFromParts(p){return `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;}
function dateKey(value){return value?String(value).slice(0,10):null;}
function daysBetween(a,b){const parse=s=>{const[y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d);};return Math.round((parse(a)-parse(b))/86400000);}
function lifeClass(item){if(['appointment','event'].includes(item.category))return'appointment';if(['renewal','membership','subscription'].includes(item.category))return'renewal';return'deadline';}
function lifeTarget(item){const klass=lifeClass(item);return dateKey(klass==='appointment'?(item.starts_at||item.due_at):(item.due_at||item.starts_at));}
function deepLink(type,id){if(type==='person')return`/people/${encodeURIComponent(id)}/edit`;if(type==='life_item')return`/life-admin/${encodeURIComponent(id)}`;if(type==='trip')return`/trips/${encodeURIComponent(id)}`;if(type==='task')return`/tasks/${encodeURIComponent(id)}/edit`;return'/';}

async function ownedRows(supabase,table,userId){const result=await supabase.from(table).select('*').eq('user_id',userId);if(result.error)throw result.error;return result.data||[];}
async function occurrenceByKey(supabase,userId,key){const result=await supabase.from('reminders').select('*').eq('user_id',userId).eq('occurrence_key',key).maybeSingle();if(result.error)throw result.error;return result.data||null;}
const defaultDeps={
  listPeople:(s,u)=>ownedRows(s,'people',u),listLifeItems:(s,u)=>ownedRows(s,'life_items',u),listTasks:(s,u)=>ownedRows(s,'tasks',u),listTrips:(s,u)=>ownedRows(s,'trips',u),
  getSettings:getReminderSettings,getOverride:getReminderOverride,listSubscriptions:(s,u)=>listPushSubscriptions(s,u,{activeOnly:true}),getOccurrence:occurrenceByKey,
  upsertOccurrence:upsertReminderOccurrence,markSent:markReminderSent,recordDelivery:recordNotificationDelivery,markSubscriptionFailure:markPushSubscriptionFailure,
  getCalendarDigest:(s,u,n)=>getCalendarDigest({supabase:s,userId:u,now:n})
};

async function eligibleMorningItems({supabase,userId,now,deps}){
  const parts=getSydneyLocalParts(now),today=dateKeyFromParts(parts),todayDate=new Date(Date.UTC(parts.year,parts.month-1,parts.day));
  const [people,lifeItems,tasks,trips,settings]=await Promise.all([deps.listPeople(supabase,userId),deps.listLifeItems(supabase,userId),deps.listTasks(supabase,userId),deps.listTrips(supabase,userId),deps.getSettings(supabase,userId)]);
  const cfg=settings||{},items=[];
  for(const person of people||[]){if(person.active===false)continue;const next=getNextBirthday(person,todayDate);if(!next)continue;const target=dateKey(next.date.toISOString());const override=await deps.getOverride(supabase,userId,'person',person.id);const offsets=resolveOffsets('birthday',cfg,override);const offset=offsets.find(n=>shouldIncludeOnDate({targetDate:target,today,offsetDays:n}));if(offset!==undefined)items.push({type:'person',id:person.id,title:person.name,kind:'birthday',target,offset,deep_link:deepLink('person',person.id),policy_source:override&&override.enabled?'override':'default'});}
  for(const item of lifeItems||[]){if(['completed','ignored'].includes(item.status))continue;const klass=lifeClass(item),target=lifeTarget(item);if(!target)continue;const override=await deps.getOverride(supabase,userId,'life_item',item.id);const offsets=resolveOffsets(klass,cfg,override);const offset=offsets.find(n=>shouldIncludeOnDate({targetDate:target,today,offsetDays:n}));if(offset!==undefined)items.push({type:'life_item',id:item.id,title:item.title,kind:klass,target,offset,deep_link:deepLink('life_item',item.id),policy_source:override&&override.enabled?'override':'default'});}
  for(const task of tasks||[]){if(['completed','ignored'].includes(task.status))continue;const target=dateKey(task.due_at);if(!target)continue;const offsets=resolveOffsets('deadline',cfg,null);const offset=offsets.find(n=>shouldIncludeOnDate({targetDate:target,today,offsetDays:n}));if(offset!==undefined)items.push({type:'task',id:task.id,title:task.title,kind:'deadline',target,offset,deep_link:deepLink('task',task.id),policy_source:'default'});}
  for(const trip of trips||[]){if(['completed','cancelled'].includes(trip.status))continue;const target=dateKey(trip.start_date);if(!target)continue;const override=await deps.getOverride(supabase,userId,'trip',trip.id);const offsets=resolveOffsets('trip',cfg,override);const offset=offsets.find(n=>shouldIncludeOnDate({targetDate:target,today,offsetDays:n}));if(offset!==undefined)items.push({type:'trip',id:trip.id,title:trip.title,kind:'trip',target,offset,deep_link:deepLink('trip',trip.id),policy_source:override&&override.enabled?'override':'default'});}
  return{today,items};
}

function summaryBody(items){return items.map(x=>`${x.title} (${x.offset===0?'today':`${x.offset}d`})`).join(' · ');}
function sydneyDateAndTime(value){
  const date=new Date(value);if(Number.isNaN(date.getTime()))return{date:null,time:''};
  const parts=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit',hour:'numeric',minute:'2-digit'}).formatToParts(date),out={};
  for(const p of parts)if(p.type!=='literal')out[p.type]=p.value;
  return{date:`${out.year}-${out.month}-${out.day}`,time:new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',hour:'numeric',minute:'2-digit'}).format(date)};
}
function calendarEventText(event,today){
  const suffix=event.status==='tentative'?' (tentative)':'';
  if(event.all_day)return`${event.start_date===today?'All day':'Tomorrow all day'} — ${event.title}${suffix}`;
  const local=sydneyDateAndTime(event.starts_at);
  if(local.date&&local.date<today)return`In progress — ${event.title}${suffix}`;
  const prefix=local.date===today?local.time:`Tomorrow ${local.time}`;
  return`${prefix} — ${event.title}${suffix}`;
}
function calendarSummaryBody(calendar,today){
  const parts=(calendar.events||[]).map(event=>calendarEventText(event,today));
  if(calendar.attentionNeeded)parts.push('sync needs attention');
  return parts.length?`Calendar: ${parts.join(' · ')}`:'';
}
function combinedSummaryBody(items,calendar,today){return[summaryBody(items),calendarSummaryBody(calendar,today)].filter(Boolean).join('\n');}
function subscriptionForPush(row){return{endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth_secret}};}
async function deliver({supabase,userId,reminder,payload,pushTransport,deps}){
  const subscriptions=(await deps.listSubscriptions(supabase,userId)).filter(x=>x.active!==false);let delivered=0;
  for(const sub of subscriptions){const attemptedAt=new Date().toISOString();try{await pushTransport.send(subscriptionForPush(sub),payload);delivered++;await deps.recordDelivery(supabase,userId,{reminder_id:reminder.id,push_subscription_id:sub.id,attempted_at:attemptedAt,delivered_at:new Date().toISOString(),status:'delivered',error_category:null,retry_count:0});}catch(error){const category=classifyPushError(error),code=error&&error.statusCode?String(error.statusCode):'push_error';await deps.markSubscriptionFailure(supabase,userId,sub.id,{code,permanent:category==='permanent'});await deps.recordDelivery(supabase,userId,{reminder_id:reminder.id,push_subscription_id:sub.id,attempted_at:attemptedAt,delivered_at:null,status:category==='permanent'?'permanent_failure':'transient_failure',error_category:code,retry_count:0});}}
  if(delivered>0)await deps.markSent(supabase,userId,reminder.id,new Date().toISOString());return delivered;
}

async function runMorningSummary({supabase,userId,now=new Date(),pushTransport,deps={}}){
  const d={...defaultDeps,...deps};if(!userId)throw new Error('userId is required');if(!pushTransport||typeof pushTransport.send!=='function')throw new Error('pushTransport is required');
  const {today,items}=await eligibleMorningItems({supabase,userId,now,deps:d});
  const calendar=await d.getCalendarDigest(supabase,userId,now);
  const calendarEvents=calendar&&Array.isArray(calendar.events)?calendar.events:[],attentionNeeded=Boolean(calendar&&calendar.attentionNeeded),count=items.length+calendarEvents.length+(attentionNeeded?1:0);
  if(!count)return{sent:false,count:0};
  const key=`daily-summary:${today}`;const existing=await d.getOccurrence(supabase,userId,key);if(existing&&['sent','acknowledged'].includes(existing.status))return{sent:false,count,deduplicated:true};
  const reminder=existing||await d.upsertOccurrence(supabase,userId,{entity_type:'summary',entity_id:today,reminder_class:'daily_summary',occurrence_key:key,target_date:today,effective_trigger_at:now.toISOString(),status:'pending',deep_link:'/',policy_source:'default'});
  const payload={title:'preston.ai morning summary',body:combinedSummaryBody(items,{events:calendarEvents,attentionNeeded},today),url:'/',tag:`preston-daily-${today}`};
  const delivered=await deliver({supabase,userId,reminder,payload,pushTransport,deps:d});return{sent:delivered>0,count,deliveries:delivered};
}

async function runUrgentCheck({supabase,userId,now=new Date(),pushTransport,mode,deps={}}){const d={...defaultDeps,...deps};if(!['noon','evening'].includes(mode))throw new Error('Urgent check mode must be noon or evening');const parts=getSydneyLocalParts(now),today=dateKeyFromParts(parts);const [lifeItems,tasks]=await Promise.all([d.listLifeItems(supabase,userId),d.listTasks(supabase,userId)]);const candidates=[...(lifeItems||[]).map(x=>({type:'life_item',row:x})),...(tasks||[]).map(x=>({type:'task',row:x}))].filter(x=>isUrgentEntity(x.row));let totalDelivered=0,considered=0;
  for(const candidate of candidates){considered++;const {type,row}=candidate,key=`urgent:${type}:${row.id}:${today}`;const existing=await d.getOccurrence(supabase,userId,key);if(existing&&['sent','acknowledged'].includes(existing.status))continue;const target=dateKey(type==='life_item'?lifeTarget(row):row.due_at)||today;const reminder=existing||await d.upsertOccurrence(supabase,userId,{entity_type:type,entity_id:row.id,reminder_class:'urgent',occurrence_key:key,target_date:target,effective_trigger_at:now.toISOString(),status:'pending',deep_link:deepLink(type,row.id),policy_source:'default'});const payload={title:'Urgent · preston.ai',body:row.title,url:deepLink(type,row.id),tag:`preston-urgent-${type}-${row.id}-${today}`};totalDelivered+=await deliver({supabase,userId,reminder,payload,pushTransport,deps:d});}
  return{sent:totalDelivered>0,count:considered,deliveries:totalDelivered};
}

module.exports={runMorningSummary,runUrgentCheck,eligibleMorningItems,defaultDeps};
