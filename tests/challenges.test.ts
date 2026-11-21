import {
  emptyDay,
  emptyMonth,
  emptyYear,
  rejectionCounts,
  type MonthRecord,
  type Rejection,
} from '../src/domain/types';
import { docName, monthDocHtml, rejectionsDocHtml } from '../src/export/month-doc';
import { classify, REJECTIONS } from '../src/format/paths';
import { parseRejections, serializeRejections } from '../src/format/records';

const list: Rejection[] = [
  {
    id: 'r1',
    title: 'Applied to the summer internship',
    date: '2026-11-02',
    outcome: 'rejected',
    notes: 'Asked for feedback.\n\nThey said: more modelling.',
    added: '2026-11-02',
  },
  { id: 'r2', title: 'Asked for a discount', date: null, outcome: 'accepted', notes: '', added: '2026-11-05' },
  { id: 'r3', title: 'Cold email to a professor', date: null, outcome: 'waiting', notes: '', added: '2026-11-20' },
];

describe('rejection list', () => {
  it('round-trips the file, notes and optional date included', () => {
    expect(classify(REJECTIONS)).toEqual({ type: 'rejections' });
    const text = serializeRejections(list);
    expect(parseRejections(text)).toEqual(list);
    expect(text).not.toContain('date: null');
  });

  it('counts logged, rejected and successful', () => {
    expect(rejectionCounts(list)).toEqual({ total: 3, rejected: 1, accepted: 1 });
  });

  it('reads an unknown outcome as waiting and skips items without a title', () => {
    const text = `---\nformat: journal-v1\nitems:\n  - id: a\n    title: X\n    outcome: maybe\n  - id: b\n    title: ""\n---\n`;
    const parsed = parseRejections(text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].outcome).toBe('waiting');
  });

  it('becomes one readable document', () => {
    const html = rejectionsDocHtml(list);
    expect(html).toContain('3 attempts logged · 1 rejected · 1 successful');
    expect(html).toContain('They said: more modelling.');
  });
});

describe('monthly Drive documents', () => {
  it('names documents so Drive sorts them by month', () => {
    expect(docName('2024-05')).toBe('05 May 2024');
  });

  it('writes the days in order with goals, hobbies, feeling and writing', () => {
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
          social: { text: 'Museum visit', bankId: 'h4' },
        },
        priority: 'health',
        priorityKind: 'build',
        skill: 'creative',
        weeklyChecks: { check_1: 'Travel', check_2: 'A novel', check_3: 'Memory' },
        outlook: 'Land two interviews, keep the dinner rule',
        extremeThing: 'Run 10 km',
      },
      extremeDone: true,
      extremeDoneOn: '2026-11-18',
      outlookDone: ['Land two interviews'],
    };
    const late = { ...emptyDay('2026-11-21'), title: 'Long walk', writing: 'It rained & I <loved> it.' };
    const early = { ...emptyDay('2026-11-03'), feeling: 7 };
    early.goals.health = true;
    early.hobbies.creative = true;
    early.hobbyHours = { creative: 1.5 };
    const empty = emptyDay('2026-11-10');
    const html = monthDocHtml({ month: '2026-11', rec, days: [late, empty, early] })!;
    expect(html).toContain('<h1>November 2026</h1>');
    expect(html.indexOf('Tuesday 3 November')).toBeLessThan(html.indexOf('Saturday 21 November'));
    expect(html).not.toContain('Tuesday 10 November');
    expect(html).toContain('Goals 1 of 4: Dinner before 5 pm');
    expect(html).toContain('Ukulele 1.5 h');
    expect(html).toContain('It rained &amp; I &lt;loved&gt; it.');
    expect(html).toContain('done on 18 Nov');
    expect(html).toContain('&#10003; Land two interviews');
  });

  it('is skipped for a month with nothing in it, and carries the Misogi Ritual', () => {
    expect(monthDocHtml({ month: '2026-08', rec: undefined, days: [] })).toBeNull();
    const y = {
      ...emptyYear('2026'),
      defining: { text: 'Ran the marathon', source: 'custom' as const, month: null, date: null },
    };
    expect(monthDocHtml({ month: '2026-12', rec: undefined, days: [], misogi: y })).toContain('Ran the marathon');
  });
});
