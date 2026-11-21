import * as Crypto from 'expo-crypto';
import { create } from 'zustand';

import { newAchievements } from '../domain/achievements';
import { logicalDate, monthOf, monthOfWeek, weekDates } from '../domain/dates';
import {
  emptyDay,
  emptyMonth,
  emptyWeek,
  emptyYear,
  type Achievement,
  type Bank,
  HOBBY_CATEGORIES,
  type BankEntry,
  type BankKind,
  type Category,
  type DayEntry,
  type ISODate,
  type MonthId,
  type MonthRecord,
  type Rejection,
  type Settings,
  type WeekId,
  type WeekRecord,
  type YearRecord,
} from '../domain/types';
import { serializeDay } from '../format/day';
import { serializeMonth } from '../format/month';
import { ACHIEVEMENTS, BANK, dayPath, monthPath, README, REJECTIONS, SETTINGS, yearPath } from '../format/paths';
import { readmeText } from '../format/readme';
import {
  serializeAchievements,
  serializeBank,
  serializeRejections,
  serializeSettings,
  serializeYear,
} from '../format/records';
import { FileStore } from '../storage/file-store';
import { emptyJournal, loadJournal, type JournalData } from '../storage/load';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

let store: FileStore | null = null;
export function journalStore(): FileStore {
  if (!store) store = new FileStore();
  return store;
}

// ---------- Writes: one queue per file, so quick successive saves land in order ----------

const queues = new Map<string, Promise<void>>();
const writeListeners = new Set<(path: string) => void>();

/** Called after every local write (used to schedule Drive sync). */
export function onLocalWrite(cb: (path: string) => void): () => void {
  writeListeners.add(cb);
  return () => writeListeners.delete(cb);
}

function persist(path: string, text: string): Promise<void> {
  const prev = queues.get(path) ?? Promise.resolve();
  const next = prev
    .catch(() => undefined)
    .then(() => journalStore().writeText(path, text))
    .then(() => writeListeners.forEach((cb) => cb(path)));
  queues.set(path, next);
  next.catch((e: unknown) => useJournal.setState({ saveError: `Could not save ${path}: ${String(e)}` }));
  return next;
}

export async function flushWrites(): Promise<void> {
  await Promise.allSettled([...queues.values()]);
}

// ---------- State ----------

export interface JournalState extends JournalData {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  saveError: string | null;
  unreadable: string[];
  today: ISODate;

  init(): Promise<void>;
  reload(): Promise<void>;
  refreshToday(): void;

  updateDay(date: ISODate, fn: (d: DayEntry) => void): void;
  updateMonth(month: MonthId, fn: (m: MonthRecord) => void): void;
  updateWeek(week: WeekId, fn: (w: WeekRecord) => void): void;
  updateYear(year: string, fn: (y: YearRecord) => void): void;
  updateBank(fn: (b: Bank) => void): void;
  updateSettings(fn: (s: Settings) => void): void;
  saveRejection(r: Omit<Rejection, 'id' | 'added'> & { id?: string }): string;
  removeRejection(id: string): void;

  togglePriority(week: WeekId, text: string, onDate: ISODate): void;
  addBankEntry(kind: BankKind, category: Category, text: string): BankEntry;
  skipPrompt(home: { month?: MonthId; year?: string }, id: string, note: string): void;
  checkAchievements(): Achievement[];
}

function dayLookup(days: Record<ISODate, DayEntry>) {
  return (d: ISODate) => days[d];
}

function newId(prefix: string, taken: Set<string>): string {
  for (;;) {
    const id = `${prefix}${Crypto.randomUUID().replace(/-/g, '').slice(0, 6)}`;
    if (!taken.has(id)) return id;
  }
}

function allBankIds(bank: Bank): Set<string> {
  const ids = new Set<string>();
  for (const list of [...Object.values(bank.goals), ...Object.values(bank.hobbies)])
    for (const e of list) ids.add(e.id);
  return ids;
}

/** Week priorities' done flags are derived from the day files of that week. */
function syncPriorityFlags(week: WeekRecord, weekId: WeekId, days: Record<ISODate, DayEntry>): void {
  const done = new Set(weekDates(weekId).flatMap((d) => days[d]?.prioritiesDone ?? []));
  for (const p of week.priorities) p.done = done.has(p.text);
}

export const useJournal = create<JournalState>()((set, get) => ({
  ...emptyJournal(),
  status: 'loading',
  error: null,
  saveError: null,
  unreadable: [],
  today: logicalDate(new Date(), 4),

  async init() {
    try {
      await get().reload();
      const s = get();
      if (!s.settings.firstUse) s.updateSettings((x) => void (x.firstUse = s.today));
      if (!journalStore().exists(README)) void persist(README, readmeText(get().settings.noteToReaders));
      get().checkAchievements();
      // A recording interrupted by the app closing is attached to its day now.
      void import('./recordings').then((m) => m.recoverRecordings()).catch(() => undefined);
    } catch (e) {
      set({ status: 'error', error: String(e) });
    }
  },

  async reload() {
    const { data, unreadable } = await loadJournal(journalStore());
    set({
      ...data,
      unreadable,
      status: 'ready',
      error: null,
      today: logicalDate(new Date(), data.settings.dayStartHour),
    });
  },

  refreshToday() {
    const today = logicalDate(new Date(), get().settings.dayStartHour);
    if (today !== get().today) {
      set({ today });
      get().checkAchievements();
    }
  },

  updateDay(date, fn) {
    const day = clone(get().days[date] ?? emptyDay(date));
    fn(day);
    const days = { ...get().days, [date]: day };
    set({ days });
    void persist(dayPath(date), serializeDay(day));
    // A tick can earn an achievement: hours on a hobby at once, a past month's day for the rest.
    // Never revoked, only added.
    if (monthOf(date) < monthOf(get().today) || HOBBY_CATEGORIES.some((c) => day.hobbies[c])) get().checkAchievements();
  },

  updateMonth(month, fn) {
    const rec = clone(get().months[month] ?? emptyMonth(month));
    fn(rec);
    set({ months: { ...get().months, [month]: rec } });
    void persist(monthPath(month), serializeMonth(rec));
  },

  updateWeek(week, fn) {
    get().updateMonth(monthOfWeek(week), (m) => {
      const w = m.weeks[week] ?? emptyWeek();
      fn(w);
      syncPriorityFlags(w, week, get().days);
      m.weeks[week] = w;
    });
  },

  updateYear(year, fn) {
    const rec = clone(get().years[year] ?? emptyYear(year));
    fn(rec);
    set({ years: { ...get().years, [year]: rec } });
    void persist(yearPath(year), serializeYear(rec));
  },

  updateBank(fn) {
    const before = new Map<string, string>();
    for (const list of [...Object.values(get().bank.goals), ...Object.values(get().bank.hobbies)])
      for (const e of list) before.set(e.id, e.text);
    const bank = clone(get().bank);
    fn(bank);
    set({ bank });
    void persist(BANK, serializeBank(bank));
    // A reworded idea is reworded everywhere it is used: each month that chose it, and its achievements.
    const renamed = new Map<string, string>();
    for (const list of [...Object.values(bank.goals), ...Object.values(bank.hobbies)])
      for (const e of list) if (before.has(e.id) && before.get(e.id) !== e.text) renamed.set(e.id, e.text);
    if (!renamed.size) return;
    for (const rec of Object.values(get().months)) {
      const s = rec.setup;
      if (!s) continue;
      const uses = [...Object.values(s.goals), ...Object.values(s.hobbies)].some(
        (c) => renamed.has(c.bankId) && c.text !== renamed.get(c.bankId),
      );
      if (!uses) continue;
      get().updateMonth(rec.month, (m) => {
        for (const c of [...Object.values(m.setup!.goals), ...Object.values(m.setup!.hobbies)])
          if (renamed.has(c.bankId)) c.text = renamed.get(c.bankId)!;
      });
    }
    if (get().achievements.some((x) => renamed.has(x.bankId))) {
      const achievements = get().achievements.map((x) =>
        renamed.has(x.bankId) ? { ...x, text: renamed.get(x.bankId)! } : x,
      );
      set({ achievements });
      void persist(ACHIEVEMENTS, serializeAchievements(achievements));
    }
  },

  updateSettings(fn) {
    const before = get().settings;
    const settings = clone(before);
    fn(settings);
    set({ settings, today: logicalDate(new Date(), settings.dayStartHour) });
    void persist(SETTINGS, serializeSettings(settings));
    if (settings.noteToReaders !== before.noteToReaders) void persist(README, readmeText(settings.noteToReaders));
  },

  saveRejection(r) {
    const list = clone(get().rejections);
    const i = r.id ? list.findIndex((x) => x.id === r.id) : -1;
    let id = r.id ?? '';
    if (i >= 0) list[i] = { ...list[i], ...r, id: list[i].id };
    else {
      id = newId('r', new Set(list.map((x) => x.id)));
      list.push({ ...r, id, added: get().today });
    }
    set({ rejections: list });
    void persist(REJECTIONS, serializeRejections(list));
    return id;
  },

  removeRejection(id) {
    const list = get().rejections.filter((x) => x.id !== id);
    set({ rejections: list });
    void persist(REJECTIONS, serializeRejections(list));
  },

  togglePriority(week, text, onDate) {
    const s = get();
    const dates = weekDates(week);
    const doneOn = dates.filter((d) => s.days[d]?.prioritiesDone.includes(text));
    if (doneOn.length) {
      for (const d of doneOn)
        s.updateDay(d, (x) => void (x.prioritiesDone = x.prioritiesDone.filter((p) => p !== text)));
    } else {
      const date = dates.includes(onDate) ? onDate : dates[0];
      s.updateDay(date, (x) => void x.prioritiesDone.push(text));
    }
    s.updateWeek(week, () => undefined);
  },

  addBankEntry(kind, category, text) {
    const clean = text.trim();
    const list = (get().bank[kind] as Record<string, BankEntry[]>)[category] ?? [];
    const existing = list.find((e) => e.text.toLowerCase() === clean.toLowerCase());
    if (existing) {
      if (existing.retired)
        get().updateBank((b) => {
          const e = (b[kind] as Record<string, BankEntry[]>)[category].find((x) => x.id === existing.id);
          if (e) e.retired = false;
        });
      return existing;
    }
    const entry: BankEntry = {
      id: newId(kind === 'goals' ? 'g' : 'h', allBankIds(get().bank)),
      text: clean,
      added: get().today,
      retired: false,
    };
    get().updateBank((b) => void (b[kind] as Record<string, BankEntry[]>)[category].push(entry));
    return entry;
  },

  skipPrompt(home, id, note) {
    if (home.year) get().updateYear(home.year, (y) => void (y.skipped = note));
    else if (home.month) get().updateMonth(home.month, (m) => void (m.skipped[id] = note));
  },

  checkAchievements() {
    const s = get();
    const found = newAchievements(new Map(Object.entries(s.months)), dayLookup(s.days), s.today, s.achievements);
    if (found.length) {
      const achievements = [...s.achievements, ...found];
      set({ achievements });
      void persist(ACHIEVEMENTS, serializeAchievements(achievements));
    }
    return found;
  },
}));
