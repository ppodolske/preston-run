'use strict';

function compact(values){return values.filter(v=>v!==null&&v!==undefined&&String(v).trim()!=='').map(v=>String(v));}
function dateParts(value,zone='Australia/Sydney'){if(!value)return null;const parts=new Intl.DateTimeFormat('en-AU',{timeZone:zone,day:'numeric',month:'short',year:'numeric'}).formatToParts(new Date(value));return Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));}
function dateLabel(value,zone='Australia/Sydney'){const p=dateParts(value,zone);return p?`${Number(p.day)} ${p.month}`:'';}
function timeLabel(value,zone='Australia/Sydney'){if(!value)return'';const raw=new Intl.DateTimeFormat('en-AU',{timeZone:zone,hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(value)).toLowerCase();return raw.replace(/\s+(am|pm)$/,'$1');}
function sameLocalDate(a,b,zone){const ap=dateParts(a,zone),bp=dateParts(b,zone);return Boolean(ap&&bp&&ap.day===bp.day&&ap.month===bp.month&&ap.year===bp.year);}
function dateRangeLabel(start,end,zone='Australia/Sydney'){
  if(!start&&!end)return'';if(!end)return dateLabel(start,zone);if(!start)return dateLabel(end,zone);
  const a=dateParts(start,zone),b=dateParts(end,zone);if(!a||!b)return'';
  if(a.day===b.day&&a.month===b.month&&a.year===b.year)return`${Number(a.day)} ${a.month}`;
  if(a.month===b.month&&a.year===b.year)return`${Number(a.day)}–${Number(b.day)} ${b.month}`;
  return`${Number(a.day)} ${a.month}–${Number(b.day)} ${b.month}`;
}
function timeRangeLabel(start,end,zone='Australia/Sydney'){
  if(!start&&!end)return'';const a=timeLabel(start,zone),b=timeLabel(end,zone);if(!end)return a;if(!start)return b;
  const as=(a.match(/(am|pm)$/)||[])[1],bs=(b.match(/(am|pm)$/)||[])[1];if(as&&bs&&as===bs)return`${a.replace(/(am|pm)$/,'')}–${b}`;return`${a}–${b}`;
}
function serviceNumbers(legs=[]){return[...new Set((legs||[]).map(x=>String(x&&x.service_number||'').trim()).filter(Boolean))];}
function bookingSummaryTokens(booking={},legs=[]){
  const type=booking.booking_type||'other',zone=booking.time_zone||legs[0]?.departure_time_zone||'Australia/Sydney',services=serviceNumbers(legs),tokens=[];
  if(booking.provider)tokens.push(booking.provider);
  if(services.length)tokens.push(services.join(' / '));
  if(type==='hire_car'&&booking.starts_at&&booking.ends_at){tokens.push(`${dateLabel(booking.starts_at,zone)} ${timeLabel(booking.starts_at,zone)} – ${dateLabel(booking.ends_at,zone)} ${timeLabel(booking.ends_at,zone)}`);}
  else if(['activity'].includes(type)&&booking.starts_at){tokens.push(dateLabel(booking.starts_at,zone));if(booking.ends_at&&sameLocalDate(booking.starts_at,booking.ends_at,zone))tokens.push(timeRangeLabel(booking.starts_at,booking.ends_at,zone));}
  else if(booking.starts_at||booking.ends_at)tokens.push(dateRangeLabel(booking.starts_at,booking.ends_at,zone));
  if(booking.confirmation_reference)tokens.push(`Ref ${booking.confirmation_reference}`);
  return compact(tokens);
}
function eventSummaryTokens(event={}){const zone=event.time_zone||'Australia/Sydney',tokens=['Event'];if(event.starts_at)tokens.push(dateLabel(event.starts_at,zone));if(event.starts_at&&event.ends_at&&sameLocalDate(event.starts_at,event.ends_at,zone))tokens.push(timeRangeLabel(event.starts_at,event.ends_at,zone));if(event.location)tokens.push(event.location);if(event.confirmation_reference)tokens.push(`Ref ${event.confirmation_reference}`);return compact(tokens);}
function travelTypeInventory({bookings=[],events=[]}={}){
  const counts={flight:0,accommodation:0,hire_car:0,transport:0,activity:0,other:0};for(const b of bookings||[])if(counts[b.booking_type]!==undefined)counts[b.booking_type]+=1;else counts.other+=1;counts.activity+=(events||[]).length;
  const out=[];if(counts.flight)out.push(counts.flight===1?'Flight':`${counts.flight} Flights`);if(counts.accommodation)out.push(counts.accommodation===1?'Stay':`${counts.accommodation} Stays`);if(counts.hire_car)out.push(counts.hire_car===1?'Car':`${counts.hire_car} Cars`);if(counts.transport)out.push(counts.transport===1?'Transport':`${counts.transport} Transport`);if(counts.activity)out.push(counts.activity===1?'Activity':`${counts.activity} Activities`);if(counts.other)out.push(counts.other===1?'Other':`${counts.other} Other`);return out;
}
function dateKeyInZone(value,zone='Australia/Sydney'){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value instanceof Date?value:new Date(value));const map=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return`${map.year}-${map.month}-${map.day}`;}
function keyMs(key){const[y,m,d]=String(key).split('-').map(Number);return Date.UTC(y,m-1,d);}
function describeTripTiming(trip={},now=new Date()){
  if(!trip.start_date&&!trip.end_date)return{state:'undated',label:'Dates not set'};const today=keyMs(dateKeyInZone(now)),start=keyMs(trip.start_date||trip.end_date),end=keyMs(trip.end_date||trip.start_date),day=86400000;
  if(today>=start&&today<=end){if(start===end&&today===start)return{state:'today',label:'Today'};return{state:'in_progress',label:'In progress'};}
  if(start>today){const n=Math.round((start-today)/day);return{state:'upcoming',label:n===1?'Tomorrow':`In ${n} days`};}
  const n=Math.round((today-end)/day);return{state:'ended',label:n===1?'Ended yesterday':`Ended ${n} days ago`};
}
function selectNextItineraryEntry(itinerary=[],now=new Date()){
  const nowMs=now instanceof Date?now.getTime():new Date(now).getTime();const relevant=(itinerary||[]).filter(entry=>{const r=entry&&entry.record||{};if(entry.type==='booking'&&r.status==='cancelled')return false;const end=r.ends_at?Date.parse(r.ends_at):null,start=r.starts_at?Date.parse(r.starts_at):null;return end!=null?end>=nowMs:start!=null?start>=nowMs:false;});
  relevant.sort((a,b)=>{const ar=a.record||{},br=b.record||{},at=ar.starts_at?Date.parse(ar.starts_at):Infinity,bt=br.starts_at?Date.parse(br.starts_at):Infinity;if(at!==bt)return at-bt;const ap=Number(ar.position||1),bp=Number(br.position||1);if(ap!==bp)return ap-bp;return String(ar.title||'').localeCompare(String(br.title||''));});return relevant[0]||null;
}
module.exports={compact,dateLabel,timeLabel,dateRangeLabel,timeRangeLabel,bookingSummaryTokens,eventSummaryTokens,travelTypeInventory,describeTripTiming,selectNextItineraryEntry};
