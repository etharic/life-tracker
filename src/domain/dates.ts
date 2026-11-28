import type { ISODate, MonthId, WeekId } from './types';

/**
 * Calendar maths on local date strings. Everything works on Y/M/D values through UTC
 * so daylight saving time can never shift a date.
 */

const MS_DAY = 86_400_000;

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

export function toISO(y: number, m: number, d: number): ISODate {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

export function parseISO(date: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d };
}

function toUTC(date: ISODate): number {
  const { y, m, d } = parseISO(date);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): ISODate {
  const t = new Date(ms);
  return toISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function isISODate(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return fromUTC(toUTC(s)) === s;
}

export function addDays(date: ISODate, n: number): ISODate {
  return fromUTC(toUTC(date) + n * MS_DAY);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / MS_DAY);
}

/** 1 = Monday ... 7 = Sunday. */
export function dayOfWeek(date: ISODate): number {
  const js = new Date(toUTC(date)).getUTCDay();
  return js === 0 ? 7 : js;
}

/**
 * The journal date for a moment in local time. A new day starts at `dayStartHour`
 * (04:00 by default): 01:30 on the 20th still belongs to the 19th.
 */
export function logicalDate(now: Date, dayStartHour: number): ISODate {
  const today = toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return now.getHours() < dayStartHour ? addDays(today, -1) : today;
}

/** The next moment the journal date changes, in local time. */
export function nextDayBoundary(now: Date, dayStartHour: number): Date {
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate(), dayStartHour, 0, 0, 0);
  if (b.getTime() <= now.getTime()) b.setDate(b.getDate() + 1);
  return b;
}

export function monthOf(date: ISODate): MonthId {
  return date.slice(0, 7);
}

export function yearOf(date: ISODate | MonthId): string {
  return date.slice(0, 4);
}

export function daysInMonth(month: MonthId): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function firstOfMonth(month: MonthId): ISODate {
  return `${month}-01`;
}

export function lastOfMonth(month: MonthId): ISODate {
  return `${month}-${pad(daysInMonth(month))}`;
}

export function monthDates(month: MonthId): ISODate[] {
  const n = daysInMonth(month);
  const out: ISODate[] = [];
  for (let d = 1; d <= n; d++) out.push(`${month}-${pad(d)}`);
  return out;
}

export function addMonths(month: MonthId, n: number): MonthId {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${pad(Math.floor(idx / 12), 4)}-${pad((idx % 12) + 1)}`;
}

/** ISO 8601 week id of a date: weeks run Monday to Sunday. */
export function weekOf(date: ISODate): WeekId {
  const thursday = addDays(date, 4 - dayOfWeek(date));
  const y = parseISO(thursday).y;
  const week = Math.floor(daysBetween(toISO(y, 1, 1), thursday) / 7) + 1;
  return `${y}-W${pad(week)}`;
}

export function weekMonday(week: WeekId): ISODate {
  const [ys, ws] = week.split('-W');
  const y = Number(ys);
  const jan4 = toISO(y, 1, 4);
  const week1Monday = addDays(jan4, 1 - dayOfWeek(jan4));
  return addDays(week1Monday, (Number(ws) - 1) * 7);
}

export function weekSunday(week: WeekId): ISODate {
  return addDays(weekMonday(week), 6);
}

export function weekDates(week: WeekId): ISODate[] {
  const mon = weekMonday(week);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

export function addWeeks(week: WeekId, n: number): WeekId {
  return weekOf(addDays(weekMonday(week), n * 7));
}

/** A week belongs to the month in which it ends (its Sunday). */
export function monthOfWeek(week: WeekId): MonthId {
  return monthOf(weekSunday(week));
}

/** The 4 or 5 weeks whose Sunday falls in the month, in order. */
export function weeksOfMonth(month: MonthId): WeekId[] {
  const out: WeekId[] = [];
  let sunday = addDays(firstOfMonth(month), 7 - dayOfWeek(firstOfMonth(month)));
  while (monthOf(sunday) === month) {
    out.push(weekOf(sunday));
    sunday = addDays(sunday, 7);
  }
  return out;
}

/** 1-based position of a week inside its month (W1..W5). */
export function weekIndexInMonth(week: WeekId): number {
  return weeksOfMonth(monthOfWeek(week)).indexOf(week) + 1;
}

// ---------- Formatting (English, as the UI) ----------

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function weekdayName(date: ISODate): string {
  return WEEKDAYS[dayOfWeek(date) - 1];
}
export function weekdayShort(date: ISODate): string {
  return weekdayName(date).slice(0, 3);
}
export function monthName(month: MonthId): string {
  return MONTHS[Number(month.slice(5, 7)) - 1];
}
export function monthShort(month: MonthId): string {
  return monthName(month).slice(0, 3);
}
export function dayNumber(date: ISODate): number {
  return parseISO(date).d;
}
/** "Thursday 19 November" */
export function formatLong(date: ISODate): string {
  return `${weekdayName(date)} ${dayNumber(date)} ${monthName(monthOf(date))}`;
}
/** "Thursday 19 Nov": the date as a screen title. */
export function formatTitle(date: ISODate): string {
  return `${weekdayName(date)} ${dayNumber(date)} ${monthShort(monthOf(date))}`;
}
/** "19 Nov" */
export function formatShort(date: ISODate): string {
  return `${dayNumber(date)} ${monthShort(monthOf(date))}`;
}
/** "19 November 2026" */
export function formatFull(date: ISODate): string {
  return `${dayNumber(date)} ${monthName(monthOf(date))} ${yearOf(date)}`;
}
/** "November 2026" */
export function formatMonth(month: MonthId): string {
  return `${monthName(month)} ${yearOf(month)}`;
}
/** "16 to 22 Nov" */
export function formatWeekRange(week: WeekId): string {
  const mon = weekMonday(week);
  const sun = weekSunday(week);
  if (monthOf(mon) === monthOf(sun)) return `${dayNumber(mon)} to ${formatShort(sun)}`;
  return `${formatShort(mon)} to ${formatShort(sun)}`;
}
