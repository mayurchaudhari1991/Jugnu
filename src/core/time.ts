/** Local-date helpers. Dates travel as 'YYYY-MM-DD' strings; times as minutes after midnight. */

export function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(now = Date.now()): string {
  return dateKey(new Date(now));
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Local midnight of the given date, epoch ms. */
export function dayStart(key: string): number {
  return parseDateKey(key).getTime();
}

export function addDays(key: string, n: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** Epoch ms for `min` minutes after local midnight of `key` (DST-safe: builds the wall-clock time). */
export function atMinute(key: string, min: number): number {
  const d = parseDateKey(key);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(min);
  return d.getTime();
}

export function minutesOf(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

export function fmtTime(ms: number): { time: string; ap: string } {
  const d = new Date(ms);
  return fmtMin(d.getHours() * 60 + d.getMinutes());
}

export function fmtMin(min: number): { time: string; ap: string } {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return { time: `${h % 12 || 12}:${pad(m % 60)}`, ap: h < 12 ? 'AM' : 'PM' };
}

export function fmtTimeFull(ms: number): string {
  const t = fmtTime(ms);
  return `${t.time} ${t.ap}`;
}

export function fmtMinFull(min: number): string {
  const t = fmtMin(min);
  return `${t.time} ${t.ap}`;
}

/** "in 8 min", "in 2 h 5 min", "now", "12 min late". */
export function relative(ms: number, now = Date.now()): string {
  const diff = Math.round((ms - now) / 60000);
  const dur = (d: number) => (d >= 60 ? `${Math.floor(d / 60)} h${d % 60 ? ` ${d % 60} min` : ''}` : `${d} min`);
  if (diff > 0) return `in ${dur(diff)}`;
  if (diff === 0) return 'now';
  return `${dur(-diff)} late`;
}

export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function fmtDateLong(key: string): string {
  const d = parseDateKey(key);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `${days[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtDateShort(key: string): string {
  const d = parseDateKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

export function uid(prefix = ''): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
