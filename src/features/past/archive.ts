import { lastOfMonth } from '@/domain/dates';
import { ringStat, type DayLookup, type RingStat } from '@/domain/progress';
import type { Category, ISODate, MonthId, MonthRecord } from '@/domain/types';

export interface UseOfItem {
  month: MonthId;
  category: Category;
  text: string;
  priority: boolean;
  skill: boolean;
  stat: RingStat;
}

/** Every month a bank entry was on the list, with its days and percentage. */
export function usesOf(
  bankId: string,
  months: Record<MonthId, MonthRecord>,
  day: DayLookup,
  today: ISODate,
): UseOfItem[] {
  const out: UseOfItem[] = [];
  for (const rec of Object.values(months)) {
    const s = rec.setup;
    if (!s) continue;
    for (const [cat, choice] of [...Object.entries(s.goals), ...Object.entries(s.hobbies)] as [
      Category,
      { bankId: string; text: string },
    ][]) {
      if (choice.bankId !== bankId) continue;
      const end = today > lastOfMonth(rec.month) ? lastOfMonth(rec.month) : today;
      out.push({
        month: rec.month,
        category: cat,
        text: choice.text,
        priority: cat === s.priority,
        skill: cat === s.skill,
        stat: ringStat(rec.month, cat, end, day),
      });
    }
  }
  return out.sort((a, b) => (a.month < b.month ? -1 : 1));
}
