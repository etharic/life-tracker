import { addDays, daysInMonth, firstOfMonth, lastOfMonth, monthDates, weekDates } from './dates';
import type { Category, DayEntry, HobbyCategory, ISODate, MonthId, WeekId, WeekRecord } from './types';
import { CHECK_KEYS, GOAL_CATEGORIES, HOBBY_CATEGORIES, hobbyHours, isGoalCategory } from './types';

export type DayLookup = (date: ISODate) => DayEntry | undefined;

/** Days of the month that have passed, including today. 0 before the month, all days after it. */
export function daysPassed(month: MonthId, today: ISODate): number {
  if (today < firstOfMonth(month)) return 0;
  if (today > lastOfMonth(month)) return daysInMonth(month);
  return Number(today.slice(8, 10));
}

export function isTicked(day: DayEntry | undefined, category: Category): boolean {
  if (!day) return false;
  return isGoalCategory(category) ? day.goals[category] : day.hobbies[category];
}

/**
 * Percentage rule: days ticked / days passed so far (not / days in month).
 * At month end this equals days ticked / days in month.
 */
export function percentOf(ticked: number, passed: number): number {
  if (passed <= 0) return 0;
  return Math.round((ticked / passed) * 100);
}

export type StripCell = 'done' | 'missed' | 'future';

export interface RingStat {
  category: Category;
  ticked: number;
  passed: number;
  total: number;
  percent: number;
  /** Hobbies only: hours spent this month so far (a tick is an hour unless more was recorded). */
  hours?: number;
  /** One cell per day of the month. */
  strip: { date: ISODate; state: StripCell }[];
}

export function ringStat(month: MonthId, category: Category, today: ISODate, day: DayLookup): RingStat {
  let ticked = 0;
  let hours = 0;
  const strip = monthDates(month).map((date) => {
    if (date > today) return { date, state: 'future' as const };
    const done = isTicked(day(date), category);
    if (done) ticked++;
    if (!isGoalCategory(category)) hours += hobbyHours(day(date), category);
    return { date, state: done ? ('done' as const) : ('missed' as const) };
  });
  const passed = daysPassed(month, today);
  return {
    category,
    ticked,
    passed,
    total: daysInMonth(month),
    percent: percentOf(ticked, passed),
    ...(isGoalCategory(category) ? {} : { hours }),
    strip,
  };
}

/**
 * A day is active if anything is filled: title, feeling, any tick, writing, photo or audio.
 * A title alone is enough. Opening the app is not.
 */
export function isActive(day: DayEntry | undefined): boolean {
  if (!day) return false;
  return (
    day.title.trim() !== '' ||
    day.feeling != null ||
    Object.values(day.goals).some(Boolean) ||
    Object.values(day.hobbies).some(Boolean) ||
    day.prioritiesDone.length > 0 ||
    day.writing.trim() !== '' ||
    day.media.length > 0
  );
}

/**
 * Consecutive days for which `test` holds, ending today. If today is not filled in yet,
 * the run ending yesterday still counts (the day is not over).
 */
export function runEndingToday(today: ISODate, test: (date: ISODate) => boolean): number {
  let d = test(today) ? today : addDays(today, -1);
  let n = 0;
  while (test(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function currentStreak(today: ISODate, day: DayLookup): number {
  return runEndingToday(today, (d) => isActive(day(d)));
}

/** Longest run of active days ever, from any set of dates. */
export function longestStreak(dates: Iterable<ISODate>, day: DayLookup): number {
  const active = [...dates].filter((d) => isActive(day(d))).sort();
  let best = 0;
  let run = 0;
  let prev: ISODate | null = null;
  for (const d of active) {
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/**
 * A week's score, 0 to 100: the average of four equal parts, each capped at full marks.
 *   Goals        all four daily goals (the priority habit among them), averaged over the days so far
 *   Hobbies      the skill hobby plus one other hobby each day, averaged over the days so far
 *   Priorities   the week's priorities done (left out while none are set)
 *   Commitments  the three other commitments of the week
 * Doing more than this still scores 100. Null before the week starts.
 */
export function weekScore(
  week: WeekId,
  today: ISODate,
  day: DayLookup,
  rec: WeekRecord | undefined,
  skill: HobbyCategory,
): number | null {
  const dates = weekDates(week).filter((d) => d <= today);
  if (!dates.length) return null;
  const avg = (f: (e: DayEntry | undefined) => number) => dates.reduce((n, d) => n + f(day(d)), 0) / dates.length;
  const goals = avg((e) => (e ? GOAL_CATEGORIES.filter((c) => e.goals[c]).length / 4 : 0));
  const hobbies = avg((e) => {
    if (!e) return 0;
    const other = HOBBY_CATEGORIES.some((c) => c !== skill && e.hobbies[c]);
    return ((e.hobbies[skill] ? 1 : 0) + (other ? 1 : 0)) / 2;
  });
  const parts = [goals, hobbies];
  const priorities = rec?.priorities ?? [];
  if (priorities.length) {
    const done = new Set(dates.flatMap((d) => day(d)?.prioritiesDone ?? []));
    parts.push(priorities.filter((p) => done.has(p.text)).length / priorities.length);
  }
  parts.push(rec ? CHECK_KEYS.filter((k) => rec.checks[k]).length / CHECK_KEYS.length : 0);
  return Math.round((parts.reduce((a, b) => a + Math.min(1, b), 0) / parts.length) * 100);
}
