const MONTHS={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12};

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

function cleanSubject(subject){
  return String(subject||'Gmail item').replace(/^(re|fwd):\s*/i,'').trim().slice(0,240)||'Gmail item';
}

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
  m=s.match(/booking confirmation\s*:\s*(.+)$/i);
  if(m)return `${m[1].trim()} reservation`.slice(0,240);
  return s;
}

function titleFor(envelope,classification){
  if(classification.category==='appointment')return appointmentTitle(envelope.subject);
  if(classification.category==='event')return eventTitle(envelope.subject);
  return cleanSubject(envelope.subject);
}

function extractLifeAdminCandidate(envelope={},classification={}){
  const category=classification.category||'other';
  const combined=[envelope.subject,envelope.text].filter(Boolean).join('\n');
  const explicitDate=parseExplicitDate(combined);
  const scheduled=category==='appointment'||category==='event';
  const needsAction=!scheduled;
  const priority=['bill','deadline','government'].includes(category)?'high':'normal';
  const notes=[`From Gmail${envelope.sender?` — ${String(envelope.sender).trim()}`:''}.`,envelope.subject?`Subject: ${String(envelope.subject).trim()}`:null].filter(Boolean).join(' ');
  return {
    title:titleFor(envelope,classification),
    category,
    status:needsAction?'needs_action':'upcoming',
    due_at:needsAction?explicitDate:null,
    starts_at:scheduled?explicitDate:null,
    recurrence_rule:null,
    priority,
    notes,
    linked_person_id:null
  };
}

module.exports={extractLifeAdminCandidate,parseExplicitDate,titleFor};
