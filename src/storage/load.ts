import { File, Paths } from 'expo-file-system';

import {
  DEFAULT_SETTINGS,
  emptyBank,
  type Achievement,
  type Bank,
  type DayEntry,
  type ISODate,
  type MonthId,
  type MonthRecord,
  type ChallengeItem,
  type ChallengeKind,
  emptyChallenges,
  type Settings,
  type YearRecord,
} from '../domain/types';
import { parseDay } from '../format/day';
import { parseMonth } from '../format/month';
import { classify } from '../format/paths';
import { parseAchievements, parseBank, parseChallenges, parseSettings, parseYear } from '../format/records';
import { dayWithDefaults, monthWithDefaults, settingsWithDefaults, yearWithDefaults } from './cache-shape';
import { appBuild, cacheEntries, cacheHeader } from './cache-key';
import type { Store } from './store';

export interface JournalData {
  days: Record<ISODate, DayEntry>;
  months: Record<MonthId, MonthRecord>;
  years: Record<string, YearRecord>;
  bank: Bank;
  achievements: Achievement[];
  settings: Settings;
  challenges: Record<ChallengeKind, ChallengeItem[]>;
}

export function emptyJournal(): JournalData {
  return {
    days: {},
    months: {},
    years: {},
    bank: emptyBank(),
    achievements: [],
    settings: { ...DEFAULT_SETTINGS },
    challenges: emptyChallenges(),
  };
}

type Parsed =
  | { t: 'day'; v: DayEntry }
  | { t: 'month'; v: MonthRecord }
  | { t: 'year'; v: YearRecord }
  | { t: 'bank'; v: Bank }
  | { t: 'achievements'; v: Achievement[] }
  | { t: 'settings'; v: Settings }
  | { t: 'challenges'; kind: ChallengeKind; v: ChallengeItem[] };

function parseFile(path: string, text: string): Parsed | null {
  const kind = classify(path);
  switch (kind.type) {
    case 'day':
      return { t: 'day', v: parseDay(text, kind.date) };
    case 'month':
      return { t: 'month', v: parseMonth(text, kind.month) };
    case 'year':
      return { t: 'year', v: parseYear(text, kind.year) };
    case 'bank':
      return { t: 'bank', v: parseBank(text) };
    case 'achievements':
      return { t: 'achievements', v: parseAchievements(text) };
    case 'settings':
      return { t: 'settings', v: parseSettings(text) };
    case 'challenges':
      return { t: 'challenges', kind: kind.kind, v: parseChallenges(text) };
    default:
      return null;
  }
}

// The cache is tied to the app build that wrote it (see cache-key.ts), so every update reads the
// files once and a record parsed by an older version can never reach the app.
const BUILD = appBuild();
interface CacheEntry {
  m: number;
  s: number;
  p: Parsed;
}

/**
 * The parsed-file cache lives in the system cache folder: iOS may delete it at any time
 * and it is rebuilt from the files, which stay the only truth.
 */
function cacheFile(): File {
  return new File(Paths.cache, 'journal-index.json');
}

async function readCache(): Promise<Record<string, CacheEntry>> {
  try {
    const f = cacheFile();
    if (!f.exists) return {};
    return cacheEntries<CacheEntry>(JSON.parse(await f.text()), BUILD);
  } catch {
    return {};
  }
}

async function writeCache(entries: Record<string, CacheEntry>): Promise<void> {
  try {
    const f = cacheFile();
    if (!f.exists) f.create();
    await f.write(JSON.stringify(cacheHeader(BUILD, entries)));
  } catch {
    // A missing cache only costs time on the next launch.
  }
}

export async function clearCache(): Promise<void> {
  const f = cacheFile();
  if (f.exists) f.delete();
}

export interface LoadReport {
  data: JournalData;
  unreadable: string[];
}

export async function loadJournal(store: Store): Promise<LoadReport> {
  const files = (await store.list()).filter((f) => f.path.endsWith('.md'));
  const cache = await readCache();
  const next: Record<string, CacheEntry> = {};
  const data = emptyJournal();
  const unreadable: string[] = [];

  // Files unchanged since the last launch come from the cache. The rest (all of them after a
  // restore or on a new phone) are read a few at a time, not one after another.
  const fresh = new Map<string, Parsed | null>();
  const misses = files.filter((f) => {
    const hit = cache[f.path];
    return !(hit && hit.m === f.modified && hit.s === f.size);
  });
  const BATCH = 8;
  for (let i = 0; i < misses.length; i += BATCH) {
    await Promise.all(
      misses.slice(i, i + BATCH).map(async (f) => {
        try {
          const text = await store.readText(f.path);
          fresh.set(f.path, text == null ? null : parseFile(f.path, text));
        } catch {
          unreadable.push(f.path);
          fresh.set(f.path, null);
        }
      }),
    );
  }

  for (const f of files) {
    const parsed = fresh.has(f.path) ? fresh.get(f.path)! : cache[f.path].p;
    if (!parsed) continue;
    next[f.path] = { m: f.modified, s: f.size, p: parsed };
    switch (parsed.t) {
      case 'day':
        data.days[parsed.v.date] = dayWithDefaults(parsed.v);
        break;
      case 'month':
        data.months[parsed.v.month] = monthWithDefaults(parsed.v);
        break;
      case 'year':
        data.years[parsed.v.year] = yearWithDefaults(parsed.v);
        break;
      case 'bank':
        data.bank = parsed.v;
        break;
      case 'achievements':
        data.achievements = parsed.v;
        break;
      case 'settings':
        data.settings = settingsWithDefaults(parsed.v);
        break;
      case 'challenges':
        data.challenges[parsed.kind] = parsed.v;
        break;
    }
  }
  await writeCache(next);
  return { data, unreadable };
}
