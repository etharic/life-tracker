import { emptyMonth, emptyWeek, emptyYear, type MonthRecord } from '../src/domain/types';
import { parseDay, serializeDay } from '../src/format/day';
import { parseMonth, serializeMonth } from '../src/format/month';
import { classify, dayPath, mediaFile, monthPath } from '../src/format/paths';
import {
  parseAchievements,
  parseBank,
  parseYear,
  serializeAchievements,
  serializeBank,
  serializeYear,
} from '../src/format/records';

const HANDOVER_DAY = `---
format: journal-v1
date: 2026-11-19
title: "Finished the valuation chapter"
feeling: 7
goals:
  health: true
  wealth: true
  wise: false
  versatility: true
hobbies:
  intellectual: true
  physical: false
  creative: true
  social: false
priorities_done: ["Send application"]
---
Free writing goes here, with ![photo](media/2026-11-19-1.jpg)
and [audio](media/2026-11-19-1.m4a) linked by relative path.
`;

describe('day file', () => {
  it('keeps hours on a ticked hobby, and only when more than the hour a tick stands for', () => {
    const d = parseDay(HANDOVER_DAY, '2000-01-01');
    expect(d.hobbyHours).toEqual({});
    d.hobbyHours.creative = 2.5;
    const back = parseDay(serializeDay(d), '2000-01-01');
    expect(back.hobbyHours).toEqual({ creative: 2.5 });
    expect(serializeDay(parseDay(HANDOVER_DAY, '2000-01-01'))).not.toContain('hobby_hours');
  });

  it('reads the handover example', () => {
    const d = parseDay(HANDOVER_DAY, '2000-01-01');
    expect(d.date).toBe('2026-11-19');
    expect(d.title).toBe('Finished the valuation chapter');
    expect(d.feeling).toBe(7);
    expect(d.goals).toEqual({ health: true, wealth: true, wise: false, versatility: true });
    expect(d.hobbies.creative).toBe(true);
    expect(d.prioritiesDone).toEqual(['Send application']);
    expect(d.media).toEqual([
      { kind: 'photo', path: 'media/2026-11-19-1.jpg' },
      { kind: 'audio', path: 'media/2026-11-19-1.m4a' },
    ]);
    expect(d.writing).toContain('Free writing goes here');
  });

  it('round-trips without losing or duplicating anything', () => {
    const d = parseDay(HANDOVER_DAY, '2000-01-01');
    const again = parseDay(serializeDay(d), '2000-01-01');
    expect(again).toEqual(d);
    expect(serializeDay(again)).toBe(serializeDay(d));
  });

  it('keeps attachment lines out of the writing and unknown fields on save', () => {
    const d = parseDay(
      '---\nformat: journal-v1\ndate: 2026-11-20\nmood_v2: calm\n---\nHello\n\n![photo](media/a.jpg)\n',
      'x',
    );
    expect(d.writing).toBe('Hello');
    expect(d.media).toHaveLength(1);
    const out = serializeDay(d);
    expect(out).toContain('mood_v2: calm');
    expect(out.match(/media\/a\.jpg/g)).toHaveLength(1);
  });

  it('survives a damaged file', () => {
    const d = parseDay('no frontmatter at all', '2026-11-21');
    expect(d.date).toBe('2026-11-21');
    expect(d.writing).toBe('no frontmatter at all');
  });
});

describe('month file', () => {
  it('round-trips setup, weeks and the extreme incident', () => {
    const rec: MonthRecord = {
      ...emptyMonth('2026-11'),
      setup: {
        goals: {
          health: { text: 'Dinner before 5 pm', bankId: 'g1' },
          wealth: { text: 'Log every expense', bankId: 'g2' },
          wise: { text: 'Read 20 pages', bankId: 'g3' },
          versatility: { text: 'One new thing', bankId: 'g4' },
        },
        hobbies: {
          intellectual: { text: 'Reading', bankId: 'h1' },
          physical: { text: 'Run 5 km', bankId: 'h2' },
          creative: { text: 'Ukulele', bankId: 'h3' },
          social: { text: 'Museum: visit', bankId: 'h4' },
        },
        priority: 'health',
        priorityKind: 'break',
        skill: 'creative',
        weeklyChecks: { check_1: 'Travel', check_2: 'Read a novel', check_3: 'Memory activity' },
        outlook: 'Finish the valuation chapters,\nland two interviews.',
        extremeThing: 'Run 10 km without stopping',
      },
      extremeDone: true,
      extremeDoneOn: '2026-11-20',
      outlookDone: ['Land two interviews'],
      extremeIncident: { date: '2026-11-14', title: 'Museum day with friends', mark: 'positive' },
      skipped: { 'week-close:2026-W46': 'Travelling' },
    };
    rec.weeks['2026-W45'] = {
      ...emptyWeek(),
      highlight: 'Got the interview invite',
      priorities: [
        { text: 'Send application', done: true },
        { text: 'Plan the museum visit', done: false, carried: true },
      ],
      started: true,
      closed: true,
    };
    const again = parseMonth(serializeMonth(rec), 'x');
    expect(again).toEqual(rec);
  });
});

describe('bank and achievements', () => {
  it('round-trip', () => {
    const bank = parseBank('');
    bank.goals.health.push({ id: 'g1', text: 'In bed by 11 pm', added: '2026-11-01', retired: false });
    bank.hobbies.creative.push({ id: 'h1', text: 'Ukulele', added: '2026-11-01', retired: true });
    expect(parseBank(serializeBank(bank))).toEqual(bank);
    const a = [
      {
        kind: 'skill' as const,
        bankId: 'h1',
        text: 'Ukulele',
        category: 'creative' as const,
        months: ['2026-04', '2026-05', '2026-06'],
        percent: 86,
        earned: '2026-06-30',
      },
    ];
    expect(parseAchievements(serializeAchievements(a))).toEqual(a);
  });
});

describe('paths', () => {
  it('classify what they build', () => {
    expect(classify(dayPath('2026-11-19'))).toEqual({ type: 'day', date: '2026-11-19' });
    expect(classify(monthPath('2026-11'))).toEqual({ type: 'month', month: '2026-11' });
    expect(classify('2026/2026-11/media/x.jpg')).toEqual({ type: 'other' });
  });
});

describe('year file', () => {
  it('keeps the Misogi Ritual with its date, notes, photos and voice notes', () => {
    const y = {
      ...emptyYear('2026'),
      defining: { text: 'Ran 10 km without stopping', source: 'custom' as const, month: null, date: '2026-10-04' },
      notes: 'Rain the whole way.',
      media: [
        { kind: 'photo' as const, path: 'media/misogi-1.jpg' },
        { kind: 'audio' as const, path: 'media/misogi-2.m4a' },
      ],
      reviewed: true,
    };
    const back = parseYear(serializeYear(y), '2000');
    expect(back.defining).toEqual(y.defining);
    expect(back.notes).toBe('Rain the whole way.');
    expect(back.media).toEqual(y.media);
    expect(back.reviewed).toBe(true);
    expect(mediaFile('2026', 'media/misogi-1.jpg')).toBe('2026/media/misogi-1.jpg');
  });
  it('treats a recorded Misogi Ritual in an older file as reviewed', () => {
    const old =
      '---\nformat: journal-v1\nyear: "2025"\ndefining_incident:\n  text: Moved to a new city\n  source: custom\n---\nThe defining incident of 2025.\n';
    const y = parseYear(old, '2025');
    expect(y.reviewed).toBe(true);
    expect(y.notes).toBe('');
  });
});

describe('week commitments', () => {
  it('keeps priorities and ordinary commitments apart; older files read as priorities', () => {
    const m = emptyMonth('2026-11');
    m.weeks['2026-W47'] = {
      ...emptyWeek(),
      priorities: [
        { text: 'Draft the cover letter', done: false },
        { text: 'Water the plants', done: false, plain: true },
      ],
    };
    const text = serializeMonth(m);
    expect(text).toContain('priority: false');
    expect(parseMonth(text, '2026-11').weeks['2026-W47'].priorities).toEqual(m.weeks['2026-W47'].priorities);
  });
});
