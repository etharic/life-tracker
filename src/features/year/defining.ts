import { chainSource } from '@/domain/chain';
import type { DefiningIncident, ISODate, MonthId, MonthRecord } from '@/domain/types';

/**
 * The defining moment from what was written or picked. A pick keeps its source while the text
 * still equals it: a Kevin's Rule or an extreme incident as before, a month highlight as
 * `custom` with the month recorded top level in `defining_from` (older versions keep it).
 */
export function definingFrom(
  text: string,
  key: string | null,
  months: Record<MonthId, MonthRecord | undefined>,
  date: ISODate | null,
): { defining: DefiningIncident | null; from: MonthId | null } {
  const clean = text.trim();
  if (!clean) return { defining: null, from: null };
  const src = chainSource(key);
  const m = src ? months[src.ref] : undefined;
  if (src?.kind === 'kevin' && m?.setup?.extremeThing.trim() === clean)
    return { defining: { text: clean, source: 'extreme_thing', month: src.ref, date }, from: null };
  if (src?.kind === 'incident' && m?.extremeIncident?.title.trim() === clean)
    return {
      defining: { text: clean, source: 'extreme_incident', month: src.ref, date: date ?? m.extremeIncident.date },
      from: null,
    };
  if (src?.kind === 'month' && m?.highlight.trim() === clean)
    return { defining: { text: clean, source: 'custom', month: null, date }, from: src.ref };
  return { defining: { text: clean, source: 'custom', month: null, date }, from: null };
}

/** The suggestion key matching a saved defining moment, so the picker shows it selected. */
export function definingKey(d: DefiningIncident | null, from: MonthId | null): string | null {
  if (!d) return null;
  if (d.source === 'extreme_thing' && d.month) return `kevin:${d.month}`;
  if (d.source === 'extreme_incident' && d.month) return `incident:${d.month}`;
  return from ? `month:${from}` : null;
}
