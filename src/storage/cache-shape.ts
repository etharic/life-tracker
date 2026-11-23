import {
  DEFAULT_SETTINGS,
  emptyDay,
  emptyMonth,
  emptyYear,
  type DayEntry,
  type MonthRecord,
  type Settings,
  type YearRecord,
} from '../domain/types';

/**
 * Records read from the launch cache were parsed by whichever version wrote the cache. When a
 * later version adds a field, those records lack it, and code that expects it (a saved week
 * writing `week_highlight_from`) would crash. Every cached record is therefore laid over a fresh
 * empty one, so a field a newer version added is always present with its empty value.
 */
export function dayWithDefaults(v: DayEntry): DayEntry {
  return { ...emptyDay(v.date), ...v };
}

export function monthWithDefaults(v: MonthRecord): MonthRecord {
  return { ...emptyMonth(v.month), ...v };
}

export function yearWithDefaults(v: YearRecord): YearRecord {
  return { ...emptyYear(v.year), ...v };
}

export function settingsWithDefaults(v: Settings): Settings {
  return { ...DEFAULT_SETTINGS, ...v };
}
