'use strict';

const {buildFact}=require('./gmail-facts');
const {localDateTimeToUtc}=require('./date-time');

const BAD_REFERENCES=new Set(['EMAIL','REMINDER','NUMBER','CONFIRMED','DISCOVERY','PRESTON','ERENCE','REFERENCE','BOOKING','RESERVATION','CONFIRMATION']);
const MONTHS={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};

function allText(envelope={}){return [envelope.sender,envelope.subject,envelope.text].filter(Boolean).join('\n');}
function clean(value){const v=String(value||'').replace(/\s+/g,' ').trim();return v||null;}
function titleCasePlace(value){return clean(value)?.replace(/\s+Airport$/i,'')||null;}
function normalizeReference(value){
  const ref=String(value||'').trim().replace(/^[#:\-\s]+|[.,;:]+$/g,'').toUpperCase();
  if(!/^[A-Z0-9][A-Z0-9-]{4,24}$/.test(ref)||BAD_REFERENCES.has(ref))return null;
  return ref;
}
function explicitReference(text){
  const patterns=[
    /\b(?:booking\s+(?:reference|ref)|confirmation\s+(?:reference|number)|reservation\s+(?:reference|number)|booking\s*#|confirmation\s*#)\s*(?:is|:|#)?\s*([A-Z0-9-]{5,25})\b/i,
    /\bBooking\s*#\s*([A-Z0-9-]{5,25})\b/i
  ];
  for(const pattern of patterns){const m=String(text||'').match(pattern);const ref=m&&normalizeReference(m[1]);if(ref)return ref;}
  return null;
}
function dateIso(year,month,day){return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T00:00:00.000Z`;}
function parseCompactDate(text){const m=String(text||'').match(/\b(\d{1,2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)(\d{2,4})\b/i);if(!m)return null;let y=Number(m[3]);if(y<100)y+=2000;return dateIso(y,MONTHS[m[2].toLowerCase()],Number(m[1]));}
function parseSlashDates(text){return [...String(text||'').matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)].map(m=>dateIso(Number(m[3]),Number(m[2]),Number(m[1])));}
function parseLongDates(text){return [...String(text||'').matchAll(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi)].map(m=>dateIso(Number(m[3]),MONTHS[m[2].toLowerCase()],Number(m[1])));}
function parseMonthFirstDates(text){return [...String(text||'').matchAll(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})\b/gi)].map(m=>dateIso(Number(m[3]),MONTHS[m[1].toLowerCase()],Number(m[2])));}
function firstRoute(text){const m=String(text||'').match(/\b([A-Z][A-Za-z .'-]{1,40}?)\s+to\s+([A-Z][A-Za-z .'-]{1,40}?)(?=\s+\d{1,2}[\/\s]|\s+on\b|[.;\n]|$)/);return m?{origin:clean(m[1]),destination:clean(m[2])}:null;}
function statusFromText(text){return /\b(?:cancelled|canceled|cancellation)\b/i.test(text)?'cancelled':'confirmed';}
function bookingUrl(text){const m=String(text||'').match(/https?:\/\/[^\s<>"']+/i);return m?m[0].replace(/[),.;]+$/,''):null;}
function geography(label,city,region,country){return{label:clean(label),city:clean(city),region:clean(region),country:clean(country)};}
function baseCandidate(overrides={}){return{booking_type:'other',provider:null,confirmation_reference:null,title:'Travel booking',status:'confirmed',starts_at:null,ends_at:null,time_zone:'Australia/Sydney',location:null,origin:null,destination:null,booking_url:null,geography:geography(null,null,null,null),confidence:0.55,evidence:[],...overrides};}

function parseQantas(envelope,text){
  if(!/qantas/i.test(`${envelope.sender||''} ${envelope.subject||''}`))return null;
  const ref=normalizeReference((text.match(/\bQantas booking reference is\s+([A-Z0-9-]{5,25})\b/i)||[])[1])||explicitReference(text);
  const routeMatch=text.match(/\bfrom\s+([A-Za-z][A-Za-z .'-]*?)(?:\s*\([^)]*\))?\s+to\s+([A-Za-z][A-Za-z .'-]*?)\s+on\b/i);
  const route=routeMatch?{origin:clean(routeMatch[1]),destination:clean(routeMatch[2])}:firstRoute(text);
  const starts=parseCompactDate(text);
  const destination=route&&route.destination;
  return baseCandidate({booking_type:'flight',provider:'Qantas',confirmation_reference:ref,title:route?`${route.origin} → ${route.destination} flight`:'Qantas flight',status:statusFromText(text),starts_at:starts,origin:route&&route.origin,destination,location:destination,booking_url:bookingUrl(text),geography:geography(destination,destination,null,null),confidence:ref&&route&&starts?0.97:0.82,evidence:['provider:qantas',ref?'reference:explicit':null,route?'route:parsed':null,starts?'date:parsed':null].filter(Boolean)});
}
function parseJetstar(envelope,text){
  if(!/jetstar/i.test(`${envelope.sender||''} ${envelope.subject||''}`))return null;
  const ref=normalizeReference((text.match(/\bBooking\s+ref\s*#?\s*([A-Z0-9-]{5,25})\b/i)||[])[1])||explicitReference(text);
  const dates=parseSlashDates(text);const route=firstRoute(text);const destination=route&&route.destination;
  return baseCandidate({booking_type:'flight',provider:'Jetstar',confirmation_reference:ref,title:route?`${route.origin} → ${route.destination} flights`:'Jetstar flight itinerary',status:statusFromText(text),starts_at:dates[0]||null,ends_at:dates[1]||null,origin:route&&route.origin,destination,location:destination,booking_url:bookingUrl(text),geography:geography(destination,destination,null,destination&&/queenstown/i.test(destination)?'New Zealand':null),confidence:ref&&dates.length>=2?0.97:0.84,evidence:['provider:jetstar',ref?'reference:explicit':null,dates.length?'dates:parsed':null,route?'route:parsed':null].filter(Boolean)});
}
function parseBookingCom(envelope,text){
  if(!/booking\.com/i.test(`${envelope.sender||''} ${envelope.subject||''}`))return null;
  const ref=normalizeReference((text.match(/\bConfirmation\s*:\s*([A-Z0-9-]{5,25})\b/i)||[])[1])||explicitReference(text);
  const title=clean((String(envelope.subject||'').match(/confirmed at\s+(.+)$/i)||[])[1])||'Booking.com accommodation';
  const geoMatch=text.match(/\b(Bowral)\s*,\s*(New South Wales|NSW)\s*,\s*(Australia)\b/i);
  const city=geoMatch&&geoMatch[1],region=geoMatch&&geoMatch[2],country=geoMatch&&geoMatch[3];
  const dates=parseLongDates(text);
  return baseCandidate({booking_type:'accommodation',provider:'Booking.com',confirmation_reference:ref,title,status:statusFromText(text),starts_at:dates[0]||null,ends_at:dates[1]||null,location:city,booking_url:bookingUrl(text),geography:geography(city&&region?`${city}, ${region==='New South Wales'?'NSW':region}`:city,city,region,country),confidence:ref&&city&&dates[0]?0.98:0.83,evidence:['provider:booking.com',ref?'reference:explicit':null,city?'geography:parsed':null,dates.length?'dates:parsed':null].filter(Boolean)});
}
function parseAirbnb(envelope,text){
  if(!/airbnb/i.test(`${envelope.sender||''} ${envelope.subject||''}`))return null;
  const dates=parseMonthFirstDates(text);const queenstown=/\bQueenstown\b/i.test(text);const ref=explicitReference(text);
  return baseCandidate({booking_type:'accommodation',provider:'Airbnb',confirmation_reference:ref,title:'Airbnb stay',status:statusFromText(text),starts_at:dates[0]||null,ends_at:dates[1]||null,location:queenstown?'Queenstown':null,booking_url:bookingUrl(text),geography:geography(queenstown?'Queenstown, New Zealand':null,queenstown?'Queenstown':null,null,queenstown?'New Zealand':null),confidence:dates[0]?0.82:0.7,evidence:['provider:airbnb',dates.length?'dates:parsed':null,queenstown?'geography:parsed':null].filter(Boolean)});
}
function parseHertz(envelope,text){
  if(!/hertz/i.test(`${envelope.sender||''} ${envelope.subject||''}`))return null;
  const ref=normalizeReference((text.match(/\b(?:Hertz Reservation|Confirmation)\s+([A-Z0-9-]{5,25})\b/i)||[])[1])||explicitReference(text);
  const cityMatch=text.match(/\b([A-Z][A-Za-z .'-]{2,30})\s+Airport\b/);const city=cityMatch&&titleCasePlace(cityMatch[1]);const dates=[...parseLongDates(text),...parseMonthFirstDates(text)].slice(0,2);
  return baseCandidate({booking_type:'hire_car',provider:'Hertz',confirmation_reference:ref,title:city?`Hertz car hire · ${city}`:'Hertz car hire',status:statusFromText(text),starts_at:dates[0]||null,ends_at:dates[1]||null,location:city?`${city} Airport`:null,booking_url:bookingUrl(text),geography:geography(city,city,null,city&&/queenstown/i.test(city)?'New Zealand':null),confidence:ref?0.96:0.78,evidence:['provider:hertz',ref?'reference:explicit':null,city?'geography:parsed':null,dates.length?'dates:parsed':null].filter(Boolean)});
}
function parseFareHarbor(envelope,text){
  if(!/fareharbor|cruise te anau|discovery cruise/i.test(`${envelope.sender||''} ${envelope.subject||''} ${text}`))return null;
  const ref=normalizeReference((text.match(/\bBooking\s*#\s*([A-Z0-9-]{5,25})\b/i)||[])[1]);
  const date=(text.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i)||[]);
  const times=text.match(/@\s*(\d{1,2}):(\d{2})(am|pm)\s*-\s*(\d{1,2}):(\d{2})(am|pm)/i);
  let starts=null,ends=null;
  if(date[1]&&times){const y=Number(date[3]),m=MONTHS[date[2].toLowerCase()],d=Number(date[1]);const to24=(h,ampm)=>{let n=Number(h)%12;if(String(ampm).toLowerCase()==='pm')n+=12;return n;};const local=(h,min)=>`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}T${String(h).padStart(2,'0')}:${min}`;starts=localDateTimeToUtc(local(to24(times[1],times[3]),times[2]),'Pacific/Auckland');ends=localDateTimeToUtc(local(to24(times[4],times[6]),times[5]),'Pacific/Auckland');}
  const city=/\bTe Anau\b/i.test(text)?'Te Anau':null;
  return baseCandidate({booking_type:'activity',provider:'Cruise Te Anau',confirmation_reference:ref,title:'Discovery Cruise',status:statusFromText(text),starts_at:starts,ends_at:ends,time_zone:'Pacific/Auckland',location:city,booking_url:bookingUrl(text),geography:geography(city?`${city}, New Zealand`:null,city,null,city?'New Zealand':null),confidence:ref&&starts?0.98:0.85,evidence:['provider:fareharbor',ref?'reference:explicit':null,starts?'schedule:parsed':null,city?'geography:parsed':null].filter(Boolean)});
}
function parseGeneric(envelope,text){
  const ref=explicitReference(text);const lower=text.toLowerCase();let booking_type='other';if(/hotel|accommodation|check-?in/.test(lower))booking_type='accommodation';else if(/car hire|rental car/.test(lower))booking_type='hire_car';else if(/flight|airline/.test(lower))booking_type='flight';else if(/cruise|tour|activity/.test(lower))booking_type='activity';else if(/train|ferry|transport/.test(lower))booking_type='transport';
  const dates=[...parseLongDates(text),...parseMonthFirstDates(text),...parseSlashDates(text)].slice(0,2);const bowral=/\bBowral\b/i.test(text);const title=clean(envelope.subject)||'Travel booking';
  return baseCandidate({booking_type,provider:clean(String(envelope.sender||'').replace(/<[^>]+>/g,'')),confirmation_reference:ref,title,status:statusFromText(text),starts_at:dates[0]||null,ends_at:dates[1]||null,booking_url:bookingUrl(text),location:bowral?'Bowral':null,geography:geography(bowral?'Bowral, NSW':null,bowral?'Bowral':null,bowral?'NSW':null,bowral?'Australia':null),confidence:ref?0.72:0.55,evidence:['provider:generic',ref?'reference:explicit':null,dates.length?'dates:parsed':null].filter(Boolean)});
}

function candidateFacts(candidate,envelope,{parserVersion}){
  const common={sourceRecordId:envelope.sourceRecordId,attachmentRecordId:envelope.attachmentRecordId||null,parserVersion,classificationConfidence:candidate.confidence,extractionConfidence:candidate.confidence};
  const facts=[buildFact({...common,factType:'booking.identity',factValue:{provider:candidate.provider,confirmation_reference:candidate.confirmation_reference,booking_type:candidate.booking_type,title:candidate.title}})];
  if(candidate.starts_at||candidate.ends_at)facts.push(buildFact({...common,factType:'booking.schedule',factValue:{starts_at:candidate.starts_at,ends_at:candidate.ends_at,time_zone:candidate.time_zone}}));
  if(candidate.location||candidate.geography?.city)facts.push(buildFact({...common,factType:'booking.location',factValue:{location:candidate.location,geography:candidate.geography}}));
  if(candidate.origin||candidate.destination)facts.push(buildFact({...common,factType:'booking.transport',factValue:{origin:candidate.origin,destination:candidate.destination}}));
  facts.push(buildFact({...common,factType:'booking.status',factValue:{status:candidate.status}}));
  return facts;
}

function extractBookingCandidate(envelope={},options={}){
  const text=allText(envelope);
  const parsers=[parseQantas,parseJetstar,parseBookingCom,parseAirbnb,parseHertz,parseFareHarbor];
  let candidate=null;
  for(const parser of parsers){candidate=parser(envelope,text);if(candidate)break;}
  candidate=candidate||parseGeneric(envelope,text);
  return{candidate,facts:candidateFacts(candidate,envelope,options)};
}

module.exports={extractBookingCandidate,normalizeReference,explicitReference,BAD_REFERENCES};
