import { addDays } from './dates';
import { feeling } from './feelings';
import { CATEGORY_LABEL, GOAL_CATEGORIES, HOBBY_CATEGORIES, type DayEntry, type ISODate } from './types';

// ---------- On this day ----------

/**
 * Earlier years' entries on today's journal date (the same month and day). 29 February exists
 * only in leap years, so it matches only them; nothing is moved to 28 February.
 */
export function onThisDay(days: Record<ISODate, DayEntry | undefined>, today: ISODate): DayEntry[] {
  const md = today.slice(4);
  const year = Number(today.slice(0, 4));
  const out: DayEntry[] = [];
  for (let y = year - 1; y >= year - 100; y--) {
    const d = days[`${y}${md}`];
    if (d && (d.title.trim() || d.writing.trim() || d.feeling != null || d.media.length)) out.push(d);
  }
  return out;
}

// ---------- Good-day patterns ----------

export const PATTERN_WINDOW = 90;
export const PATTERN_MIN_DAYS = 30;
export const PATTERN_MIN_SIDE = 10;
export const PATTERN_MIN_DIFF = 1;

export interface Signal {
  id: string;
  /** "Days you did Physical" */
  label: string;
  has: (d: DayEntry) => boolean;
}

export const SIGNALS: Signal[] = [
  ...GOAL_CATEGORIES.map((c) => ({
    id: `goal-${c}`,
    label: `Days you kept your ${CATEGORY_LABEL[c]} goal`,
    has: (d: DayEntry) => d.goals[c],
  })),
  ...HOBBY_CATEGORIES.map((c) => ({
    id: `hobby-${c}`,
    label: `Days you did your ${CATEGORY_LABEL[c]} hobby`,
    has: (d: DayEntry) => d.hobbies[c],
  })),
  { id: 'priority', label: 'Days you did a priority', has: (d) => d.prioritiesDone.length > 0 },
  { id: 'wrote', label: 'Days you wrote something', has: (d) => d.writing.trim().length > 0 },
  { id: 'media', label: 'Days with a photo, voice note or video', has: (d) => d.media.length > 0 },
];

export interface Pattern {
  signal: string;
  /** The full sentence, as shown and read by VoiceOver. */
  sentence: string;
  better: boolean;
  withAvg: number;
  withoutAvg: number;
  withDays: number;
  withoutDays: number;
}

/** The days with a feeling in the window ending today, newest first. */
export function patternDays(days: Record<ISODate, DayEntry | undefined>, today: ISODate): DayEntry[] {
  const out: DayEntry[] = [];
  const from = addDays(today, -(PATTERN_WINDOW - 1));
  for (const d of Object.values(days)) if (d && d.feeling != null && d.date >= from && d.date <= today) out.push(d);
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

const avg = (xs: DayEntry[]) => xs.reduce((k, d) => k + (d.feeling ?? 0), 0) / xs.length;
const named = (x: number) => feeling(Math.round(x))?.name ?? '';

/**
 * Which of your own habits come with your better (or lower) days. Over the last 90 days with a
 * feeling: at least 30 such days, at least 10 on each side, and a difference of at least one
 * point. At most two lines, the largest differences first. A pattern, never a cause.
 */
export function goodDayPatterns(days: Record<ISODate, DayEntry | undefined>, today: ISODate): Pattern[] {
  const window = patternDays(days, today);
  if (window.length < PATTERN_MIN_DAYS) return [];
  const out: Pattern[] = [];
  for (const s of SIGNALS) {
    const yes = window.filter(s.has);
    const no = window.filter((d) => !s.has(d));
    if (yes.length < PATTERN_MIN_SIDE || no.length < PATTERN_MIN_SIDE) continue;
    const a = avg(yes);
    const b = avg(no);
    if (Math.abs(a - b) < PATTERN_MIN_DIFF - 1e-9) continue;
    const better = a > b;
    out.push({
      signal: s.id,
      sentence: `${s.label} felt ${better ? 'better' : 'lower'}: ${named(a)} on average, against ${named(b)}.`,
      better,
      withAvg: a,
      withoutAvg: b,
      withDays: yes.length,
      withoutDays: no.length,
    });
  }
  return out.sort((x, y) => Math.abs(y.withAvg - y.withoutAvg) - Math.abs(x.withAvg - x.withoutAvg)).slice(0, 2);
}
