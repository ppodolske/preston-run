const {localDateTimeToUtc}=require('./date-time');
const MONTHS={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
const AU_STATES=['NSW','VIC','QLD','SA','WA','TAS','NT','ACT'];
const ACTIVE_AUTOPAY=/\b(?:currently\s+enrolled\s+in\s+autopay|autopay\s+(?:is\s+)?(?:on|enabled|active)|scheduled\s+payment|will\s+be\s+debited\s+from\s+your\s+account)\b/i;

function isoDate(year,month,day){
  const d=new Date(Date.UTC(Number(year),Number(month)-1,Number(day)));
  if(d.getUTCFullYear()!==Number(year)||d.getUTCMonth()!==Number(month)-1||d.getUTCDate()!==Number(day))return null;
  return d.toISOString();
}

function parseExplicitDate(value){
  const text=String(value||'');
  let m=text.match(/\b([0-3]?\d)[\/.\-]([01]?\d)[\/.\-](20\d{2})\b/);
  if(m)return isoDate(m[3],m[2],m[1]);
  m=text.match(/\b([0-3]?\d)(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
  if(m)return isoDate(m[3],MONTHS[m[2].toLowerCase()],m[1]);
  m=text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+([0-3]?\d)(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b/i);
  if(m)return isoDate(m[3],MONTHS[m[1].toLowerCase()],m[2]);
  return null;
}

function cleanSubject(subject){return String(subject||'Gmail item').replace(/^(re|fwd):\s*/i,'').trim().slice(0,240)||'Gmail item';}
function appointmentTitle(subject){
  const s=cleanSubject(subject);
  if(/physiotherap/i.test(s))return'Physiotherapy appointment';
  if(/dent(al|ist)/i.test(s))return'Dental appointment';
  if(/optomet/i.test(s))return'Optometry appointment';
  if(/chiropract/i.test(s))return'Chiropractic appointment';
  const stripped=s.replace(/booking confirmation\s*[-:]?\s*/i,'').replace(/appointment confirmation\s*[-:]?\s*/i,'').trim();
  if(stripped&&stripped!==s)return `${stripped} appointment`.replace(/\s+appointment appointment$/i,' appointment').slice(0,240);
  return /appointment/i.test(s)?s:`${s} appointment`.slice(0,240);
}
function eventTitle(subject){
  const s=cleanSubject(subject);
  let m=s.match(/reservation at\s+([^|–—-]+)/i);
  if(m)return `${m[1].trim()} reservation`.slice(0,240);
  m=s.match(/booking confirmation\s*[-:]\s*(.+)$/i);
  if(m)return `${m[1].trim()} reservation`.slice(0,240);
  m=s.match(/reservation confirmation\s*[-:]\s*(.+)$/i);
  if(m)return `${m[1].trim()} reservation`.slice(0,240);
  return s;
}
function titleFor(envelope,classification){if(classification.category==='appointment')return appointmentTitle(envelope.subject);if(classification.category==='event')return eventTitle(envelope.subject);return cleanSubject(envelope.subject);}

function eventProvider(envelope,title){
  const fromTitle=String(title||'').match(/^(.+?)\s+reservation$/i);if(fromTitle)return fromTitle[1].trim();
  const sender=String(envelope.sender||'').trim();const display=sender.match(/^([^<]+?)\s*</);if(display){const name=display[1].trim();if(name&&!/nowbookit|sevenrooms|resy|opentable/i.test(name))return name;}
  return null;
}
function explicitReference(text){
  const patterns=[
    /\bbooking\s+(?:reference|ref|number|#)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{4,19})\b/i,
    /\bconfirmation(?:\s+(?:reference|ref|number|code|#))?\s*[:#-]\s*([A-Z0-9][A-Z0-9-]{4,19})\b/i,
    /\breservation\s+(?:reference|ref|number|code|#)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{4,19})\b/i
  ];
  for(const pattern of patterns){const match=String(text||'').match(pattern);if(match)return match[1].toUpperCase();}
  return null;
}
function labeledLocation(text){
  const value=String(text||'');
  for(const line of value.split(/\r?\n/)){const match=line.trim().match(/^(?:venue\s+address|location|address)\s*:\s*(.+)$/i);if(match&&match[1].trim())return match[1].trim();}
  const inline=value.match(/(?:venue\s+address|location|address)\s*:\s*(.+?)(?=\s+(?:(?:manage|modify|view)(?:\s+(?:your|the))?\s+(?:booking|reservation)|booking\s+(?:reference|ref|number)|confirmation\s*:|reservation\s+(?:reference|time)|booking\s+time)\b|$)/i);
  return inline&&inline[1]?inline[1].trim():null;
}
function bookingUrl(text){
  const value=String(text||'');
  const preferred=value.match(/(?:manage|modify|view)(?:\s+(?:your|the))?\s+(?:booking|reservation)[^\n]*?(https?:\/\/[^\s<>]+)/i);
  const generic=value.match(/https?:\/\/[^\s<>]+/i);const raw=(preferred||generic);return raw?raw[1]||raw[0].replace(/[),.;]+$/,''):null;
}
function geographyFromLocation(location){
  const value=String(location||'').trim();if(!value)return{label:null,city:null,region:null,country:null};
  let match=value.match(new RegExp(`,\\s*([^,]+?)\\s+(${AU_STATES.join('|')})\\s+\\d{4}(?:,\\s*Australia)?$`,'i'));
  if(match){const city=match[1].trim(),region=match[2].toUpperCase();return{label:`${city}, ${region}`,city,region,country:'Australia'};}
  match=value.match(/,\s*([^,]+),\s*([^,]+?)\s+\d{4},?\s*New Zealand$/i);
  if(match){const city=match[1].trim(),region=match[2].trim();return{label:`${city}, ${region}`,city,region,country:'New Zealand'};}
  if(/\bSydney\b/i.test(value)){return{label:'Sydney, NSW',city:'Sydney',region:'NSW',country:'Australia'};}
  if(/\bQueenstown\b/i.test(value)){return{label:'Queenstown, Otago',city:'Queenstown',region:'Otago',country:'New Zealand'};}
  return{label:value,city:null,region:null,country:/\bNew Zealand\b/i.test(value)?'New Zealand':/\bAustralia\b/i.test(value)?'Australia':null};
}
function timeZoneFor(geography={}){
  if(geography.country==='New Zealand')return'Pacific/Auckland';
  if(geography.region==='WA')return'Australia/Perth';
  if(geography.region==='SA')return'Australia/Adelaide';
  if(geography.region==='NT')return'Australia/Darwin';
  if(geography.country==='Australia')return'Australia/Sydney';
  return'Australia/Sydney';
}
function clockTo24(hour,minute,ampm){let h=Number(hour);if(h<1||h>12)return null;const m=Number(minute);if(m>59)return null;const ap=String(ampm||'').toUpperCase();if(ap==='PM'&&h!==12)h+=12;if(ap==='AM'&&h===12)h=0;return`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;}
function eventTimes(text){
  const value=String(text||'');
  let match=value.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\s*(?:-|–|—|to)\s*(\d{1,2}):(\d{2})\s*(AM|PM)\b/i);
  if(match)return{start:clockTo24(match[1],match[2],match[3]),end:clockTo24(match[4],match[5],match[6])};
  match=value.match(/(?:reservation\s+time|booking\s+time|time|at)\s*:?\s*(\d{1,2}):(\d{2})\s*(AM|PM)\b/i);
  if(match)return{start:clockTo24(match[1],match[2],match[3]),end:null};
  match=value.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/i);
  return match?{start:clockTo24(match[1],match[2],match[3]),end:null}:{start:null,end:null};
}
function eventSchedule(explicitDate,text,zone){
  if(!explicitDate)return{starts_at:null,ends_at:null};const date=explicitDate.slice(0,10),times=eventTimes(text);
  if(!times.start)return{starts_at:explicitDate,ends_at:null};
  return{starts_at:localDateTimeToUtc(`${date}T${times.start}`,zone),ends_at:times.end?localDateTimeToUtc(`${date}T${times.end}`,zone):null};
}

function extractLifeAdminCandidate(envelope={},classification={}){
  const category=classification.category||'other',combined=[envelope.subject,envelope.text].filter(Boolean).join('\n'),explicitDate=parseExplicitDate(combined),scheduled=category==='appointment'||category==='event',autoPayBill=category==='bill'&&ACTIVE_AUTOPAY.test(combined),needsAction=!scheduled&&!autoPayBill,priority=['deadline','government'].includes(category)||(category==='bill'&&needsAction)?'high':'normal';
  const title=titleFor(envelope,classification),isEvent=category==='event',location=isEvent?labeledLocation(envelope.text):null,geography=isEvent?geographyFromLocation(location):{label:null,city:null,region:null,country:null},timeZone=timeZoneFor(geography),schedule=scheduled?eventSchedule(explicitDate,combined,timeZone):{starts_at:null,ends_at:null};
  const notes=[`From Gmail${envelope.sender?` — ${String(envelope.sender).trim()}`:''}.`,envelope.subject?`Subject: ${String(envelope.subject).trim()}`:null].filter(Boolean).join(' ');
  return {
    title,category,status:needsAction?'needs_action':'upcoming',due_at:scheduled?null:explicitDate,starts_at:schedule.starts_at,ends_at:schedule.ends_at,time_zone:timeZone,recurrence_rule:null,priority,notes,linked_person_id:null,linked_trip_id:null,
    location:isEvent?location:null,provider:isEvent?eventProvider(envelope,title):null,confirmation_reference:isEvent?explicitReference(combined):null,booking_url:isEvent?bookingUrl(envelope.text):null,geography
  };
}

module.exports={extractLifeAdminCandidate,parseExplicitDate,titleFor,eventTitle,eventProvider,explicitReference,labeledLocation,geographyFromLocation,eventTimes,eventSchedule};
