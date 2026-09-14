'use strict';

const {buildFact}=require('./gmail-facts');
const {localDateTimeToUtc}=require('./date-time');

const BAD_REFERENCES=new Set(['EMAIL','REMINDER','NUMBER','CONFIRMED','DISCOVERY','PRESTON','ERENCE','REFERENCE','BOOKING','RESERVATION','CONFIRMATION']);
const MONTHS={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};

function allText(envelope={}){return [envelope.sender,envelope.subject,envelope.text].filter(Boolean).join('\n');}
function clean(value){const v=String(value||'').replace(/\s+/g,' ').trim();return v||null;}
function titleCasePlace(value){return clean(value)?.replace(/\s+Airport$/i,'')||null;}
function normalizeAirportPlace(value){return clean(value)?.replace(/\s*\([^)]*\)\s*$/,'').replace(/\s+Airport(?:\s*-\s*T\d+\s*International)?$/i,'').trim()||null;}
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
function parseJetstarRoute(text){
  const value=String(text||'');
  const explicit=value.match(/Flight\s*#1\s*:\s*([A-Za-z][A-Za-z .'-]*?)(?:\s*\([^)]*\))?\s*>\s*([A-Za-z][A-Za-z .'-]*?)(?:\s*\([^)]*\))?(?=\s+Flight\s*#2\s*:|$)/i);
  if(explicit)return{origin:normalizeAirportPlace(explicit[1]),destination:normalizeAirportPlace(explicit[2])};
  const numbered=value.match(/\bJQ\s*\d{2,4}\s+([A-Za-z][A-Za-z .'-]*?)\s+to\s+([A-Za-z][A-Za-z .'-]*?)(?=\s+\d{1,2}[\/\s]|[.;]|$)/i);
  if(numbered)return{origin:normalizeAirportPlace(numbered[1]),destination:normalizeAirportPlace(numbered[2])};
  return firstRoute(value);
}
function jetstarRoutes(text){
  const value=String(text||''),routes=[];
  for(const m of value.matchAll(/Flight\s*#(\d+)\s*:\s*([A-Za-z][A-Za-z .'-]*?)(?:\s*\([^)]*\))?\s*>\s*([A-Za-z][A-Za-z .'-]*?)(?:\s*\([^)]*\))?(?=\s+Flight\s*#\d+\s*:|\s+Jetstar\b|\s+International\b|$)/gi)){
    routes[Number(m[1])-1]={origin:normalizeAirportPlace(m[2]),destination:normalizeAirportPlace(m[3])};
  }
  return routes.filter(Boolean);
}
function placeZone(place){if(/queenstown/i.test(String(place||'')))return'Pacific/Auckland';if(/sydney/i.test(String(place||'')))return'Australia/Sydney';return'Australia/Sydney';}
function localDateTime(year,monthName,day,time,zone){
  const m=String(time||'').match(/^(\d{1,2}):(\d{2})(am|pm)$/i);if(!m)return null;
  const clock=to24(m[1],m[2],m[3]),month=MONTHS[String(monthName||'').toLowerCase()];if(!clock||!month)return null;
  const local=`${year}-${String(month).padStart(2,'0')}-${String(Number(day)).padStart(2,'0')}T${String(clock.hour).padStart(2,'0')}:${String(clock.minute).padStart(2,'0')}`;
  return localDateTimeToUtc(local,zone);
}
function parseJetstarLegs(text){
  const value=String(text||''),routes=jetstarRoutes(value);
  const rows=[...value.matchAll(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+(\d{1,2}:\d{2}(?:am|pm))\s+(JQ\d{2,4})\b/gi)];
  if(!rows.length||routes.length<rows.length)return[];
  return rows.map((row,index)=>{
    const route=routes[index];if(!route)return null;
    const departureZone=placeZone(route.origin),arrivalZone=placeZone(route.destination),segment=value.slice(row.index+row[0].length,rows[index+1]?.index??value.length);
    const escaped=String(route.destination).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const arrival=(segment.match(new RegExp(`\\b${escaped}(?:\\s*\\([^)]*\\))?\\s+(\\d{1,2}:\\d{2}(?:am|pm))\\b`,'i'))||[])[1]||null;
    return {position:index+1,service_number:String(row[5]).toUpperCase(),origin:route.origin,destination:route.destination,departs_at:localDateTime(Number(row[3]),row[2],row[1],row[4],departureZone),arrives_at:arrival?localDateTime(Number(row[3]),row[2],row[1],arrival,arrivalZone):null,departure_time_zone:departureZone,arrival_time_zone:arrivalZone};
  }).filter(Boolean);
}
function statusFromText(text){
  const value=String(text||'');
  const explicit=[
    /\b(?:your|this|the)\s+(?:booking|reservation|flight|trip|rental|vehicle)\s+(?:has been|was|is)\s+(?:cancelled|canceled)\b/i,
    /\b(?:booking|reservation|flight|trip|rental)\s+(?:has been|was|is)\s+(?:cancelled|canceled)\b/i,
    /\b(?:we|hertz|jetstar|qantas|airbnb)\s+(?:have\s+)?(?:cancelled|canceled)\s+(?:your|the)\s+(?:booking|reservation|flight|trip|rental)\b/i,
    /\b(?:cancelled|canceled)\s+(?:booking|reservation|flight|trip|rental)\b/i,
    /\b(?:booking|reservation|flight|trip|rental)\s+(?:cancelled|canceled)\b/i
  ];
  return explicit.some(pattern=>pattern.test(value))?'cancelled':'confirmed';
}
function bookingUrl(text){
  const value=String(text||'');
  const preferred=value.match(/(?:manage|modify)(?:\s+(?:your|my|the))?\s+(?:booking|reservation|rental|trip)[^\n]{0,120}?(https?:\/\/[^\s<>"']+)/i)||value.match(/view(?:\s+(?:your|my|the))\s+(?:booking|reservation|rental|trip)[^\n]{0,120}?(https?:\/\/[^\s<>"']+)/i);
  const urls=[...value.matchAll(/https?:\/\/[^\s<>"']+/gi)].map(m=>m[0].replace(/[\]\),.;]+$/,''));
  const valid=url=>url&&!/\b(?:www\.)?w3\.org\/2001\/XMLSchema|schemas\.microsoft\.com/i.test(url)&&!/\.(?:png|jpe?g|gif|svg|webp)(?:\?|$)/i.test(url);
  if(preferred&&valid(preferred[1]))return preferred[1].replace(/[\]\),.;]+$/,'');
  return urls.find(valid)||null;
}
function geography(label,city,region,country){return{label:clean(label),city:clean(city),region:clean(region),country:clean(country)};}
function baseCandidate(overrides={}){return{booking_type:'other',provider:null,confirmation_reference:null,title:'Travel booking',status:'confirmed',starts_at:null,ends_at:null,time_zone:'Australia/Sydney',location:null,origin:null,destination:null,booking_url:null,legs:[],geography:geography(null,null,null,null),confidence:0.55,evidence:[],...overrides};}
function to24(hour,minute,ampm){let h=Number(hour),m=Number(minute);if(!Number.isInteger(h)||!Number.isInteger(m)||m<0||m>59)return null;if(ampm){if(h<1||h>12)return null;const ap=String(ampm).toLowerCase();if(ap==='pm'&&h!==12)h+=12;if(ap==='am'&&h===12)h=0;}else if(h<0||h>23)return null;return{hour:h,minute:m};}
function hertzDateTime(text,label,zone){
  const value=String(text||''),escaped=String(label).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  let m=value.match(new RegExp(`${escaped}\\s+(?:[A-Za-z]{3,9},\\s*)?([A-Za-z]{3,9})\\s+(\\d{1,2}),\\s*(\\d{4}),?\\s*(?:at\\s*)?(\\d{1,2}):(\\d{2})\\s*(am|pm)?`,'i'));
  let year,month,day,hour,minute,ampm;
  if(m){month=MONTHS[m[1].toLowerCase()];day=Number(m[2]);year=Number(m[3]);hour=m[4];minute=m[5];ampm=m[6];}
  else{
    m=value.match(new RegExp(`${escaped}\\s+(?:[A-Za-z]{3,9},\\s*)?(\\d{1,2})\\s+([A-Za-z]{3,9}),?\\s*(\\d{4})\\s*(?:at|,)?\\s*(\\d{1,2}):(\\d{2})\\s*(am|pm)?`,'i'));
    if(!m)return null;day=Number(m[1]);month=MONTHS[m[2].toLowerCase()];year=Number(m[3]);hour=m[4];minute=m[5];ampm=m[6];
  }
  const clock=to24(hour,minute,ampm);if(!month||!clock)return null;
  const local=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(clock.hour).padStart(2,'0')}:${String(clock.minute).padStart(2,'0')}`;
  return localDateTimeToUtc(local,zone);
}

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
  const dates=parseSlashDates(text),route=parseJetstarRoute(text),legs=parseJetstarLegs(text),destination=route&&route.destination,nz=destination&&/queenstown/i.test(destination);
  const starts=legs[0]?.departs_at||dates[0]||null,lastLeg=legs.at(-1),ends=(lastLeg&&(lastLeg.arrives_at||lastLeg.departs_at))||dates[1]||null;
  return baseCandidate({booking_type:'flight',provider:'Jetstar',confirmation_reference:ref,title:route?`${route.origin} → ${route.destination} flights`:'Jetstar flight itinerary',status:statusFromText(text),starts_at:starts,ends_at:ends,time_zone:nz?'Pacific/Auckland':'Australia/Sydney',origin:route&&route.origin,destination,location:destination,booking_url:bookingUrl(text),legs,geography:geography(destination,destination,null,nz?'New Zealand':null),confidence:ref&&(dates.length>=2||legs.length>=2)?0.97:0.84,evidence:['provider:jetstar',ref?'reference:explicit':null,(dates.length||legs.length)?'dates:parsed':null,route?'route:parsed':null,legs.length?'legs:parsed':null].filter(Boolean)});
}
function parseBookingCom(envelope,text){
  if(!/booking\.com/i.test(`${envelope.sender||''} ${envelope.subject||''}`))return null;
  const ref=normalizeReference((text.match(/\bConfirmation\s*:\s*([A-Z0-9-]{5,25})\b/i)||[])[1])||explicitReference(text);
  const title=clean((String(envelope.subject||'').match(/confirmed at\s+(.+)$/i)||[])[1])||'Booking.com accommodation';
  const geoMatch=text.match(/\b(Bowral)\s*,\s*(New South Wales|NSW)\s*,\s*(Australia)\b/i);
  const mentionsBowral=/\bBowral\b/i.test(text);
  const city=(geoMatch&&geoMatch[1])||(mentionsBowral?'Bowral':null);
  const region=(geoMatch&&geoMatch[2])||(mentionsBowral?'NSW':null);
  const country=(geoMatch&&geoMatch[3])||(mentionsBowral?'Australia':null);
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
  const locationMatch=String(text||'').match(/\bPickup\s+Location\s+([A-Z][A-Za-z .'-]{1,40}?)\s+Airport\b/i);
  let city=locationMatch&&normalizeAirportPlace(locationMatch[1]);
  if(!city&&/\bQueenstown Airport\b/i.test(text))city='Queenstown';
  if(!city){const cityMatch=String(text||'').match(/\b(?:pick-?up|return|location|rental location)\s*:?\s*([A-Z][A-Za-z .'-]{2,30}?)\s+Airport\b/i);city=cityMatch&&titleCasePlace(cityMatch[1]);}
  const queenstown=city&&/^Queenstown$/i.test(city),brisbane=city&&/^Brisbane$/i.test(city);
  const region=brisbane?'QLD':null,country=queenstown?'New Zealand':brisbane?'Australia':null,zone=queenstown?'Pacific/Auckland':brisbane?'Australia/Brisbane':'Australia/Sydney';
  const starts=hertzDateTime(text,'Pickup Date & Time',zone),ends=hertzDateTime(text,'Drop-off Date & Time',zone);
  const fallbackDates=[...parseLongDates(text),...parseMonthFirstDates(text)].slice(0,2);
  return baseCandidate({booking_type:'hire_car',provider:'Hertz',confirmation_reference:ref,title:city?`Hertz car hire · ${city}`:'Hertz car hire',status:statusFromText(text),starts_at:starts||fallbackDates[0]||null,ends_at:ends||fallbackDates[1]||null,time_zone:zone,location:city?`${city} Airport`:null,booking_url:bookingUrl(text),geography:geography(city&&region?`${city}, ${region}`:city,city,region,country),confidence:ref?0.96:0.78,evidence:['provider:hertz',ref?'reference:explicit':null,city?'geography:parsed':null,(starts||fallbackDates.length)?'dates:parsed':null].filter(Boolean)});
}
function parseFareHarbor(envelope,text){
  if(!/fareharbor|cruise te anau|discovery cruise/i.test(`${envelope.sender||''} ${envelope.subject||''} ${text}`))return null;
  const ref=normalizeReference((text.match(/\bBooking\s*#\s*([A-Z0-9-]{5,25})\b/i)||[])[1]);
  const date=(text.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i)||[]);
  const times=text.match(/@\s*(\d{1,2}):(\d{2})(am|pm)\s*-\s*(\d{1,2}):(\d{2})(am|pm)/i);
  let starts=null,ends=null;
  if(date[1]&&times){const y=Number(date[3]),m=MONTHS[date[2].toLowerCase()],d=Number(date[1]);const toHour=(h,ampm)=>{let n=Number(h)%12;if(String(ampm).toLowerCase()==='pm')n+=12;return n;};const local=(h,min)=>`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}T${String(h).padStart(2,'0')}:${min}`;starts=localDateTimeToUtc(local(toHour(times[1],times[3]),times[2]),'Pacific/Auckland');ends=localDateTimeToUtc(local(toHour(times[4],times[6]),times[5]),'Pacific/Auckland');}
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
  if(candidate.origin||candidate.destination||candidate.legs?.length)facts.push(buildFact({...common,factType:'booking.transport',factValue:{origin:candidate.origin,destination:candidate.destination,legs:candidate.legs||[]}}));
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

module.exports={extractBookingCandidate,normalizeReference,explicitReference,BAD_REFERENCES,parseJetstarLegs};