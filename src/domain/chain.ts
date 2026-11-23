import { formatShort, monthName, weekDates, weekdayShort, weekIndexInMonth, weeksOfMonth } from './dates';
import { feeling } from './feelings';
import { NAMES } from './names';
import type { DayEntry, ISODate, MonthId, MonthRecord, WeekId } from './types';

/**
 * The chain: each reflection suggests from the level below and always accepts your own words.
 *   week highlight   from the week's day titles
 *   month highlight  from its week highlights
 *   defining moment  from the year's month highlights, Kevin's Rules and extreme incidents
 * A suggestion's key names its source ("day:2026-11-19", "week:2026-W47", "month:2026-11",
 * "kevin:2026-11", "incident:2026-11"); a link is kept only while the text still equals it.
 */
export interface ChainItem {
  key: string;
  text: string;
  sub: string;
  color: string | null;
  spoken?: string;
}

type Days = Record<ISODate, DayEntry | undefined>;

export function weekSuggestions(week: WeekId, days: Days): ChainItem[] {
  return weekDates(week)
    .map((d) => ({ d, day: days[d] }))
    .filter(({ day }) => !!day?.title.trim())
    .map(({ d, day }) => {
      const f = feeling(day!.feeling);
      return {
        key: `day:${d}`,
        text: day!.title.trim(),
        sub: `${weekdayShort(d)} ${formatShort(d)}`,
        color: f?.color ?? null,
        ...(f ? { spoken: `felt ${f.name}` } : {}),
      };
    });
}

export function monthSuggestions(month: MonthId, rec: MonthRecord | undefined): ChainItem[] {
  if (!rec) return [];
  return weeksOfMonth(month)
    .filter((w) => rec.weeks[w]?.highlight.trim())
    .map((w) => ({
      key: `week:${w}`,
      text: rec.weeks[w].highlight.trim(),
      sub: `Week ${weekIndexInMonth(w)}`,
      color: null,
    }));
}

export function yearSuggestions(
  year: string,
  months: Record<MonthId, MonthRecord | undefined>,
  days: Days,
): ChainItem[] {
  const out: ChainItem[] = [];
  const ms = Object.values(months)
    .filter((m): m is MonthRecord => !!m && m.month.startsWith(`${year}-`))
    .sort((a, b) => (a.month < b.month ? -1 : 1));
  for (const m of ms) {
    const name = monthName(m.month);
    if (m.highlight.trim())
      out.push({ key: `month:${m.month}`, text: m.highlight.trim(), sub: `Highlight of ${name}`, color: null });
    if (m.setup?.extremeThing.trim())
      out.push({
        key: `kevin:${m.month}`,
        text: m.setup.extremeThing.trim(),
        sub: `${NAMES.kevin}, ${name}${m.extremeDone === true ? ', done' : m.extremeDone === false ? ', not done' : ''}`,
        color: null,
      });
    if (m.extremeIncident?.title.trim()) {
      const f = feeling(days[m.extremeIncident.date]?.feeling);
      out.push({
        key: `incident:${m.month}`,
        text: m.extremeIncident.title.trim(),
        sub: `Extreme incident, ${formatShort(m.extremeIncident.date)}`,
        color: f?.color ?? null,
        ...(f ? { spoken: `felt ${f.name}` } : {}),
      });
    }
  }
  return out;
}

/** "day:2026-11-19" -> { kind: 'day', ref: '2026-11-19' } */
export function chainSource(key: string | null | undefined): { kind: string; ref: string } | null {
  if (!key) return null;
  const i = key.indexOf(':');
  return i > 0 ? { kind: key.slice(0, i), ref: key.slice(i + 1) } : null;
}
