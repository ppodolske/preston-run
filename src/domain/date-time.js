function isValidTimeZone(zone) {
  try {
    new Intl.DateTimeFormat('en-AU', { timeZone: String(zone) }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function localParts(value) {
  const text=String(value ?? '').trim();
  if(!text)return null;
  const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  if(!match)throw new Error('Local date/time must use YYYY-MM-DDTHH:mm');
  const parts={year:Number(match[1]),month:Number(match[2]),day:Number(match[3]),hour:Number(match[4]),minute:Number(match[5]),second:Number(match[6]||0)};
  const probe=new Date(Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute,parts.second));
  if(probe.getUTCFullYear()!==parts.year||probe.getUTCMonth()!==parts.month-1||probe.getUTCDate()!==parts.day||parts.hour>23||parts.minute>59||parts.second>59)throw new Error('Local date/time is invalid');
  return parts;
}

function partsInZone(date,zone){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const map=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return{year:Number(map.year),month:Number(map.month),day:Number(map.day),hour:Number(map.hour),minute:Number(map.minute),second:Number(map.second)};
}

function sameParts(a,b){return a.year===b.year&&a.month===b.month&&a.day===b.day&&a.hour===b.hour&&a.minute===b.minute&&a.second===b.second;}

function localDateTimeToUtc(value,zone){
  const target=localParts(value);
  if(!target)return null;
  if(!isValidTimeZone(zone))throw new Error('Time zone is invalid');
  const targetMs=Date.UTC(target.year,target.month-1,target.day,target.hour,target.minute,target.second);
  let guess=targetMs;
  for(let i=0;i<4;i++){
    const observed=partsInZone(new Date(guess),zone);
    const observedMs=Date.UTC(observed.year,observed.month-1,observed.day,observed.hour,observed.minute,observed.second);
    const delta=targetMs-observedMs;
    guess+=delta;
    if(delta===0)break;
  }
  const roundTrip=partsInZone(new Date(guess),zone);
  if(!sameParts(roundTrip,target))throw new Error('Local time does not exist in the selected time zone');
  return new Date(guess).toISOString();
}

function utcToLocalDateTime(value,zone){
  if(!value)return'';
  if(!isValidTimeZone(zone))throw new Error('Time zone is invalid');
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))throw new Error('Timestamp is invalid');
  const p=partsInZone(date,zone);
  const pad=n=>String(n).padStart(2,'0');
  return`${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

module.exports={isValidTimeZone,localDateTimeToUtc,utcToLocalDateTime};
