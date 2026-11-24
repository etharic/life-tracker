import { addDays, weekOf } from '../src/domain/dates';
import { checkRates, hobbyBalance } from '../src/domain/progress';
import { backupDue, backupLine, type PromptInput } from '../src/domain/prompts';
import { MAX_PENDING, reminderSchedule } from '../src/domain/reminders';
import { buildIndex, fold, searchIndex, searchJournal, type Searchable } from '../src/domain/search';
import { bestWeekdaySentence, weekdayFeelings, wordCount, wordsInYear, writingStats } from '../src/domain/stats';
import {
  DEFAULT_SETTINGS,
  emptyDay,
  emptyMonth,
  emptyWeek,
  emptyYear,
  type DayEntry,
  type ISODate,
  type MonthRecord,
  type MonthSetup,
  type Settings,
} from '../src/domain/types';
import { parseSettings, serializeSettings } from '../src/format/records';
import { serialQueue } from '../src/reminders/queue';
import { cacheEntries, cacheHeader } from '../src/storage/cache-key';
import { appendTrimmed, formatError } from '../src/storage/error-format';

const day = (date: ISODate, patch: Partial<DayEntry> = {}): DayEntry => ({ ...emptyDay(date), ...patch });
const byDate = (list: DayEntry[]) => Object.fromEntries(list.map((d) => [d.date, d]));
const settings = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...patch });

function setup(checks: [string, string, string]): MonthSetup {
  const c = (text: string) => ({ text, bankId: text });
  return {
    goals: { health: c('a'), wealth: c('b'), wise: c('c'), versatility: c('d') },
    hobbies: { intellectual: c('e'), physical: c('f'), creative: c('g'), social: c('h') },
    priority: 'health',
    priorityKind: 'build',
    skill: 'creative',
    weeklyChecks: { check_1: checks[0], check_2: checks[1], check_3: checks[2] },
    outlook: '',
    extremeThing: '',
  };
}

// ---------- E2: the launch cache belongs to one build ----------

describe('launch cache key', () => {
  it('uses a cache only when the same build wrote it', () => {
    const e = { 'x.md': { m: 1, s: 2, p: null } };
    const json = JSON.parse(JSON.stringify(cacheHeader('1.18.0+120', e)));
    expect(cacheEntries(json, '1.18.0+120')).toEqual(e);
    expect(cacheEntries(json, '1.18.0+121')).toEqual({});
    expect(cacheEntries(json, '1.19.0+120')).toEqual({});
  });

  it('ignores a 1.17 cache (version 2, no build) and anything malformed', () => {
    expect(cacheEntries({ v: 2, e: { a: 1 } }, '1.18.0+1')).toEqual({});
    expect(cacheEntries(null, 'b')).toEqual({});
    expect(cacheEntries('text', 'b')).toEqual({});
    expect(cacheEntries({ v: 3, b: 'b', e: 'nope' }, 'b')).toEqual({});
  });
});

// ---------- E1: errors.log ----------

describe('error log', () => {
  const ctx = {
    when: new Date('2026-11-24T20:15:00Z'),
    build: '1.18.0+120',
    route: '/week-start/2026-W48',
    kind: 'fatal' as const,
  };

  it('writes a header line with time, kind, build and screen, then the message and stack', () => {
    const e = new TypeError('Cannot convert undefined value to object');
    e.stack = 'TypeError: Cannot convert undefined value to object\n    at serializeMonth (month.ts:1)';
    const block = formatError(e, ctx);
    expect(block.split('\n')[0]).toBe('[2026-11-24T20:15:00.000Z] fatal · 1.18.0+120 · /week-start/2026-W48');
    expect(block).toContain('TypeError: Cannot convert undefined value to object\n    at serializeMonth');
    // The message is not repeated when the stack already starts with it.
    expect(block.match(/Cannot convert/g)).toHaveLength(1);
    expect(block.endsWith('\n\n')).toBe(true);
  });

  it('handles strings and plain objects', () => {
    expect(formatError('boom', ctx)).toContain('\nboom\n');
    expect(formatError({ code: 7 }, ctx)).toContain('{"code":7}');
  });

  it('keeps only the newest part, cut at the start of a block', () => {
    let log = '';
    for (let i = 0; i < 50; i++) log = appendTrimmed(log, formatError(`error ${i}`, ctx), 1000);
    expect(log.length).toBeLessThanOrEqual(1000);
    expect(log.startsWith('[')).toBe(true);
    expect(log).toContain('error 49');
    expect(log).not.toContain('error 0\n');
  });
});

// ---------- E3: backups ----------

describe('backup prompt', () => {
  const input = (today: ISODate, s: Partial<Settings>, driveSync: ISODate | null = null): PromptInput => ({
    today,
    months: new Map(),
    years: new Map(),
    settings: settings({ firstUse: '2026-01-01', ...s }),
    driveSync,
  });

  it('asks for the writing ZIP 30 days after the last confirmed backup', () => {
    expect(backupDue(input('2026-11-29', { lastBackup: '2026-10-31', lastFullBackup: '2026-06-01' }))).toBeNull();
    expect(backupDue(input('2026-11-30', { lastBackup: '2026-10-31', lastFullBackup: '2026-06-01' }))).toBe('2026-11');
  });

  it('asks for the full ZIP a year after the last full one, before the monthly one', () => {
    expect(backupDue(input('2026-11-30', { lastBackup: '2026-11-20', lastFullBackup: '2025-11-30' }))).toBe('full');
  });

  it('never backed up: the first card comes 30 days after first use', () => {
    expect(backupDue(input('2026-01-30', {}))).toBeNull();
    expect(backupDue(input('2026-01-31', {}))).toBe('2026-01');
  });

  it('stays away while Drive has synced in the last 30 days, and comes back when it goes stale', () => {
    const s = { lastBackup: '2026-09-01', lastFullBackup: '2026-01-01' };
    expect(backupDue(input('2026-11-24', s, '2026-11-21'))).toBeNull();
    expect(backupDue(input('2026-11-24', s, '2026-10-24'))).toBe('2026-11');
  });

  it('reads the newer of a backup and a Drive sync', () => {
    expect(backupLine(settings(), null, '2026-11-24')).toBe('No backup yet');
    expect(backupLine(settings({ lastBackup: '2026-11-12' }), null, '2026-11-24')).toBe('Last backup 12 days ago');
    expect(backupLine(settings({ lastBackup: '2026-11-12' }), '2026-11-22', '2026-11-24')).toBe(
      'Synced to Drive 2 days ago',
    );
    expect(backupLine(settings({ lastBackup: '2026-11-24' }), '2026-11-22', '2026-11-24')).toBe('Last backup today');
    expect(backupLine(settings({ lastBackup: '2026-11-23' }), null, '2026-11-24')).toBe('Last backup yesterday');
  });
});

describe('settings file', () => {
  it('keeps reminders and the last full backup', () => {
    const s = settings({
      lastBackup: '2026-11-01',
      lastFullBackup: '2026-01-05',
      reminders: [
        { time: '21:00', on: true },
        { time: '07:30', on: false },
      ],
    });
    expect(parseSettings(serializeSettings(s))).toEqual(s);
  });

  it('reads a 1.17 file: its last backup was a full one, and there are no reminders', () => {
    const old = '---\nformat: journal-v1\nday_starts_at_hour: 4\nlast_backup: 2026-03-02\n---\n';
    const s = parseSettings(old);
    expect(s.lastFullBackup).toBe('2026-03-02');
    expect(s.reminders).toEqual([]);
  });

  it('drops a bad time and keeps at most three', () => {
    const text =
      '---\nreminders:\n  - time: "25:00"\n  - time: "08:00"\n  - time: "12:00"\n  - time: "18:00"\n  - time: "21:00"\n---\n';
    expect(parseSettings(text).reminders.map((r) => r.time)).toEqual(['08:00', '12:00', '18:00']);
  });
});

// ---------- E4: search ----------

describe('search', () => {
  const j: Searchable = {
    days: byDate([
      day('2026-03-14', { title: 'Coffee at the Café Luitpold', writing: 'We talked for hours about Lisbon.' }),
      day('2026-05-02', { title: 'Long run', writing: 'A very long morning, and then the café again with Anna.' }),
      day('2025-12-30', { title: '', writing: '' }),
    ]),
    months: {
      '2026-03': {
        ...emptyMonth('2026-03'),
        highlight: 'The Lisbon trip',
        weeks: { [weekOf('2026-03-14')]: { ...emptyWeek(), highlight: 'Café mornings with Anna' } },
      },
    },
    years: {
      '2025': {
        ...emptyYear('2025'),
        defining: { text: 'Moved to Munich', source: 'custom', month: null, date: '2025-04-01' },
        nextMisogi: { text: 'Walk the Camino to Lisbon', link: null, done: null, doneOn: null },
      },
    },
  };

  it('ignores case and accents', () => {
    expect(fold('Café ÄRGER')).toBe('cafe arger');
    const hits = searchJournal(j, 'cafe').hits.map((h) => h.doc.key);
    expect(hits).toEqual(expect.arrayContaining(['day:2026-03-14', 'day:2026-05-02', `week:${weekOf('2026-03-14')}`]));
  });

  it('needs every word, in any field of the same entry', () => {
    expect(
      searchJournal(j, 'cafe anna')
        .hits.map((h) => h.doc.key)
        .sort(),
    ).toEqual(['day:2026-05-02', `week:${weekOf('2026-03-14')}`].sort());
  });

  it('finds every kind, newest first, and opens the right place', () => {
    const hits = searchJournal(j, 'lisbon').hits;
    // The misogi sorts at the start of its year (it was written at the review before it).
    expect(hits.map((h) => h.doc.kind)).toEqual(['month', 'day', 'misogi']);
    const misogi = hits[2].doc;
    // Written at the 2025 review, it is 2026's misogi.
    expect(misogi.ref).toBe('2026');
    expect(misogi.route).toBe('/past/year/2026');
    expect(hits[0].doc.route).toBe('/months/2026-03');
    expect(searchJournal(j, 'munich').hits[0].doc.route).toBe('/day/2025-04-01');
  });

  it('marks the matches in the original text, accents included', () => {
    const hit = searchJournal(j, 'cafe').hits.find((h) => h.doc.key === 'day:2026-03-14')!;
    const [a, b] = hit.headMarks[0];
    expect(hit.doc.head.text.slice(a, b)).toBe('Café');
    const later = searchJournal(j, 'anna').hits.find((h) => h.doc.key === 'day:2026-05-02')!;
    expect(later.snippet.startsWith('…')).toBe(true);
    const [c, d] = later.snippetMarks[0];
    expect(later.snippet.slice(c, d)).toBe('Anna');
  });

  it('does nothing below two characters, and says when there are more than shown', () => {
    expect(searchJournal(j, ' a ').hits).toEqual([]);
    const many: Searchable = {
      days: byDate(Array.from({ length: 205 }, (_, i) => day(addDays('2026-01-01', i), { title: 'walk' }))),
      months: {},
      years: {},
    };
    const r = searchIndex(buildIndex(many), 'walk');
    expect(r.hits).toHaveLength(200);
    expect(r.more).toBe(true);
    expect(r.hits[0].doc.ref).toBe(addDays('2026-01-01', 204));
  });

  it('gives the same answer from a prepared index as from a direct search', () => {
    const index = buildIndex(j);
    for (const q of ['cafe', 'lisbon', 'anna run', 'xyz']) {
      expect(searchIndex(index, q).hits.map((h) => h.doc.key)).toEqual(searchJournal(j, q).hits.map((h) => h.doc.key));
    }
  });
});

// ---------- E5: reminders ----------

describe('reminder schedule', () => {
  const now = new Date(2026, 10, 24, 18, 0); // 24 Nov 2026, 18:00
  const on = (...times: string[]) => settings({ reminders: times.map((time) => ({ time, on: true })) });

  it('schedules nothing when every reminder is off', () => {
    expect(reminderSchedule(settings({ reminders: [{ time: '21:00', on: false }] }), {}, now)).toEqual([]);
  });

  it('fills the iOS limit: 63 days for one time, 21 days for three', () => {
    const one = reminderSchedule(on('21:00'), {}, now);
    expect(one).toHaveLength(MAX_PENDING);
    expect(one[0].day).toBe('2026-11-24');
    const three = reminderSchedule(on('08:00', '13:00', '21:00'), {}, now);
    expect(three.length).toBeLessThanOrEqual(MAX_PENDING);
    // Today's 08:00 and 13:00 have passed.
    expect(three[0].at.getHours()).toBe(21);
    expect(new Set(three.map((r) => r.day)).size).toBeGreaterThanOrEqual(21);
  });

  it('stays silent on a written day', () => {
    const days = byDate([day('2026-11-24', { writing: 'A quiet day.' }), day('2026-11-25', { title: 'Snow' })]);
    const r = reminderSchedule(on('21:00'), days, now);
    expect(r[0].day).toBe('2026-11-26');
  });

  it('a reminder after midnight belongs to the evening before', () => {
    const days = byDate([day('2026-11-24', { writing: 'Done.' })]);
    const r = reminderSchedule(on('01:00'), days, now);
    // 01:00 on the 25th is still the 24th (the day starts at 04:00), which is written.
    expect(r[0].at.getDate()).toBe(26);
    expect(r[0].day).toBe('2026-11-25');
  });

  it('merges two reminders at the same time', () => {
    const s = settings({
      reminders: [
        { time: '21:00', on: true },
        { time: '21:00', on: true },
      ],
    });
    const r = reminderSchedule(s, {}, now);
    expect(new Set(r.map((x) => x.at.getTime())).size).toBe(r.length);
  });
});

describe('reminder queue', () => {
  it('runs overlapping rebuilds one after the other, so the result is one set', async () => {
    const run = serialQueue();
    let scheduled: string[] = [];
    const gate: (() => void)[] = [];
    const pause = () => new Promise<void>((r) => gate.push(r));
    const rebuild = (tag: string) => async () => {
      scheduled = [];
      await pause();
      scheduled.push(`${tag}-1`);
      await pause();
      scheduled.push(`${tag}-2`);
    };
    const a = run(rebuild('a'));
    const b = run(rebuild('b'));
    // Release every pause as it comes; b may only start once a has finished.
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 0));
      gate.shift()?.();
    }
    await Promise.all([a, b]);
    expect(scheduled).toEqual(['b-1', 'b-2']);
  });

  it('a failed rebuild does not stop the next', async () => {
    const run = serialQueue();
    const seen: string[] = [];
    await expect(
      run(async () => {
        throw new Error('no');
      }),
    ).rejects.toThrow('no');
    await run(async () => void seen.push('ok'));
    expect(seen).toEqual(['ok']);
  });
});

// ---------- E6: weekdays and writing ----------

describe('weekday feelings', () => {
  const today = '2026-11-22'; // a Sunday
  const days: DayEntry[] = [];
  for (let i = 0; i < 70; i++) {
    const d = addDays(today, -i);
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay(); // 0 = Sunday
    days.push(day(d, { feeling: wd === 6 ? 9 : 6 }));
  }

  it('averages each weekday over the last 180 days, from 8 rated days', () => {
    const rows = weekdayFeelings(byDate(days), today);
    expect(rows).toHaveLength(7);
    expect(rows.find((r) => r.name === 'Saturday')!.avg).toBe(9);
    expect(rows.find((r) => r.name === 'Monday')!.avg).toBe(6);
    expect(bestWeekdaySentence(rows)).toBe('Saturdays tend to feel best.');
  });

  it('hides a weekday with fewer than 8 rated days, and says nothing without a clear lead', () => {
    const few = weekdayFeelings(byDate(days.slice(0, 20)), today);
    expect(few.every((r) => r.avg == null)).toBe(true);
    const flat = weekdayFeelings(byDate(days.map((d) => ({ ...d, feeling: 7 }))), today);
    expect(bestWeekdaySentence(flat)).toBeNull();
  });
});

describe('writing stats', () => {
  const days = byDate([
    day('2026-01-10', { title: 'Ten words in the title do not count at all here', writing: 'one two three' }),
    day('2026-03-02', { writing: 'one  two\nthree four   five' }),
    day('2025-07-01', { writing: 'a b c d e f g' }),
    day('2026-03-03', { title: 'Only a title' }),
  ]);

  it('counts the writing only, split on whitespace', () => {
    expect(wordCount('  one  two\nthree ')).toBe(3);
    expect(wordCount('')).toBe(0);
  });

  it('totals months, years and the longest entry', () => {
    const st = writingStats(days, '2026');
    expect(st.months[0].words).toBe(3);
    expect(st.months[2].words).toBe(5);
    expect(st.years).toEqual([
      { year: '2025', words: 7 },
      { year: '2026', words: 8 },
    ]);
    expect(st.longest).toEqual({ date: '2025-07-01', words: 7 });
    expect(st.total).toBe(15);
    expect(wordsInYear(Object.values(days), '2026')).toBe(8);
    expect(writingStats({}, '2026').longest).toBeNull();
  });
});

// ---------- E7: check rates and hobby balance ----------

describe('weekly-check rates', () => {
  const today = '2026-11-30';
  const monthWith = (month: string, checks: [string, string, string], weeks: [string, boolean[]][]): MonthRecord => ({
    ...emptyMonth(month),
    setup: setup(checks),
    weeks: Object.fromEntries(
      weeks.map(([date, done]) => [
        weekOf(date),
        { ...emptyWeek(), closed: true, checks: { check_1: done[0], check_2: done[1], check_3: done[2] } },
      ]),
    ),
  });

  it('goes by the check’s text, so a renamed check starts its own row', () => {
    const oct = monthWith(
      '2026-10',
      ['Travel', 'A novel', 'Memory'],
      [
        ['2026-10-05', [true, false, true]],
        ['2026-10-12', [true, false, true]],
        ['2026-10-19', [false, false, true]],
        ['2026-10-26', [true, true, true]],
      ],
    );
    const nov = monthWith(
      '2026-11',
      ['Travel', 'Poetry', 'Memory'],
      [
        ['2026-11-02', [true, true, false]],
        ['2026-11-09', [false, true, false]],
      ],
    );
    const rows = checkRates([oct, nov], today);
    const by = Object.fromEntries(rows.map((r) => [r.label, r]));
    expect(by.Travel).toEqual({ label: 'Travel', done: 4, weeks: 6 });
    expect(by.Memory).toEqual({ label: 'Memory', done: 4, weeks: 6 });
    expect(by['A novel']).toEqual({ label: 'A novel', done: 1, weeks: 4 });
    // Poetry has two weeks so far: not shown yet.
    expect(by.Poetry).toBeUndefined();
  });

  it('counts only the last 12 closed weeks', () => {
    const weeks: [string, boolean[]][] = Array.from({ length: 16 }, (_, i) => [
      addDays('2026-08-03', i * 7),
      [i >= 4, false, false],
    ]);
    const months = new Map<string, MonthRecord>();
    for (const [date, done] of weeks) {
      const m = date.slice(0, 7);
      const rec = months.get(m) ?? monthWith(m, ['Travel', 'A novel', 'Memory'], []);
      rec.weeks[weekOf(date)] = {
        ...emptyWeek(),
        closed: true,
        checks: { check_1: done[0], check_2: done[1], check_3: done[2] },
      };
      months.set(m, rec);
    }
    const travel = checkRates(months.values(), today).find((r) => r.label === 'Travel')!;
    expect(travel.weeks).toBe(12);
    expect(travel.done).toBe(12);
  });
});

describe('hobby balance', () => {
  it('adds an hour a tick, or the hours recorded, up to today', () => {
    const days = byDate([
      day('2026-11-02', { hobbies: { intellectual: true, physical: true, creative: false, social: false } }),
      day('2026-11-03', {
        hobbies: { intellectual: false, physical: true, creative: false, social: false },
        hobbyHours: { physical: 2.5 },
      }),
      day('2026-11-30', { hobbies: { intellectual: false, physical: false, creative: true, social: false } }),
    ]);
    expect(hobbyBalance('2026-11', '2026-11-24', (d) => days[d])).toEqual({
      intellectual: 1,
      physical: 3.5,
      creative: 0,
      social: 0,
    });
  });
});
