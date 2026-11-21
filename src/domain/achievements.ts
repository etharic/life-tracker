import { addMonths, daysInMonth, lastOfMonth, monthDates } from './dates';
import { isTicked, type DayLookup } from './progress';
import {
  HOBBY_CATEGORIES,
  hobbyHours,
  type Achievement,
  type Category,
  type ISODate,
  type MonthId,
  type MonthRecord,
} from './types';

export type AchievementKind = 'priority' | 'skill';

export const ACHIEVEMENT_MONTHS = 3;
export const ACHIEVEMENT_THRESHOLD = 0.8;

export interface Slot {
  month: MonthId;
  bankId: string;
  text: string;
  category: Category;
}

/** The bank entry that held the priority goal or the skill hobby in a month. */
export function slotOf(rec: MonthRecord, kind: AchievementKind): Slot | null {
  const s = rec.setup;
  if (!s) return null;
  if (kind === 'priority') {
    const c = s.goals[s.priority];
    return { month: rec.month, bankId: c.bankId, text: c.text, category: s.priority };
  }
  const c = s.hobbies[s.skill];
  return { month: rec.month, bankId: c.bankId, text: c.text, category: s.skill };
}

export function tickedInMonth(slot: Slot, day: DayLookup): number {
  return monthDates(slot.month).filter((d) => isTicked(day(d), slot.category)).length;
}

/**
 * Consecutive months (ending at `month`) in which the same bank entry held this role.
 * Switching to a different item, or a month without setup, starts a new run.
 */
export function runEndingAt(months: Map<MonthId, MonthRecord>, kind: AchievementKind, month: MonthId): Slot[] {
  const first = months.get(month);
  const anchor = first ? slotOf(first, kind) : null;
  if (!anchor) return [];
  const run: Slot[] = [anchor];
  let m = addMonths(month, -1);
  for (;;) {
    const rec = months.get(m);
    const s = rec ? slotOf(rec, kind) : null;
    if (!s || s.bankId !== anchor.bankId) break;
    run.unshift(s);
    m = addMonths(m, -1);
  }
  return run;
}

/** Pooled percentage of a set of months: all ticks / all days. */
export function pooledPercent(slots: Slot[], day: DayLookup): number {
  const days = slots.reduce((n, s) => n + daysInMonth(s.month), 0);
  if (days === 0) return 0;
  const ticked = slots.reduce((n, s) => n + tickedInMonth(s, day), 0);
  return ticked / days;
}

/**
 * Achievements newly earned. Rule: the same bank entry as priority goal (or skill hobby)
 * for 3 consecutive months, with the pooled days ticked / days in those months above 80%.
 * Awarded at the end of the third month; if missed, the run continues and can earn it later
 * when the most recent three months pass. One award per run. Never revoked.
 *
 * Only months that are over are evaluated: `today` is after their last day, or the month
 * has been closed (the month-end card can run on its last day).
 */
export function newAchievements(
  months: Map<MonthId, MonthRecord>,
  day: DayLookup,
  today: ISODate,
  existing: Achievement[],
): Achievement[] {
  const found: Achievement[] = [];
  const all = [...existing];
  const sorted = [...months.keys()].sort();
  for (const kind of ['priority', 'skill'] as const) {
    for (const month of sorted) {
      if (today <= lastOfMonth(month) && !months.get(month)?.close) continue;
      const run = runEndingAt(months, kind, month);
      if (run.length < ACHIEVEMENT_MONTHS) continue;
      const runMonths = new Set(run.map((s) => s.month));
      const bankId = run[0].bankId;
      const already = all.some((a) => a.kind === kind && a.bankId === bankId && a.months.some((m) => runMonths.has(m)));
      if (already) continue;
      const window = run.slice(-ACHIEVEMENT_MONTHS);
      const pct = pooledPercent(window, day);
      if (pct > ACHIEVEMENT_THRESHOLD) {
        const last = window[window.length - 1];
        const a: Achievement = {
          kind,
          bankId,
          text: last.text,
          category: last.category,
          months: window.map((s) => s.month),
          percent: Math.round(pct * 100),
          earned: lastOfMonth(month),
        };
        found.push(a);
        all.push(a);
      }
    }
  }
  for (const a of hourAchievements(months, day, today, all)) found.push(a);
  return found;
}

export function achievementSentence(a: Achievement): string {
  if (a.kind === 'hours') return `${a.hours} hours spent`;
  const role = a.kind === 'priority' ? 'your priority goal' : 'your skill';
  return `${ACHIEVEMENT_MONTHS} months as ${role}, ${a.percent}% of days`;
}

// ---------- Hours on a hobby ----------

export const HOUR_MILESTONES = [100, 250, 500, 1000] as const;

export interface HobbyTotal {
  bankId: string;
  text: string;
  category: Category;
  hours: number;
  months: MonthId[];
}

/**
 * Hours per hobby, by its bank entry: every month the hobby was chosen counts, in any category
 * slot, so a hobby set aside and chosen again later carries on from where it stopped.
 */
export function hobbyTotals(
  months: Map<MonthId, MonthRecord>,
  day: DayLookup,
  today: ISODate,
): Map<string, HobbyTotal> {
  const totals = new Map<string, HobbyTotal>();
  for (const month of [...months.keys()].sort()) {
    const s = months.get(month)?.setup;
    if (!s) continue;
    const dates = monthDates(month).filter((d) => d <= today);
    for (const c of HOBBY_CATEGORIES) {
      const { bankId, text } = s.hobbies[c];
      if (!bankId) continue;
      const hours = dates.reduce((n, d) => n + hobbyHours(day(d), c), 0);
      const t = totals.get(bankId) ?? { bankId, text, category: c, hours: 0, months: [] };
      t.hours += hours;
      t.text = text;
      t.category = c;
      t.months.push(month);
      totals.set(bankId, t);
    }
  }
  return totals;
}

/** A badge for each milestone a hobby has passed, once each, on the day it is reached. Never revoked. */
export function hourAchievements(
  months: Map<MonthId, MonthRecord>,
  day: DayLookup,
  today: ISODate,
  existing: Achievement[],
): Achievement[] {
  const found: Achievement[] = [];
  for (const t of hobbyTotals(months, day, today).values()) {
    for (const m of HOUR_MILESTONES) {
      if (t.hours < m) break;
      if (existing.some((a) => a.kind === 'hours' && a.bankId === t.bankId && a.hours === m)) continue;
      found.push({
        kind: 'hours',
        bankId: t.bankId,
        text: t.text,
        category: t.category,
        months: t.months,
        percent: 0,
        hours: m,
        earned: today,
      });
    }
  }
  return found;
}
