import { runEndingAt, pooledPercent, type AchievementKind } from '@/domain/achievements';
import { addMonths } from '@/domain/dates';
import type { DayLookup } from '@/domain/progress';
import type { MonthId, MonthRecord } from '@/domain/types';

/** How many months each bank entry has been used (any role). */
export function usageCounts(months: Map<MonthId, MonthRecord>): Map<string, number> {
  const out = new Map<string, number>();
  for (const rec of months.values()) {
    const s = rec.setup;
    if (!s) continue;
    for (const c of [...Object.values(s.goals), ...Object.values(s.hobbies)])
      out.set(c.bankId, (out.get(c.bankId) ?? 0) + 1);
  }
  return out;
}

export function usageLabel(n: number): string {
  if (!n) return 'Not tried yet';
  return `Used for ${n} ${n === 1 ? 'month' : 'months'}`;
}

/**
 * "Ukulele would be month 5 as your skill." and the best earlier run for the same entry.
 */
export function runHint(
  months: Map<MonthId, MonthRecord>,
  kind: AchievementKind,
  month: MonthId,
  bankId: string,
  text: string,
  day: DayLookup,
): string | null {
  const prev = runEndingAt(months, kind, addMonths(month, -1));
  const continuing = prev.length && prev[prev.length - 1].bankId === bankId ? prev.length : 0;
  const role = kind === 'priority' ? 'your priority' : 'your skill';
  // Best run so far for this entry: the longest earlier run, with its pooled percentage.
  let best: { len: number; pct: number } | null = null;
  for (const m of [...months.keys()].sort()) {
    if (m >= month) continue;
    const run = runEndingAt(months, kind, m);
    if (!run.length || run[run.length - 1].bankId !== bankId) continue;
    const next = months.get(addMonths(m, 1));
    const continues = next?.setup && runEndingAt(months, kind, addMonths(m, 1)).length > run.length;
    if (continues && addMonths(m, 1) < month) continue;
    const pct = Math.round(pooledPercent(run, day) * 100);
    if (!best || run.length > best.len) best = { len: run.length, pct };
  }
  const first = continuing
    ? `${text} would be month ${continuing + 1} as ${role}.`
    : `${text} would be new as ${role}.`;
  const second = best
    ? ` Your best run so far is ${best.len} ${best.len === 1 ? 'month' : 'months'} at ${best.pct}%.`
    : '';
  return first + second;
}
