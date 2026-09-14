'use strict';

function requireUser(user){if(!user||!user.id)throw new Error('Authenticated user is required');return user.id;}
function optionalText(value){const text=String(value??'').trim();return text||null;}
const LEG_FIELDS=['service_number','origin','destination','departs_at','arrives_at','departure_time_zone','arrival_time_zone'];
const MANUAL_FIELDS=['position',...LEG_FIELDS];
function manualFields(input={}){return MANUAL_FIELDS.filter(key=>Object.hasOwn(input,key));}
function normalizeField(key,value){
  if(['service_number','origin','destination','departure_time_zone','arrival_time_zone'].includes(key))return optionalText(value);
  if(key==='departs_at'||key==='arrives_at')return value||null;
  if(key==='position')return Number(value||1);
  return value;
}
function legPayload(input={}){return{
  position:Number(input.position||1),
  service_number:optionalText(input.service_number),
  origin:optionalText(input.origin),
  destination:optionalText(input.destination),
  departs_at:input.departs_at||null,
  arrives_at:input.arrives_at||null,
  departure_time_zone:optionalText(input.departure_time_zone),
  arrival_time_zone:optionalText(input.arrival_time_zone)
};}
function mergeManualMetadata(existing={},input={}){const metadata={...(existing||{})};if(!metadata.source)metadata.source='manual';metadata.manual_fields=[...new Set([...(Array.isArray(metadata.manual_fields)?metadata.manual_fields:[]),...manualFields(input)])];return metadata;}

async function listBookingLegs(supabase,user,bookingId){const uid=requireUser(user);const r=await supabase.from('booking_legs').select('*').eq('user_id',uid).eq('booking_id',bookingId).order('position',{ascending:true});if(r.error)throw r.error;return r.data||[];}
async function listBookingLegsByBookingIds(supabase,user,bookingIds=[]){const uid=requireUser(user);const ids=[...new Set((bookingIds||[]).filter(Boolean))];if(!ids.length)return[];const r=await supabase.from('booking_legs').select('*').eq('user_id',uid).in('booking_id',ids).order('booking_id',{ascending:true}).order('position',{ascending:true});if(r.error)throw r.error;return r.data||[];}
async function getBookingLeg(supabase,user,id){const uid=requireUser(user);const r=await supabase.from('booking_legs').select('*').eq('id',id).eq('user_id',uid).maybeSingle();if(r.error)throw r.error;return r.data||null;}
async function createBookingLeg(supabase,user,bookingId,input={}){const uid=requireUser(user);const payload={...legPayload(input),user_id:uid,booking_id:bookingId,source_metadata:{source:'manual',manual_fields:manualFields(input)}};const r=await supabase.from('booking_legs').insert(payload).select('*').single();if(r.error)throw r.error;return r.data;}
async function updateBookingLeg(supabase,user,id,input={}){const uid=requireUser(user),existing=await getBookingLeg(supabase,user,id);if(!existing)return null;const payload={...legPayload(input),source_metadata:mergeManualMetadata(existing.source_metadata,input),updated_at:new Date().toISOString()};const r=await supabase.from('booking_legs').update(payload).eq('id',id).eq('user_id',uid).select('*').maybeSingle();if(r.error)throw r.error;return r.data||null;}
async function deleteBookingLeg(supabase,user,id){const uid=requireUser(user);const r=await supabase.from('booking_legs').delete().eq('id',id).eq('user_id',uid).select('id').maybeSingle();if(r.error)throw r.error;return Boolean(r.data);}

async function findByPosition(supabase,uid,bookingId,position){if(!Number.isInteger(Number(position))||Number(position)<=0)return null;const r=await supabase.from('booking_legs').select('*').eq('user_id',uid).eq('booking_id',bookingId).eq('position',Number(position)).maybeSingle();if(r.error)throw r.error;return r.data||null;}
async function findByStrongShape(supabase,uid,bookingId,candidate={}){if(!candidate.service_number||!candidate.origin||!candidate.destination||!candidate.departs_at)return null;const r=await supabase.from('booking_legs').select('*').eq('user_id',uid).eq('booking_id',bookingId).eq('service_number',candidate.service_number).eq('origin',candidate.origin).eq('destination',candidate.destination).eq('departs_at',candidate.departs_at).maybeSingle();if(r.error)throw r.error;return r.data||null;}
async function upsertBookingLegFromGmail(supabase,user,bookingId,candidate={},metadata={}){
  const uid=requireUser(user);let existing=await findByPosition(supabase,uid,bookingId,candidate.position);
  if(!existing)existing=await findByStrongShape(supabase,uid,bookingId,candidate);
  if(!existing){
    const payload={...legPayload(candidate),user_id:uid,booking_id:bookingId,source_metadata:{source:'gmail',manual_fields:[],...(metadata||{})}};payload.source_metadata.source='gmail';payload.source_metadata.manual_fields=[];
    const r=await supabase.from('booking_legs').insert(payload).select('*').single();if(r.error)throw r.error;return r.data;
  }
  const protectedFields=new Set(Array.isArray(existing.source_metadata&&existing.source_metadata.manual_fields)?existing.source_metadata.manual_fields:[]),patch={};
  for(const key of LEG_FIELDS){if(Object.hasOwn(candidate,key)&&!protectedFields.has(key))patch[key]=normalizeField(key,candidate[key]);}
  const sourceMetadata={...(existing.source_metadata||{}),...(metadata||{})};if(existing.source_metadata&&existing.source_metadata.source==='manual')sourceMetadata.source='manual';else sourceMetadata.source='gmail';sourceMetadata.manual_fields=[...protectedFields];patch.source_metadata=sourceMetadata;patch.updated_at=new Date().toISOString();
  const r=await supabase.from('booking_legs').update(patch).eq('id',existing.id).eq('user_id',uid).select('*').maybeSingle();if(r.error)throw r.error;return r.data||existing;
}

module.exports={LEG_FIELDS,listBookingLegs,listBookingLegsByBookingIds,getBookingLeg,createBookingLeg,updateBookingLeg,deleteBookingLeg,upsertBookingLegFromGmail,legPayload,manualFields,mergeManualMetadata};
