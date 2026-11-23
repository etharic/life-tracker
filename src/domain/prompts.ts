import {
  addDays,
  addWeeks,
  lastOfMonth,
  monthName,
  monthOf,
  monthOfWeek,
  weekIndexInMonth,
  weekMonday,
  weekOf,
  weekSunday,
} from './dates';
import type { ISODate, MonthId, MonthRecord, Settings, WeekId, YearRecord } from './types';

export type PromptKind = 'week-close' | 'month-close' | 'year-close' | 'setup' | 'week-start' | 'backup';

export interface Prompt {
  id: string;
  kind: PromptKind;
  /** WeekId, MonthId or year. */
  ref: string;
  due: ISODate;
  title: string;
  detail: string;
}

const ORDER: PromptKind[] = ['week-close', 'month-close', 'year-close', 'setup', 'week-start', 'backup'];

export function promptId(kind: PromptKind, ref: string): string {
  return `${kind}:${ref}`;
}

export function parsePromptId(id: string): { kind: PromptKind; ref: string } | null {
  const i = id.indexOf(':');
  if (i < 0) return null;
  const kind = id.slice(0, i) as PromptKind;
  if (!ORDER.includes(kind)) return null;
  return { kind, ref: id.slice(i + 1) };
}

/** Where a prompt's "skipped" note is stored: the month file (or year file for year-close). */
export function promptHome(kind: PromptKind, ref: string): { month?: MonthId; year?: string } {
  switch (kind) {
    case 'week-close':
    case 'week-start':
      return { month: monthOfWeek(ref) };
    case 'month-close':
    case 'setup':
      return { month: ref };
    case 'year-close':
      return { year: ref };
    case 'backup':
      return {};
  }
}

export function weekLabel(week: WeekId): string {
  return `Week ${weekIndexInMonth(week)}`;
}

export interface PromptInput {
  today: ISODate;
  months: Map<MonthId, MonthRecord>;
  years: Map<string, YearRecord>;
  settings: Settings;
}

/** Is this prompt answered (done) regardless of skipping? */
export function isPromptDone(kind: PromptKind, ref: string, input: PromptInput): boolean {
  const { months, years } = input;
  switch (kind) {
    case 'week-close':
      return !!months.get(monthOfWeek(ref))?.weeks[ref]?.closed;
    case 'week-start':
      return !!months.get(monthOfWeek(ref))?.weeks[ref]?.started;
    case 'setup':
      return !!months.get(ref)?.setup;
    case 'month-close':
      return !!months.get(ref)?.close;
    case 'year-close':
      return !!years.get(ref)?.reviewed;
    case 'backup':
      return false;
  }
}

export function isPromptSkipped(kind: PromptKind, ref: string, input: PromptInput): boolean {
  const home = promptHome(kind, ref);
  if (home.year) return input.years.get(home.year)?.skipped != null;
  if (home.month) return promptId(kind, ref) in (input.months.get(home.month)?.skipped ?? {});
  return false;
}

function describe(kind: PromptKind, ref: string): { title: string; detail: string } {
  switch (kind) {
    case 'week-close':
      return {
        title: `Close ${weekLabel(ref).toLowerCase()}`,
        detail: `${monthName(monthOfWeek(ref))}, commitments and highlight`,
      };
    case 'week-start':
      return { title: `Start ${weekLabel(ref).toLowerCase()}`, detail: 'Outlook and this week’s commitments' };
    case 'setup':
      return { title: `Set up ${monthName(ref)}`, detail: 'Goals, hobbies, commitments and Kevin’s Rule' };
    case 'month-close':
      return { title: `Close ${monthName(ref)}`, detail: 'Kevin’s Rule, extreme incident, next month' };
    case 'year-close':
      return { title: `Review ${ref}`, detail: 'Record or confirm the year’s Misogi Ritual' };
    case 'backup':
      return { title: 'Yearly backup', detail: 'Save a ZIP and the yearly book to a drive' };
  }
}

function make(kind: PromptKind, ref: string, due: ISODate): Prompt {
  return { id: promptId(kind, ref), kind, ref, due, ...describe(kind, ref) };
}

/**
 * Every prompt that is due and neither done nor skipped, oldest first.
 * Week and month cards that were missed stay until answered or skipped.
 */
export function duePrompts(input: PromptInput): Prompt[] {
  const { today, months, settings } = input;
  const start = settings.firstUse ?? today;
  const out: Prompt[] = [];
  const add = (kind: PromptKind, ref: string, due: ISODate) => {
    if (isPromptDone(kind, ref, input) || isPromptSkipped(kind, ref, input)) return;
    out.push(make(kind, ref, due));
  };

  // Week close: every week since first use whose Sunday has come.
  const thisWeek = weekOf(today);
  let w = weekOf(start);
  while (weekSunday(w) <= today) {
    add('week-close', w, weekSunday(w));
    w = addWeeks(w, 1);
  }
  // Week start: only the current week (setting last week's priorities later has no use).
  add('week-start', thisWeek, weekMonday(thisWeek));

  // Month setup: the current month.
  add('setup', monthOf(today), `${monthOf(today)}-01`);

  // Month close and year close: every set-up month whose last day has come.
  const yearsWithSetup = new Set<string>();
  for (const [month, rec] of months) {
    if (!rec.setup) continue;
    yearsWithSetup.add(month.slice(0, 4));
    if (lastOfMonth(month) <= today) add('month-close', month, lastOfMonth(month));
  }
  for (const y of yearsWithSetup) {
    if (`${y}-12-25` <= today) add('year-close', y, `${y}-12-25`);
  }

  // Backup reminder once a year.
  const since = settings.lastBackup ?? start;
  if (addDays(since, 365) <= today) out.push(make('backup', today.slice(0, 4), today));

  return out.sort((a, b) => (a.due === b.due ? ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) : a.due < b.due ? -1 : 1));
}

/** Skipped, still unanswered prompts that belong to a month (shown on the Month page). */
export function waitingPrompts(month: MonthId, input: PromptInput): Prompt[] {
  const rec = input.months.get(month);
  if (!rec) return [];
  const out: Prompt[] = [];
  for (const id of Object.keys(rec.skipped)) {
    const p = parsePromptId(id);
    if (!p || isPromptDone(p.kind, p.ref, input)) continue;
    const due =
      p.kind === 'week-close'
        ? weekSunday(p.ref)
        : p.kind === 'week-start'
          ? weekMonday(p.ref)
          : p.kind === 'month-close'
            ? lastOfMonth(p.ref)
            : `${p.ref}-01`;
    out.push(make(p.kind, p.ref, due));
  }
  return out.sort((a, b) => (a.due < b.due ? -1 : 1));
}
