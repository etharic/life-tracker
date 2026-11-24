import { addDays, dayOfWeek } from './dates';
import type { DayEntry, ISODate, MonthId } from './types';

// ---------- Feeling by weekday ----------

export const WEEKDAY_WINDOW = 180;
export const WEEKDAY_MIN_DAYS = 8;
export const WEEKDAY_LEAD = 0.5;
export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export interface WeekdayFeeling {
  /** 1 = Monday ... 7 = Sunday */
  weekday: number;
  name: string;
  /** Average feeling, or null when fewer than WEEKDAY_MIN_DAYS days were rated. */
  avg: number | null;
  days: number;
}

/** Average feeling for each weekday over the last 180 days (today included). */
export function weekdayFeelings(days: Record<ISODate, DayEntry | undefined>, today: ISODate): WeekdayFeeling[] {
  const sum = Array<number>(8).fill(0);
  const n = Array<number>(8).fill(0);
  for (let i = 0; i < WEEKDAY_WINDOW; i++) {
    const date = addDays(today, -i);
    const f = days[date]?.feeling;
    if (f == null) continue;
    const w = dayOfWeek(date);
    sum[w] += f;
    n[w] += 1;
  }
  return WEEKDAY_NAMES.map((name, i) => {
    const w = i + 1;
    return { weekday: w, name, days: n[w], avg: n[w] >= WEEKDAY_MIN_DAYS ? sum[w] / n[w] : null };
  });
}

/** "Saturdays tend to feel best", when one weekday leads the next best by at least 0.5. */
export function bestWeekdaySentence(rows: WeekdayFeeling[]): string | null {
  const shown = rows.filter((r) => r.avg != null).sort((a, b) => b.avg! - a.avg!);
  if (shown.length < 2) return null;
  if (shown[0].avg! - shown[1].avg! < WEEKDAY_LEAD) return null;
  return `${shown[0].name}s tend to feel best.`;
}

// ---------- Writing ----------

/** Words in a day's writing (split on whitespace). Titles are not counted. */
export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export interface WritingStats {
  /** Words per month of the given year, January first (12 entries). */
  months: { month: MonthId; words: number }[];
  /** Words per year, oldest first. */
  years: { year: string; words: number }[];
  /** The day with the most words of writing. */
  longest: { date: ISODate; words: number } | null;
  total: number;
}

export function writingStats(days: Record<ISODate, DayEntry | undefined>, year: string): WritingStats {
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, '0')}` as MonthId,
    words: 0,
  }));
  const byYear = new Map<string, number>();
  let longest: WritingStats['longest'] = null;
  let total = 0;
  for (const d of Object.values(days)) {
    if (!d) continue;
    const w = wordCount(d.writing);
    if (!w) continue;
    total += w;
    const y = d.date.slice(0, 4);
    byYear.set(y, (byYear.get(y) ?? 0) + w);
    if (y === year) months[Number(d.date.slice(5, 7)) - 1].words += w;
    if (!longest || w > longest.words || (w === longest.words && d.date > longest.date)) {
      longest = { date: d.date, words: w };
    }
  }
  const years = [...byYear.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([y, words]) => ({ year: y, words }));
  return { months, years, longest, total };
}

/** Words written in one year (the yearly book's line). */
export function wordsInYear(days: Iterable<DayEntry>, year: string): number {
  let n = 0;
  for (const d of days) if (d.date.startsWith(year)) n += wordCount(d.writing);
  return n;
}
