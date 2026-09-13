const {validateReminderSettings,validateReminderOverride}=require('../domain/reminders');

function requireUserId(userId){if(!userId)throw new Error('Authenticated user is required');}
function cleanOwner(input={}){const out={...input};delete out.user_id;delete out.id;delete out.created_at;return out;}

async function getReminderSettings(supabase,userId){
  requireUserId(userId);
  const result=await supabase.from('reminder_settings').select('*').eq('user_id',userId).maybeSingle();
  if(result.error)throw result.error;return result.data||null;
}

async function upsertReminderSettings(supabase,userId,input){
  requireUserId(userId);
  const payload={...cleanOwner(validateReminderSettings(input)),user_id:userId,updated_at:new Date().toISOString()};
  const result=await supabase.from('reminder_settings').upsert(payload,{onConflict:'user_id'}).select('*').single();
  if(result.error)throw result.error;return result.data;
}

async function getReminderOverride(supabase,userId,entityType,entityId){
  requireUserId(userId);
  const result=await supabase.from('reminder_overrides').select('*').eq('user_id',userId).eq('entity_type',entityType).eq('entity_id',entityId).maybeSingle();
  if(result.error)throw result.error;return result.data||null;
}

async function upsertReminderOverride(supabase,userId,entityType,entityId,input){
  requireUserId(userId);
  const valid=validateReminderOverride(input);
  const payload={user_id:userId,entity_type:entityType,entity_id:entityId,offsets:valid.offsets,enabled:valid.enabled,updated_at:new Date().toISOString()};
  const result=await supabase.from('reminder_overrides').upsert(payload,{onConflict:'user_id,entity_type,entity_id'}).select('*').single();
  if(result.error)throw result.error;return result.data;
}

async function deleteReminderOverride(supabase,userId,entityType,entityId){
  requireUserId(userId);
  const result=await supabase.from('reminder_overrides').delete().eq('user_id',userId).eq('entity_type',entityType).eq('entity_id',entityId).select('id').maybeSingle();
  if(result.error)throw result.error;return Boolean(result.data);
}

async function upsertReminderOccurrence(supabase,userId,input){
  requireUserId(userId);
  const payload={...cleanOwner(input),user_id:userId,updated_at:new Date().toISOString()};
  const result=await supabase.from('reminders').upsert(payload,{onConflict:'user_id,occurrence_key'}).select('*').single();
  if(result.error)throw result.error;return result.data;
}

async function listDueReminderOccurrences(supabase,userId,now=new Date().toISOString()){
  requireUserId(userId);
  const result=await supabase.from('reminders').select('*').eq('user_id',userId).eq('status','pending').lte('effective_trigger_at',now).order('effective_trigger_at',{ascending:true});
  if(result.error)throw result.error;return result.data||[];
}

async function acknowledgeReminder(supabase,userId,id,now=new Date().toISOString()){
  requireUserId(userId);
  const result=await supabase.from('reminders').update({status:'acknowledged',acknowledged_at:now,snoozed_until:null,updated_at:now}).eq('id',id).eq('user_id',userId).select('*').maybeSingle();
  if(result.error)throw result.error;return result.data||null;
}

async function snoozeReminder(supabase,userId,id,snoozedUntil,now=new Date().toISOString()){
  requireUserId(userId);
  const result=await supabase.from('reminders').update({status:'snoozed',snoozed_until:snoozedUntil,updated_at:now}).eq('id',id).eq('user_id',userId).select('*').maybeSingle();
  if(result.error)throw result.error;return result.data||null;
}

async function markReminderSent(supabase,userId,id,now=new Date().toISOString()){
  requireUserId(userId);
  const result=await supabase.from('reminders').update({status:'sent',first_sent_at:now,last_sent_at:now,updated_at:now}).eq('id',id).eq('user_id',userId).select('*').maybeSingle();
  if(result.error)throw result.error;return result.data||null;
}

async function listPushSubscriptions(supabase,userId,{activeOnly=false}={}){
  requireUserId(userId);let query=supabase.from('push_subscriptions').select('*').eq('user_id',userId);
  if(activeOnly)query=query.eq('active',true);const result=await query.order('created_at',{ascending:true});
  if(result.error)throw result.error;return result.data||[];
}

async function upsertPushSubscription(supabase,userId,input){
  requireUserId(userId);
  const payload={endpoint:String(input.endpoint||''),p256dh:String(input.p256dh||''),auth_secret:String(input.auth_secret||''),device_label:String(input.device_label||'This device').trim()||'This device',active:input.active!==false,last_used_at:new Date().toISOString(),user_id:userId,updated_at:new Date().toISOString()};
  const result=await supabase.from('push_subscriptions').upsert(payload,{onConflict:'user_id,endpoint'}).select('*').single();
  if(result.error)throw result.error;return result.data;
}

async function setPushSubscriptionActive(supabase,userId,id,active){
  requireUserId(userId);
  const result=await supabase.from('push_subscriptions').update({active:Boolean(active),updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',userId).select('*').maybeSingle();
  if(result.error)throw result.error;return result.data||null;
}

async function markPushSubscriptionFailure(supabase,userId,id,{code,permanent},now=new Date().toISOString()){
  requireUserId(userId);
  const patch={failure_code:code||null,failure_at:now,updated_at:now};if(permanent)patch.active=false;
  const result=await supabase.from('push_subscriptions').update(patch).eq('id',id).eq('user_id',userId).select('*').maybeSingle();
  if(result.error)throw result.error;return result.data||null;
}

async function recordNotificationDelivery(supabase,userId,input){
  requireUserId(userId);
  const payload={...cleanOwner(input),user_id:userId};
  const result=await supabase.from('notification_deliveries').insert(payload).select('*').single();
  if(result.error)throw result.error;return result.data;
}

async function listNotificationHistory(supabase,userId){
  requireUserId(userId);
  const result=await supabase.from('notification_deliveries').select('id,reminder_id,push_subscription_id,attempted_at,delivered_at,status,error_category,retry_count').eq('user_id',userId).order('attempted_at',{ascending:false});
  if(result.error)throw result.error;return result.data||[];
}

async function cancelFutureInheritedOccurrences(supabase,userId,after=new Date().toISOString()){
  requireUserId(userId);
  const now=new Date().toISOString();
  const result=await supabase.from('reminders').update({status:'cancelled',updated_at:now}).eq('user_id',userId).eq('status','pending').eq('policy_source','default').gt('effective_trigger_at',after).select('id');
  if(result.error)throw result.error;return result.data||[];
}

module.exports={getReminderSettings,upsertReminderSettings,getReminderOverride,upsertReminderOverride,deleteReminderOverride,upsertReminderOccurrence,listDueReminderOccurrences,acknowledgeReminder,snoozeReminder,markReminderSent,listPushSubscriptions,upsertPushSubscription,setPushSubscriptionActive,markPushSubscriptionFailure,recordNotificationDelivery,listNotificationHistory,cancelFutureInheritedOccurrences};
