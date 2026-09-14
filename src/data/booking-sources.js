function requireUser(user){if(!user||!user.id)throw new Error('Authenticated user is required');return user.id;}
function optionalText(value){const text=String(value??'').trim();return text||null;}
function normalizeProvider(value){return String(value??'').trim().toLowerCase().replace(/\s+/g,' ');}
function normalizeReference(value){const text=optionalText(value);return text?text.toUpperCase():null;}

async function linkBookingSource(supabase,user,bookingId,sourceRecordId){const uid=requireUser(user);const r=await supabase.from('booking_source_links').upsert({user_id:uid,booking_id:bookingId,source_record_id:sourceRecordId},{onConflict:'user_id,booking_id,source_record_id',ignoreDuplicates:true}).select('*');if(r.error)throw r.error;return Array.isArray(r.data)?r.data[0]||null:r.data||null;}
async function listBookingSources(supabase,user,bookingId){const uid=requireUser(user);const r=await supabase.from('booking_source_links').select('*,gmail_source_records(*)').eq('user_id',uid).eq('booking_id',bookingId).order('created_at',{ascending:true});if(r.error)throw r.error;return r.data||[];}
async function listBookingsForSource(supabase,user,sourceRecordId){const uid=requireUser(user);const r=await supabase.from('booking_source_links').select('booking_id,bookings(*)').eq('user_id',uid).eq('source_record_id',sourceRecordId);if(r.error)throw r.error;return(r.data||[]).map(row=>row.bookings).filter(Boolean);}
async function queryReference(supabase,user,reference){const uid=requireUser(user),ref=normalizeReference(reference);if(!ref)return[];const r=await supabase.from('bookings').select('*').eq('user_id',uid).eq('confirmation_reference',ref);if(r.error)throw r.error;return r.data||[];}
async function queryBookingUrl(supabase,user,url){const uid=requireUser(user),value=optionalText(url);if(!value)return[];const r=await supabase.from('bookings').select('*').eq('user_id',uid).eq('booking_url',value);if(r.error)throw r.error;return r.data||[];}
async function queryStrongShape(supabase,user,candidate={}){const uid=requireUser(user),type=optionalText(candidate.booking_type),startsAt=optionalText(candidate.starts_at),location=optionalText(candidate.location);if(!type||!startsAt||!location)return[];const r=await supabase.from('bookings').select('*').eq('user_id',uid).eq('booking_type',type).eq('starts_at',startsAt).eq('location',location);if(r.error)throw r.error;return r.data||[];}
async function queryThread(supabase,user,threadId){const uid=requireUser(user),thread=optionalText(threadId);if(!thread)return[];const r=await supabase.from('booking_source_links').select('booking_id,bookings(*),gmail_source_records!inner(gmail_thread_id)').eq('user_id',uid).eq('gmail_source_records.gmail_thread_id',thread);if(r.error)throw r.error;const unique=new Map();for(const row of r.data||[])if(row.bookings)unique.set(row.bookings.id,row.bookings);return[...unique.values()];}
function providerMatches(booking,candidate){const wanted=normalizeProvider(candidate&&candidate.provider);return!wanted||normalizeProvider(booking&&booking.provider)===wanted;}
function uniqueMatch(rows,candidate){const filtered=(rows||[]).filter(row=>providerMatches(row,candidate));return filtered.length===1?filtered[0]:null;}
async function findCanonicalBookingForGmailCandidate(supabase,user,candidate={},source={}){requireUser(user);if(source.id){const linked=await listBookingsForSource(supabase,user,source.id);const exact=uniqueMatch(linked,candidate);if(exact)return exact;if(linked.length===1&&!candidate.confirmation_reference&&!candidate.booking_url)return linked[0];}
  if(candidate.confirmation_reference){const byRef=await queryReference(supabase,user,candidate.confirmation_reference);const exact=uniqueMatch(byRef,candidate);if(exact)return exact;}
  if(candidate.booking_url){const byUrl=await queryBookingUrl(supabase,user,candidate.booking_url);const exact=uniqueMatch(byUrl,candidate);if(exact)return exact;}
  if(!candidate.confirmation_reference){const byShape=await queryStrongShape(supabase,user,candidate);const exact=uniqueMatch(byShape,candidate);if(exact)return exact;}
  if(source.gmail_thread_id){const byThread=await queryThread(supabase,user,source.gmail_thread_id);if(byThread.length===1)return byThread[0];}
  return null;
}

module.exports={linkBookingSource,listBookingSources,listBookingsForSource,findCanonicalBookingForGmailCandidate,normalizeProvider,normalizeReference,queryStrongShape};
