const {isValidTimeZone,localDateTimeToUtc,utcToLocalDateTime}=require('./date-time');

const TRIP_STATUSES = ['planning','upcoming','in_progress','completed','cancelled'];
const SEGMENT_TYPES = ['travel','stay','activity','other'];
const BOOKING_TYPES = ['flight','accommodation','hire_car','transport','activity','other'];
const BOOKING_STATUSES = ['confirmed','tentative','changed','cancelled'];
const BOOKING_LEG_FIELDS=['service_number','origin','destination','departs_at','arrives_at','departure_time_zone','arrival_time_zone'];

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

function validateTripInput(input = {}) {
  const start = parseDateOnly(input.start_date,'Start date');
  const end = parseDateOnly(input.end_date,'End date');
  if (start && end && end < start) throw new Error('End date cannot be before start date');
  return {
    title:requiredText(input.title,'Title'),
    status:oneOf(input.status,TRIP_STATUSES,'Status','planning'),
    start_date:start,
    end_date:end,
    destination_label:optionalText(input.destination_label),
    destination_city:optionalText(input.destination_city),
    destination_region:optionalText(input.destination_region),
    destination_country:optionalText(input.destination_country),
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
  const tripId=optionalText(input.trip_id);
  return {
    trip_id:tripId,
    segment_id:tripId?optionalText(input.segment_id):null,
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
    origin:optionalText(input.origin),
    destination:optionalText(input.destination),
    booking_url:optionalText(input.booking_url),
    notes:optionalText(input.notes)
  };
}

function validateBookingLegInput(input={}){
  const departureZone=String(input.departure_time_zone||'Australia/Sydney').trim();
  const arrivalZone=String(input.arrival_time_zone||departureZone).trim();
  if(!isValidTimeZone(departureZone)||!isValidTimeZone(arrivalZone))throw new Error('Time zone is invalid');
  const departs=localDateTimeToUtc(input.departs_at,departureZone);
  const arrives=localDateTimeToUtc(input.arrives_at,arrivalZone);
  if(departs&&arrives&&new Date(arrives)<new Date(departs))throw new Error('Arrival time cannot be before departure time');
  return {
    position:positiveInteger(input.position),
    service_number:optionalText(input.service_number),
    origin:optionalText(input.origin),
    destination:optionalText(input.destination),
    departs_at:departs,
    arrives_at:arrives,
    departure_time_zone:departureZone,
    arrival_time_zone:arrivalZone
  };
}

function buildItinerary({ segments = [], bookings = [], events = [] } = {}) {
  const linkedSegmentIds = new Set(bookings.map(b => b.segment_id).filter(Boolean));
  const entries = bookings.map(record => ({type:'booking',record}));
  for (const record of events) entries.push({type:'event',record});
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
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
  const map=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
function dateKeyMs(key) { const [y,m,d]=key.split('-').map(Number); return Date.UTC(y,m-1,d); }

function getUpcomingTrips(trips = [], today = new Date(), days = 180) {
  const todayKey = dateKeyInTimeZone(today);
  const startMs = dateKeyMs(todayKey);
  const endMs = startMs + Number(days) * 86400000;
  return trips.filter(trip=>!trip.archived_at).filter(trip => !['completed','cancelled'].includes(trip.status)).filter(trip => {
    if (!trip.start_date) return false;
    const tripStart = dateKeyMs(trip.start_date);
    const tripEnd = trip.end_date ? dateKeyMs(trip.end_date) : tripStart;
    return tripEnd >= startMs && tripStart <= endMs;
  }).sort((a,b) => dateKeyMs(a.start_date) - dateKeyMs(b.start_date) || String(a.title).localeCompare(String(b.title)));
}

module.exports = {
  TRIP_STATUSES, SEGMENT_TYPES, BOOKING_TYPES, BOOKING_STATUSES, BOOKING_LEG_FIELDS,
  validateTripInput, validateSegmentInput, validateBookingInput, validateBookingLegInput,
  isValidTimeZone, localDateTimeToUtc, utcToLocalDateTime,
  buildItinerary, getUpcomingTrips
};
