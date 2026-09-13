const TRIP_STATUSES = ['planning','upcoming','in_progress','completed','cancelled'];
const SEGMENT_TYPES = ['travel','stay','activity','other'];
const BOOKING_TYPES = ['flight','accommodation','hire_car','activity','other'];
const BOOKING_STATUSES = ['confirmed','tentative','changed','cancelled'];

function requiredText(value, label, max = 240) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} is required`);
  if (text.length > max) throw new Error(`${label} must be ${max} characters or fewer`);
  return text;
}
function optionalText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}
function oneOf(value, allowed, label, fallback) {
  const normalized = String(value || fallback || '').trim();
  if (!allowed.includes(normalized)) throw new Error(`${label} is invalid`);
  return normalized;
}
function positiveInteger(value, label = 'Position', fallback = 1) {
  const raw = String(value ?? '').trim();
  const number = raw ? Number(raw) : fallback;
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${label} must be a positive integer`);
  return number;
}
function parseDateOnly(value, label) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) throw new Error(`${label} must use YYYY-MM-DD`);
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error(`${label} is invalid`);
  return text;
}

function isValidTimeZone(zone) {
  try {
    new Intl.DateTimeFormat('en-AU', { timeZone: String(zone) }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function localParts(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  if (!match) throw new Error('Local date/time must use YYYY-MM-DDTHH:mm');
  const parts = {
    year:Number(match[1]), month:Number(match[2]), day:Number(match[3]),
    hour:Number(match[4]), minute:Number(match[5]), second:Number(match[6] || 0)
  };
  const probe = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
  if (probe.getUTCFullYear() !== parts.year || probe.getUTCMonth() !== parts.month - 1 || probe.getUTCDate() !== parts.day || parts.hour > 23 || parts.minute > 59 || parts.second > 59) throw new Error('Local date/time is invalid');
  return parts;
}

function partsInZone(date, zone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit',
    hourCycle:'h23'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type,p.value]));
  return {
    year:Number(map.year), month:Number(map.month), day:Number(map.day),
    hour:Number(map.hour), minute:Number(map.minute), second:Number(map.second)
  };
}

function sameParts(a,b) {
  return a.year===b.year && a.month===b.month && a.day===b.day && a.hour===b.hour && a.minute===b.minute && a.second===b.second;
}

function localDateTimeToUtc(value, zone) {
  const target = localParts(value);
  if (!target) return null;
  if (!isValidTimeZone(zone)) throw new Error('Time zone is invalid');
  const targetMs = Date.UTC(target.year,target.month-1,target.day,target.hour,target.minute,target.second);
  let guess = targetMs;
  for (let i=0;i<4;i++) {
    const observed = partsInZone(new Date(guess), zone);
    const observedMs = Date.UTC(observed.year,observed.month-1,observed.day,observed.hour,observed.minute,observed.second);
    const delta = targetMs - observedMs;
    guess += delta;
    if (delta === 0) break;
  }
  const roundTrip = partsInZone(new Date(guess), zone);
  if (!sameParts(roundTrip,target)) throw new Error('Local time does not exist in the selected time zone');
  return new Date(guess).toISOString();
}

function utcToLocalDateTime(value, zone) {
  if (!value) return '';
  if (!isValidTimeZone(zone)) throw new Error('Time zone is invalid');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Timestamp is invalid');
  const p = partsInZone(date, zone);
  const pad = n => String(n).padStart(2,'0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

function validateTripInput(input = {}) {
  const start = parseDateOnly(input.start_date,'Start date');
  const end = parseDateOnly(input.end_date,'End date');
  if (start && end && end < start) throw new Error('End date cannot be before start date');
  return {
    title:requiredText(input.title,'Title'),
    status:oneOf(input.status,TRIP_STATUSES,'Status','planning'),
    start_date:start,
    end_date:end,
    notes:optionalText(input.notes)
  };
}

function validateSegmentInput(input = {}) {
  const zone = String(input.time_zone || 'Australia/Sydney').trim();
  if (!isValidTimeZone(zone)) throw new Error('Time zone is invalid');
  const starts = localDateTimeToUtc(input.starts_at,zone);
  const ends = localDateTimeToUtc(input.ends_at,zone);
  if (starts && ends && new Date(ends) < new Date(starts)) throw new Error('End time cannot be before start time');
  return {
    position:positiveInteger(input.position),
    segment_type:oneOf(input.segment_type,SEGMENT_TYPES,'Segment type','travel'),
    title:requiredText(input.title,'Title'),
    origin:optionalText(input.origin),
    destination:optionalText(input.destination),
    starts_at:starts,
    ends_at:ends,
    time_zone:zone,
    notes:optionalText(input.notes)
  };
}

function validateBookingInput(input = {}) {
  const zone = String(input.time_zone || 'Australia/Sydney').trim();
  if (!isValidTimeZone(zone)) throw new Error('Time zone is invalid');
  const starts = localDateTimeToUtc(input.starts_at,zone);
  const ends = localDateTimeToUtc(input.ends_at,zone);
  if (starts && ends && new Date(ends) < new Date(starts)) throw new Error('End time cannot be before start time');
  return {
    segment_id:optionalText(input.segment_id),
    position:positiveInteger(input.position),
    booking_type:oneOf(input.booking_type,BOOKING_TYPES,'Booking type'),
    title:requiredText(input.title,'Title'),
    provider:optionalText(input.provider),
    confirmation_reference:optionalText(input.confirmation_reference),
    status:oneOf(input.status,BOOKING_STATUSES,'Status','confirmed'),
    starts_at:starts,
    ends_at:ends,
    time_zone:zone,
    location:optionalText(input.location),
    booking_url:optionalText(input.booking_url),
    notes:optionalText(input.notes)
  };
}

function buildItinerary({ segments = [], bookings = [] } = {}) {
  const linkedSegmentIds = new Set(bookings.map(b => b.segment_id).filter(Boolean));
  const entries = bookings.map(record => ({type:'booking',record}));
  for (const record of segments) if (!linkedSegmentIds.has(record.id)) entries.push({type:'segment',record});
  return entries.sort((a,b) => {
    const ad = a.record.starts_at ? new Date(a.record.starts_at).getTime() : Infinity;
    const bd = b.record.starts_at ? new Date(b.record.starts_at).getTime() : Infinity;
    if (ad !== bd) return ad - bd;
    const ap = Number(a.record.position || 1), bp = Number(b.record.position || 1);
    if (ap !== bp) return ap - bp;
    return String(a.record.title || '').localeCompare(String(b.record.title || ''));
  });
}

function dateKeyInTimeZone(value, zone='Australia/Sydney') {
  const p = partsInZone(new Date(value),zone);
  const pad = n => String(n).padStart(2,'0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}
function dateKeyMs(key) { const [y,m,d]=key.split('-').map(Number); return Date.UTC(y,m-1,d); }

function getUpcomingTrips(trips = [], today = new Date(), days = 180) {
  const todayKey = dateKeyInTimeZone(today);
  const startMs = dateKeyMs(todayKey);
  const endMs = startMs + Number(days) * 86400000;
  return trips.filter(trip => !['completed','cancelled'].includes(trip.status)).filter(trip => {
    if (!trip.start_date) return false;
    const tripStart = dateKeyMs(trip.start_date);
    const tripEnd = trip.end_date ? dateKeyMs(trip.end_date) : tripStart;
    return tripEnd >= startMs && tripStart <= endMs;
  }).sort((a,b) => dateKeyMs(a.start_date) - dateKeyMs(b.start_date) || String(a.title).localeCompare(String(b.title)));
}

module.exports = {
  TRIP_STATUSES, SEGMENT_TYPES, BOOKING_TYPES, BOOKING_STATUSES,
  validateTripInput, validateSegmentInput, validateBookingInput,
  isValidTimeZone, localDateTimeToUtc, utcToLocalDateTime,
  buildItinerary, getUpcomingTrips
};
