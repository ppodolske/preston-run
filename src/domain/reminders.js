const {SYDNEY_TZ,sydneyParts,withinSydneyWindow}=require('./schedule');

const DEFAULT_REMINDER_OFFSETS=Object.freeze({
  birthday:Object.freeze([30,14,7,1]),
  renewal:Object.freeze([60,30,14,7,1]),
  deadline:Object.freeze([14,7,3,0]),
  appointment:Object.freeze([7,1,0]),
  trip:Object.freeze([14,7,1])
});

const SETTING_KEYS={
  birthday:'birthday_offsets',
  renewal:'renewal_offsets',
  deadline:'deadline_offsets',
  appointment:'appointment_offsets',
  trip:'trip_offsets'
};

function normalizeOffsets(value){
  if(!Array.isArray(value)||value.length===0)throw new Error('Reminder offsets are required');
  const out=value.map(Number);
  if(out.some(v=>!Number.isInteger(v)||v<0))throw new Error('Reminder offsets must be non-negative integers');
  if(new Set(out).size!==out.length)throw new Error('Reminder offsets must be unique');
  return [...out].sort((a,b)=>b-a);
}

function validateReminderSettings(input={}){
  const result={...input};
  for(const key of Object.values(SETTING_KEYS)){
    if(Object.prototype.hasOwnProperty.call(input,key))result[key]=normalizeOffsets(input[key]);
  }
  if(input.timezone&&input.timezone!==SYDNEY_TZ){
    try{new Intl.DateTimeFormat('en-AU',{timeZone:input.timezone}).format(new Date());}
    catch{throw new Error('Invalid reminder timezone');}
  }
  return result;
}

function validateReminderOverride(input={}){
  return {...input,enabled:input.enabled!==false,offsets:normalizeOffsets(input.offsets)};
}

function resolveOffsets(reminderClass,settings={},override=null){
  const key=SETTING_KEYS[reminderClass];
  if(!key)throw new Error('Unknown reminder class');
  if(override&&override.enabled===true)return normalizeOffsets(override.offsets);
  if(Array.isArray(settings[key]))return normalizeOffsets(settings[key]);
  return [...DEFAULT_REMINDER_OFFSETS[reminderClass]];
}

function buildOccurrenceKey({entityType,entityId,reminderClass,offsetDays,targetDate}){
  return `${entityType}:${entityId}:${reminderClass}:${offsetDays}:${targetDate}`;
}

function parseDateKey(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))throw new Error('Invalid date');
  const [y,m,d]=String(value).split('-').map(Number);
  return Date.UTC(y,m-1,d);
}

function shouldIncludeOnDate({targetDate,today,offsetDays}){
  if(!Number.isInteger(offsetDays)||offsetDays<0)return false;
  return Math.round((parseDateKey(targetDate)-parseDateKey(today))/86400000)===offsetDays;
}

function isUrgentEntity(entity={}){
  const terminal=new Set(['completed','ignored','cancelled']);
  return entity.priority==='urgent'&&!terminal.has(entity.status);
}

function getSydneyLocalParts(now=new Date()){return sydneyParts(now);}

function shouldRunScheduledMode(mode,now=new Date()){
  const times={morning:[7,15],noon:[12,0],evening:[18,0],night:[21,0]};
  if(!times[mode])throw new Error('Invalid scheduled reminder mode');
  return withinSydneyWindow(now,times[mode][0],times[mode][1],15);
}

module.exports={
  SYDNEY_TZ,
  DEFAULT_REMINDER_OFFSETS,
  validateReminderSettings,
  validateReminderOverride,
  resolveOffsets,
  buildOccurrenceKey,
  shouldIncludeOnDate,
  isUrgentEntity,
  getSydneyLocalParts,
  shouldRunScheduledMode,
  normalizeOffsets
};
