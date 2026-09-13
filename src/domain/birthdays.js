function asInteger(value, label) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  if (!Number.isInteger(number)) throw new Error(`${label} must be a whole number`);
  return number;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function validateBirthdayParts({ month, day, year }) {
  const m = asInteger(month, 'Birthday month');
  const d = asInteger(day, 'Birthday day');
  const y = asInteger(year, 'Birth year');
  if (m == null && d == null) return { birthday_month:null, birthday_day:null, birth_year:y };
  if (m == null || d == null) throw new Error('Birthday month and day must both be provided');
  if (m < 1 || m > 12) throw new Error('Birthday month must be between 1 and 12');
  const validationYear = y == null ? 2000 : y;
  if (y != null && (y < 1900 || y > 2200)) throw new Error('Birth year must be between 1900 and 2200');
  if (d < 1 || d > daysInMonth(validationYear, m)) throw new Error('Birthday day is not valid for that month');
  return { birthday_month:m, birthday_day:d, birth_year:y };
}

function observedDate(year, month, day) {
  if (month === 2 && day === 29 && daysInMonth(year, 2) === 28) return new Date(Date.UTC(year, 1, 28));
  return new Date(Date.UTC(year, month - 1, day));
}

function normalizeToday(today) {
  const value = today instanceof Date ? today : new Date(today);
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function getNextBirthday(person, today = new Date()) {
  const month = Number(person.birthday_month);
  const day = Number(person.birthday_day);
  if (!month || !day) return null;
  const current = normalizeToday(today);
  let year = current.getUTCFullYear();
  let date = observedDate(year, month, day);
  if (date < current) {
    year += 1;
    date = observedDate(year, month, day);
  }
  const daysAway = Math.round((date - current) / 86400000);
  const birthYear = person.birth_year == null ? null : Number(person.birth_year);
  return { date, daysAway, ageTurning:birthYear == null ? null : year - birthYear };
}

function getUpcomingBirthdays(people, today = new Date(), days = 90) {
  return (people || []).filter(person => person.active !== false).map(person => {
    const next = getNextBirthday(person, today);
    return next ? { person, ...next } : null;
  }).filter(Boolean).filter(item => item.daysAway <= days).sort((a, b) => a.daysAway - b.daysAway || String(a.person.name).localeCompare(String(b.person.name)));
}

function todayInTimeZone(timeZone = 'Australia/Sydney', now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
}

module.exports = { validateBirthdayParts, getNextBirthday, getUpcomingBirthdays, todayInTimeZone };
