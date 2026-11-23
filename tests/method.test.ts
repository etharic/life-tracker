import * as fs from 'fs';
import * as path from 'path';

import { bookNote } from '../src/domain/book-rules';
import { monthSuggestions, weekSuggestions, yearSuggestions } from '../src/domain/chain';
import {
  activateQuestion,
  forwardDeadline,
  forwardWindowOpen,
  isSealed,
  misogiFor,
  outcomeQuestion,
  planLine,
  sittingSteps,
  unjudgedMisogi,
  unsealDate,
} from '../src/domain/misogi';
import { goodDayPatterns, onThisDay } from '../src/domain/patterns';
import { duePrompts } from '../src/domain/prompts';
import { parseMarker, routeTakes } from '../src/domain/takes';
import {
  DEFAULT_SETTINGS,
  emptyDay,
  emptyMonth,
  emptyWeek,
  emptyYear,
  type ChallengeItem,
  type DayEntry,
  type ListLink,
  type MonthRecord,
  type YearRecord,
} from '../src/domain/types';
import { parseMonth, serializeMonth } from '../src/format/month';
import { parseYear, serializeYear } from '../src/format/records';
import { definingFrom } from '../src/features/year/defining';
import { monthWithDefaults, yearWithDefaults } from '../src/storage/cache-shape';
import * as anchorMonth from './fixtures/anchor-1.15.1/src/format/month';
import * as anchorRecords from './fixtures/anchor-1.15.1/src/format/records';

// ---------- helpers ----------

function year(y: string, patch: Partial<YearRecord> = {}): YearRecord {
  return { ...emptyYear(y), ...patch };
}

const link = (patch: Partial<ListLink> = {}): ListLink => ({
  kind: 'bucket',
  id: 'b1',
  confirmed: null,
  outcomeConfirmed: null,
  ...patch,
});

const item = (patch: Partial<ChallengeItem> = {}): ChallengeItem => ({
  id: 'b1',
  title: 'Climb a 4,000 m peak',
  date: null,
  started: false,
  outcome: 'open',
  notes: '',
  added: '2026-01-01',
  ...patch,
});

/** 2026 reviewed with a 2027 misogi and a sealed note. */
function reviewed2026(patch: Partial<YearRecord> = {}): YearRecord {
  return year('2026', {
    reviewed: true,
    reviewedOn: '2026-12-25',
    defining: { text: 'Moved to Lisbon', source: 'custom', month: null, date: null },
    nextMisogi: { text: 'Climb a 4,000 m peak', link: link(), done: null, doneOn: null },
    sealedNote: { path: 'media/sealed-2026.m4a', sealedUntil: '2027-12-25' },
    ...patch,
  });
}

// ---------- the file format ----------

describe('year file: misogi, sealed note, defining_from', () => {
  it('round-trips every new key, top level, and keeps the note out of the attachment lines', () => {
    const y = reviewed2026({ definingFrom: '2026-07' });
    const text = serializeYear(y);
    expect(text).toMatch(/^next_misogi:/m);
    expect(text).toMatch(/^sealed_note:/m);
    expect(text).toMatch(/^defining_from:/m);
    expect(text).toMatch(/^reviewed_on: 2026-12-25/m);
    expect(text).not.toContain('](media/sealed-2026.m4a)');
    const back = parseYear(text, '2000');
    expect(back.nextMisogi).toEqual(y.nextMisogi);
    expect(back.sealedNote).toEqual(y.sealedNote);
    expect(back.definingFrom).toBe('2026-07');
    expect(back.reviewedOn).toBe('2026-12-25');
    expect(back.media).toEqual([]);
  });

  it('reads an older file unchanged, with none of the new fields', () => {
    const old =
      '---\nformat: journal-v1\nyear: "2025"\ndefining_incident:\n  text: First marathon\n  source: custom\n---\n';
    const y = parseYear(old, '2025');
    expect(y.defining?.text).toBe('First marathon');
    expect(y.nextMisogi).toBeNull();
    expect(y.sealedNote).toBeNull();
    expect(y.definingFrom).toBeNull();
    expect(y.reviewed).toBe(true);
  });

  it('keeps a judged misogi and its done date', () => {
    const y = reviewed2026();
    y.nextMisogi!.done = true;
    y.nextMisogi!.doneOn = '2027-08-14';
    y.nextMisogi!.link!.outcomeConfirmed = true;
    expect(parseYear(serializeYear(y), '2000').nextMisogi).toEqual(y.nextMisogi);
  });
});

function monthWithEverything(): MonthRecord {
  const m = emptyMonth('2026-11');
  m.weeks['2026-W46'] = { ...emptyWeek(), highlight: 'Got the interview invite', closed: true };
  m.weekHighlightFrom['2026-W46'] = '2026-11-12';
  m.highlight = 'Got the interview invite';
  m.highlightFromWeek = '2026-W46';
  m.kevinLink = { kind: 'rejections', id: 'r4', confirmed: null, outcomeConfirmed: true };
  return m;
}

describe('month file: highlight, its sources, Kevin’s Rule link', () => {
  it('round-trips the new keys at the top level', () => {
    const m = monthWithEverything();
    const text = serializeMonth(m);
    for (const k of ['highlight', 'highlight_from_week', 'week_highlight_from', 'kevin_link'])
      expect(text).toMatch(new RegExp(`^${k}:`, 'm'));
    const back = parseMonth(text, '2000-01');
    expect(back.highlight).toBe(m.highlight);
    expect(back.highlightFromWeek).toBe('2026-W46');
    expect(back.weekHighlightFrom).toEqual({ '2026-W46': '2026-11-12' });
    expect(back.kevinLink).toEqual(m.kevinLink);
  });

  it('reads an older month with empty new fields', () => {
    const back = parseMonth('---\nformat: journal-v1\nmonth: 2025-03\n---\n', '2025-03');
    expect(back.highlight).toBe('');
    expect(back.kevinLink).toBeNull();
    expect(back.weekHighlightFrom).toEqual({});
  });
});

describe('going back to the anchor (1.15.1) loses nothing', () => {
  it('a year file saved again by 1.15.1 keeps every new key', () => {
    const y = reviewed2026({ definingFrom: '2026-07' });
    const resaved = anchorRecords.serializeYear(anchorRecords.parseYear(serializeYear(y), '2026'));
    const back = parseYear(resaved, '2000');
    expect(back.nextMisogi).toEqual(y.nextMisogi);
    expect(back.sealedNote).toEqual(y.sealedNote);
    expect(back.definingFrom).toBe('2026-07');
    expect(back.reviewedOn).toBe('2026-12-25');
    expect(back.defining).toEqual(y.defining);
  });

  it('a month file saved again by 1.15.1 keeps every new key', () => {
    const m = monthWithEverything();
    const resaved = anchorMonth.serializeMonth(anchorMonth.parseMonth(serializeMonth(m), '2026-11'));
    const back = parseMonth(resaved, '2000-01');
    expect(back.highlight).toBe(m.highlight);
    expect(back.highlightFromWeek).toBe(m.highlightFromWeek);
    expect(back.weekHighlightFrom).toEqual(m.weekHighlightFrom);
    expect(back.kevinLink).toEqual(m.kevinLink);
  });
});

// ---------- the misogi rules ----------

describe('misogi dates', () => {
  it('stores year Y’s misogi in the file of Y-1, and its note opens next 25 December', () => {
    const years = { '2026': reviewed2026() };
    expect(misogiFor(years, '2027')?.text).toBe('Climb a 4,000 m peak');
    expect(misogiFor(years, '2026')).toBeNull();
    expect(unsealDate('2026')).toBe('2027-12-25');
  });

  it('seals until its date, and opens on that journal date', () => {
    const note = { path: 'media/sealed-2026.m4a', sealedUntil: '2027-12-25' };
    expect(isSealed(note, '2027-12-24')).toBe(true);
    expect(isSealed(note, '2027-12-25')).toBe(false);
    expect(isSealed(note, '2028-01-02')).toBe(false);
  });

  it('keeps the forward step open until 31 January or 7 days after the sitting, whichever is later', () => {
    expect(forwardDeadline(reviewed2026())).toBe('2027-01-31');
    expect(forwardDeadline(reviewed2026({ reviewedOn: '2027-01-29' }))).toBe('2027-02-05');
    expect(forwardDeadline(reviewed2026({ reviewedOn: null }))).toBe('2027-01-31');
    const rec = reviewed2026();
    expect(forwardWindowOpen(rec, '2026', '2027-01-31')).toBe(true);
    expect(forwardWindowOpen(rec, '2026', '2027-02-01')).toBe(false);
    // Before the review, the forward step is part of the sitting.
    expect(forwardWindowOpen(year('2026'), '2026', '2026-12-25')).toBe(true);
    expect(forwardWindowOpen(year('2026'), '2026', '2026-12-24')).toBe(false);
  });
});

describe('the sitting', () => {
  it('starts at the defining moment in the first year', () => {
    expect(sittingSteps({}, '2026', '2026-12-25')).toEqual(['defining', 'next', 'seal']);
  });

  it('plays last year’s note first, then judges its misogi', () => {
    expect(sittingSteps({ '2026': reviewed2026() }, '2027', '2027-12-25')).toEqual([
      'note',
      'judge',
      'defining',
      'next',
      'seal',
    ]);
  });

  it('leaves the note out until its date (an early review)', () => {
    expect(sittingSteps({ '2026': reviewed2026() }, '2027', '2027-12-20')).toEqual([
      'judge',
      'defining',
      'next',
      'seal',
    ]);
  });

  it('opens a review for a year with no setup when a misogi or note is waiting', () => {
    const prompts = duePrompts({
      today: '2027-12-25',
      months: new Map(),
      years: new Map([['2026', reviewed2026()]]),
      settings: { ...DEFAULT_SETTINGS, firstUse: '2027-12-20', lastBackup: '2027-12-20' },
    });
    expect(prompts.some((p) => p.kind === 'year-close' && p.ref === '2027')).toBe(true);
  });
});

describe('the Plan line', () => {
  const years = { '2026': reviewed2026() };

  it('says the misogi starts on 1 January before its year', () => {
    expect(planLine(years, '2026-12-28', false)).toMatchObject({ year: '2027', state: 'upcoming', daysLeft: 4 });
  });

  it('counts the days left during its year', () => {
    expect(planLine(years, '2027-12-20', false)).toMatchObject({ year: '2027', state: 'active', daysLeft: 12 });
    expect(planLine(years, '2027-01-01', false)).toMatchObject({ state: 'active', daysLeft: 365 });
  });

  it('asks from 26 December when not judged, and stays hidden while the year card shows', () => {
    expect(planLine(years, '2027-12-26', false)).toMatchObject({ state: 'ask' });
    expect(planLine(years, '2027-12-26', true)).toBeNull();
  });

  it('keeps asking after its year when the review was skipped', () => {
    expect(planLine(years, '2028-01-10', false)).toMatchObject({ year: '2027', state: 'ask' });
  });

  it('reads done once marked early, and goes once judged and over', () => {
    const done = { '2026': reviewed2026({ nextMisogi: { text: 'x', link: null, done: true, doneOn: '2027-06-01' } }) };
    expect(planLine(done, '2027-07-01', false)).toMatchObject({ state: 'done' });
    expect(planLine(done, '2028-01-10', false)).toBeNull();
    expect(unjudgedMisogi(done, '2027-07-01')).toBeNull();
    expect(unjudgedMisogi(years, '2027-07-01')?.year).toBe('2027');
  });

  it('shows nothing without a misogi', () => {
    expect(planLine({}, '2027-03-01', false)).toBeNull();
  });
});

describe('one-tap list questions (nothing changes without a confirm)', () => {
  it('asks "Mark it active?" once, only for a not-started bucket item', () => {
    expect(activateQuestion(link(), item())?.answers[0].patch).toEqual({ started: true });
    expect(activateQuestion(link({ confirmed: false }), item())).toBeNull();
    expect(activateQuestion(link(), item({ started: true }))).toBeNull();
    expect(activateQuestion(link({ kind: 'rejections' }), item())).toBeNull();
  });

  it('asks nothing for a deleted item', () => {
    expect(activateQuestion(link(), undefined)).toBeNull();
    expect(outcomeQuestion(link(), undefined, true)).toBeNull();
  });

  it('done: offers Done on the bucket list, asked once', () => {
    const q = outcomeQuestion(link(), item({ started: true }), true);
    expect(q?.answers.map((a) => a.patch)).toEqual([{ started: true, outcome: 'succeeded' }, null]);
    expect(outcomeQuestion(link({ outcomeConfirmed: true }), item(), true)).toBeNull();
  });

  it('not done: never fails a lifetime goal; asks to keep it active only if it is', () => {
    expect(outcomeQuestion(link(), item(), false)).toBeNull();
    const q = outcomeQuestion(link(), item({ started: true }), false);
    expect(q?.answers.map((a) => a.patch)).toEqual([null, { started: false }]);
  });

  it('a rejection item asks rejected, successful or not yet; not done asks nothing', () => {
    const r = link({ kind: 'rejections', id: 'r1' });
    const q = outcomeQuestion(r, item({ id: 'r1' }), true);
    expect(q?.answers.map((a) => a.patch)).toEqual([
      { started: true, outcome: 'failed' },
      { started: true, outcome: 'succeeded' },
      { started: true },
    ]);
    expect(outcomeQuestion(r, item({ id: 'r1' }), false)).toBeNull();
  });
});

describe('a crash while recording the sealed note', () => {
  it('returns the take to the sealed note, never to a day', () => {
    const takes = [
      { uri: 'a', modified: 1000 },
      { uri: 'b', modified: 5000 },
      { uri: 'c', modified: 6000 },
    ];
    const route = routeTakes(takes, { year: '2026', started: 4000 });
    expect(route.toDays.map((t) => t.uri)).toEqual(['a']);
    expect(route.toSealed?.uri).toBe('c');
    expect(route.discard.map((t) => t.uri)).toEqual(['b']);
  });

  it('attaches takes to their days when no sealed note was recording', () => {
    expect(routeTakes([{ uri: 'a', modified: 1 }], null)).toEqual({
      toDays: [{ uri: 'a', modified: 1 }],
      toSealed: null,
      discard: [],
    });
  });

  it('reads only a valid marker', () => {
    expect(parseMarker('{"year":"2026","started":12}')).toEqual({ year: '2026', started: 12 });
    expect(parseMarker('nonsense')).toBeNull();
    expect(parseMarker(null)).toBeNull();
  });
});

describe('books and the sealed note', () => {
  const years = { '2026': reviewed2026() };
  it('appears only in the book of the year it opens, made on or after that day', () => {
    expect(bookNote(years, '2027', '2027-12-25')?.file).toBe('2026/media/sealed-2026.m4a');
    expect(bookNote(years, '2027', '2027-12-24')).toBeNull();
    expect(bookNote(years, '2026', '2027-12-30')).toBeNull();
    expect(bookNote(years, '2028', '2028-12-30')).toBeNull();
  });
});

// ---------- the chain ----------

function day(date: string, title: string, f: number | null = 7, patch: Partial<DayEntry> = {}): DayEntry {
  return { ...emptyDay(date), title, feeling: f, ...patch };
}

describe('suggest, never force', () => {
  it('the week offers its day titles with their feeling', () => {
    const days = { '2026-11-12': day('2026-11-12', 'Interview invite', 8), '2026-11-13': day('2026-11-13', '') };
    const items = weekSuggestions('2026-W46', days);
    expect(items.map((i) => i.text)).toEqual(['Interview invite']);
    expect(items[0].key).toBe('day:2026-11-12');
    expect(items[0].spoken).toBe('felt Great');
  });

  it('the month offers its week highlights', () => {
    expect(monthSuggestions('2026-11', monthWithEverything()).map((i) => i.key)).toEqual(['week:2026-W46']);
  });

  it('the year offers month highlights, Kevin’s Rules and incidents; a pick keeps its source', () => {
    const m = monthWithEverything();
    const items = yearSuggestions('2026', { '2026-11': m }, {});
    expect(items.map((i) => i.key)).toEqual(['month:2026-11']);
    const picked = definingFrom('Got the interview invite', 'month:2026-11', { '2026-11': m }, null);
    expect(picked.defining?.source).toBe('custom');
    expect(picked.from).toBe('2026-11');
    // Reworded: the link is dropped.
    expect(definingFrom('Got the job', 'month:2026-11', { '2026-11': m }, null).from).toBeNull();
  });
});

// ---------- Look back: on this day, good-day patterns ----------

describe('on this day', () => {
  it('shows earlier years on the same journal date, newest first, and only days with something', () => {
    const days = {
      '2025-03-01': day('2025-03-01', 'Snow in the city'),
      '2024-03-01': day('2024-03-01', 'First day at work'),
      '2023-03-01': { ...emptyDay('2023-03-01') },
    };
    expect(onThisDay(days, '2026-03-01').map((d) => d.date)).toEqual(['2025-03-01', '2024-03-01']);
  });

  it('matches 29 February only in leap years', () => {
    const days = { '2024-02-29': day('2024-02-29', 'Leap day'), '2024-02-28': day('2024-02-28', 'Before') };
    expect(onThisDay(days, '2028-02-29').map((d) => d.date)).toEqual(['2024-02-29']);
    expect(onThisDay(days, '2027-02-28').map((d) => d.date)).toEqual(['2024-02-28']);
  });
});

/** n days back from 2026-06-30, each built by `make(i)`. */
function series(n: number, make: (i: number) => Partial<DayEntry>): Record<string, DayEntry> {
  const out: Record<string, DayEntry> = {};
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(2026, 5, 30 - i)).toISOString().slice(0, 10);
    out[d] = { ...emptyDay(d), feeling: 5, ...make(i) };
  }
  return out;
}

const physical = (on: boolean) => ({ ...emptyDay('x').hobbies, physical: on });

describe('good-day patterns', () => {
  it('says nothing below 30 days with a feeling', () => {
    const days = series(29, (i) => ({ hobbies: physical(i % 2 === 0), feeling: i % 2 === 0 ? 9 : 3 }));
    expect(goodDayPatterns(days, '2026-06-30')).toEqual([]);
  });

  it('needs 10 days on each side', () => {
    const days = series(40, (i) => ({ hobbies: physical(i < 9), feeling: i < 9 ? 9 : 4 }));
    expect(goodDayPatterns(days, '2026-06-30').find((p) => p.signal === 'hobby-physical')).toBeUndefined();
  });

  it('shows a difference of exactly one point, worded as a pattern', () => {
    const days = series(40, (i) => ({ hobbies: physical(i % 2 === 0), feeling: i % 2 === 0 ? 7 : 6 }));
    const p = goodDayPatterns(days, '2026-06-30');
    expect(p).toHaveLength(1);
    expect(p[0].sentence).toBe('Days you did your Physical hobby felt better: Good on average, against All right.');
  });

  it('ignores days without a feeling, and shows at most two lines, largest first', () => {
    const days = series(60, (i) => ({
      hobbies: physical(i % 2 === 0),
      writing: i % 3 === 0 ? 'wrote' : '',
      media: i % 4 === 0 ? [{ kind: 'photo' as const, path: 'p.jpg' }] : [],
      feeling: i >= 50 ? null : (i % 2 === 0 ? 8 : 4) + (i % 3 === 0 ? 1 : 0),
    }));
    const p = goodDayPatterns(days, '2026-06-30');
    expect(p.length).toBeLessThanOrEqual(2);
    expect(p[0].signal).toBe('hobby-physical');
    expect(p[0].withDays + p[0].withoutDays).toBe(50);
  });
});

// ---------- names ----------

describe('one set of names', () => {
  it('no screen, book or README still says "Misogi Ritual"', () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(e.name) && fs.readFileSync(p, 'utf8').includes('Misogi Ritual')) hits.push(p);
      }
    };
    walk(path.join(__dirname, '..', 'src'));
    expect(hits).toEqual([]);
  });
});

// ---------- records cached by an older version ----------

describe('records cached by 1.16 (before the method fields)', () => {
  it('a cached month without the new fields can still be saved (Start the week crashed on this)', () => {
    const old = { ...emptyMonth('2026-11') } as Partial<MonthRecord>;
    delete old.weekHighlightFrom;
    delete old.highlight;
    delete old.highlightFromWeek;
    delete old.kevinLink;
    const m = monthWithDefaults(old as MonthRecord);
    m.weeks['2026-W48'] = { ...emptyWeek(), started: true };
    expect(() => serializeMonth(m)).not.toThrow();
    expect(m.weekHighlightFrom).toEqual({});
    expect(m.highlight).toBe('');
  });

  it('a cached year without the new fields reads as having none', () => {
    const old = { ...emptyYear('2026') } as Partial<YearRecord>;
    delete old.nextMisogi;
    delete old.sealedNote;
    const y = yearWithDefaults(old as YearRecord);
    expect(y.nextMisogi).toBeNull();
    expect(() => serializeYear(y)).not.toThrow();
  });
});
