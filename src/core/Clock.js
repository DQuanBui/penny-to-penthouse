// Calendar maths (pure functions on "total minutes since the start of Day 1").
// 1 year = 4 seasons × 28 days; weeks are Mon..Sun; Day 1 is a Monday in Spring.

export const MIN_PER_DAY = 1440;
export const DAYS_PER_SEASON = 28;
export const DAYS_PER_YEAR = 112;
export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];
export const SEASON_IDS = ['spring', 'summer', 'fall', 'winter'];
export const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DOW_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const dayOf = (total) => Math.floor(total / MIN_PER_DAY); // 0-based absolute day
export const hourOf = (total) => (total % MIN_PER_DAY) / 60; // 0..24 float
export const minuteOfDay = (total) => total % MIN_PER_DAY;

export function calendar(total) {
  const day = dayOf(total);
  const doy = day % DAYS_PER_YEAR;
  const season = Math.floor(doy / DAYS_PER_SEASON);
  const mins = Math.floor(total % MIN_PER_DAY);
  return {
    day, // absolute, 0-based
    dow: day % 7, // 0 = Monday
    weekend: day % 7 >= 5,
    year: Math.floor(day / DAYS_PER_YEAR) + 1,
    season,
    seasonName: SEASONS[season],
    seasonId: SEASON_IDS[season],
    dayOfSeason: (doy % DAYS_PER_SEASON) + 1, // 1..28 (the "date" of the month)
    month: Math.floor(day / DAYS_PER_SEASON), // absolute month index
    hour: Math.floor(mins / 60),
    minute: mins % 60,
  };
}

export function fmtClock(total) {
  const m = Math.floor(total % MIN_PER_DAY);
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  return `${((h + 11) % 12) + 1}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
}

export function fmtHour(h) {
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60);
  return `${((hh + 11) % 12) + 1}${mm ? ':' + String(mm).padStart(2, '0') : ''} ${hh < 12 ? 'AM' : 'PM'}`;
}

export function fmtDate(total, long = false) {
  const c = calendar(total);
  return long ? `${DOW_LONG[c.dow]}, ${c.seasonName} ${c.dayOfSeason}, Year ${c.year}` : `${DOW[c.dow]} · ${c.seasonName} ${c.dayOfSeason} · Y${c.year}`;
}

/** Short date for an absolute day index. */
export function fmtDay(day) {
  return fmtDate(day * MIN_PER_DAY).replace(/ · Y\d+$/, '');
}
