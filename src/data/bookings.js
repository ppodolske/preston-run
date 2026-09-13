function requireUser(user) {
  if (!user || !user.id) throw new Error('Authenticated user is required');
  return user.id;
}
function optionalText(value) { const text=String(value ?? '').trim(); return text || null; }
function bookingPayload(input={}) { return {
  segment_id:optionalText(input.segment_id),
  position:Number(input.position || 1),
  booking_type:input.booking_type,
  title:String(input.title ?? '').trim(),
  provider:optionalText(input.provider),
  confirmation_reference:optionalText(input.confirmation_reference),
  status:input.status || 'confirmed',
  starts_at:input.starts_at || null,
  ends_at:input.ends_at || null,
  time_zone:String(input.time_zone || 'Australia/Sydney'),
  location:optionalText(input.location),
  booking_url:optionalText(input.booking_url),
  notes:optionalText(input.notes)
}; }

async function listBookings(supabase,user,tripId) { const uid=requireUser(user); const r=await supabase.from('bookings').select('*').eq('user_id',uid).eq('trip_id',tripId).order('position',{ascending:true}).order('starts_at',{ascending:true,nullsFirst:false}); if(r.error)throw r.error; return r.data||[]; }
async function getBooking(supabase,user,id) { const uid=requireUser(user); const r=await supabase.from('bookings').select('*').eq('id',id).eq('user_id',uid).maybeSingle(); if(r.error)throw r.error; return r.data||null; }
async function createBooking(supabase,user,tripId,input) { const uid=requireUser(user); const r=await supabase.from('bookings').insert({...bookingPayload(input),trip_id:tripId,user_id:uid,source_metadata:{source:'manual'}}).select('*').single(); if(r.error)throw r.error; return r.data; }
async function updateBooking(supabase,user,id,input) { const uid=requireUser(user); const r=await supabase.from('bookings').update({...bookingPayload(input),updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',uid).select('*').maybeSingle(); if(r.error)throw r.error; return r.data||null; }
async function deleteBooking(supabase,user,id) { const uid=requireUser(user); const r=await supabase.from('bookings').delete().eq('id',id).eq('user_id',uid).select('id').maybeSingle(); if(r.error)throw r.error; return Boolean(r.data); }

module.exports={listBookings,getBooking,createBooking,updateBooking,deleteBooking,bookingPayload};
