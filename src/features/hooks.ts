import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { logicalDate, monthDates, monthOf, monthOfWeek, weekOf } from '../domain/dates';
import { currentStreak, longestStreak, ringStat, runEndingToday, isTicked, type RingStat } from '../domain/progress';
import { duePrompts, type PromptInput } from '../domain/prompts';
import {
  emptyDay,
  emptyMonth,
  emptyWeek,
  GOAL_CATEGORIES,
  HOBBY_CATEGORIES,
  type Category,
  type DayEntry,
  type ISODate,
  type MonthId,
  type MonthRecord,
  type MonthSetup,
  type WeekId,
} from '../domain/types';
import { useSyncState } from '../sync/scheduler';
import { useJournal } from '../state/journal';

export function useToday(): ISODate {
  return useJournal((s) => s.today);
}

export function useDay(date: ISODate): DayEntry {
  const day = useJournal((s) => s.days[date]);
  return useMemo(() => day ?? emptyDay(date), [day, date]);
}

export function useMonth(month: MonthId): MonthRecord {
  const rec = useJournal((s) => s.months[month]);
  return useMemo(() => rec ?? emptyMonth(month), [rec, month]);
}

export function useWeek(week: WeekId) {
  const rec = useJournal((s) => s.months[monthOfWeek(week)]?.weeks[week]);
  return useMemo(() => rec ?? emptyWeek(), [rec]);
}

export function useDayLookup() {
  const days = useJournal((s) => s.days);
  return useMemo(() => (d: ISODate) => days[d], [days]);
}

export function useMonthsMap(): Map<MonthId, MonthRecord> {
  const months = useJournal((s) => s.months);
  return useMemo(() => new Map(Object.entries(months)), [months]);
}

export function usePromptInput(): PromptInput {
  const { today, months, years, settings } = useJournal(
    useShallow((s) => ({ today: s.today, months: s.months, years: s.years, settings: s.settings })),
  );
  const lastSync = useSyncState((s) => (s.connected ? s.lastSync : null));
  return useMemo(
    () => ({
      today,
      months: new Map(Object.entries(months)),
      years: new Map(Object.entries(years)),
      settings,
      driveSync: lastSync ? logicalDate(new Date(lastSync), settings.dayStartHour) : null,
    }),
    [today, months, years, settings, lastSync],
  );
}

export function usePrompts() {
  const input = usePromptInput();
  return useMemo(() => duePrompts(input), [input]);
}

export function useStreaks() {
  const days = useJournal((s) => s.days);
  const today = useToday();
  return useMemo(() => {
    const look = (d: ISODate) => days[d];
    return { current: currentStreak(today, look), longest: longestStreak(Object.keys(days), look) };
  }, [days, today]);
}

/** Rings for a month, priority goal and skill hobby first. */
export function useMonthRings(month: MonthId) {
  const rec = useMonth(month);
  const lookup = useDayLookup();
  const today = useToday();
  return useMemo(() => {
    const goals = orderedGoals(rec.setup).map((c) => ringStat(month, c, today, lookup));
    const hobbies = orderedHobbies(rec.setup).map((c) => ringStat(month, c, today, lookup));
    return { goals, hobbies } satisfies { goals: RingStat[]; hobbies: RingStat[] };
  }, [rec, lookup, today, month]);
}

/** Priority goal first (it is starred), then the others in their usual order. */
export function orderedGoals(setup: MonthSetup | null) {
  if (!setup) return [...GOAL_CATEGORIES];
  return [setup.priority, ...GOAL_CATEGORIES.filter((c) => c !== setup.priority)];
}
export function orderedHobbies(setup: MonthSetup | null) {
  if (!setup) return [...HOBBY_CATEGORIES];
  return [setup.skill, ...HOBBY_CATEGORIES.filter((c) => c !== setup.skill)];
}

/** Current streak of ticks for one goal or hobby, while it holds the same bank entry. */
export function useItemStreak(category: Category, bankId: string | undefined) {
  const days = useJournal((s) => s.days);
  const months = useJournal((s) => s.months);
  const today = useToday();
  return useMemo(() => {
    if (!bankId) return 0;
    return runEndingToday(today, (d) => {
      const s = months[monthOf(d)]?.setup;
      const choice = s
        ? category in s.goals
          ? s.goals[category as keyof typeof s.goals]
          : s.hobbies[category as keyof typeof s.hobbies]
        : null;
      return choice?.bankId === bankId && isTicked(days[d], category);
    });
  }, [days, months, today, category, bankId]);
}

export function useWeekOf(date: ISODate): WeekId {
  return useMemo(() => weekOf(date), [date]);
}

export function useMonthDays(month: MonthId) {
  const days = useJournal((s) => s.days);
  return useMemo(
    () =>
      monthDates(month)
        .map((d) => days[d])
        .filter((d): d is DayEntry => !!d),
    [days, month],
  );
}
