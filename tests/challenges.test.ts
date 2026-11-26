import { challengeCounts, emptyChallenges, type ChallengeItem } from '../src/domain/types';
import { CHALLENGE_FILES, classify } from '../src/format/paths';
import { parseChallenges, serializeChallenges } from '../src/format/records';

const list: ChallengeItem[] = [
  {
    id: 'r1',
    title: 'Applied to the summer internship',
    date: '2026-11-02',
    started: true,
    outcome: 'failed',
    notes: 'Asked for feedback.\n\nThey said: more modelling.',
    added: '2026-11-02',
  },
  {
    id: 'r2',
    title: 'Asked for a discount',
    date: null,
    started: true,
    outcome: 'succeeded',
    notes: '',
    added: '2026-11-05',
  },
  {
    id: 'r3',
    title: 'Cold email to a professor',
    date: null,
    started: true,
    outcome: 'open',
    notes: '',
    added: '2026-11-20',
  },
  { id: 'r4', title: 'Pitch a talk', date: null, started: false, outcome: 'open', notes: '', added: '2026-11-21' },
];

describe('challenge lists', () => {
  it('knows both files', () => {
    expect(classify(CHALLENGE_FILES.rejections)).toEqual({ type: 'challenges', kind: 'rejections' });
    expect(classify(CHALLENGE_FILES.bucket)).toEqual({ type: 'challenges', kind: 'bucket' });
  });

  it('round-trips items: started, outcome, optional date and notes', () => {
    const text = serializeChallenges('bucket', list);
    expect(parseChallenges(text)).toEqual(list);
    expect(text).not.toContain('date: null');
    expect(text).toContain('started: false');
  });

  it('counts total, active, failed and succeeded', () => {
    expect(challengeCounts(list)).toEqual({ total: 4, active: 1, failed: 1, succeeded: 1 });
  });

  it('reads 1.10 files: waiting / rejected / accepted, everything logged counted as started', () => {
    const text = [
      '---',
      'format: journal-v1',
      'items:',
      '  - id: a',
      '    title: A',
      '    outcome: waiting',
      '  - id: b',
      '    title: B',
      '    outcome: rejected',
      '  - id: c',
      '    title: C',
      '    outcome: accepted',
      '  - id: d',
      '    title: ""',
      '---',
      '',
    ].join('\n');
    const parsed = parseChallenges(text);
    expect(parsed.map((p) => [p.id, p.started, p.outcome])).toEqual([
      ['a', true, 'open'],
      ['b', true, 'failed'],
      ['c', true, 'succeeded'],
    ]);
  });
});

describe('experiments list', () => {
  it('has its own file, read and written like the other lists', () => {
    expect(classify('challenges/experiments.md')).toEqual({ type: 'challenges', kind: 'experiments' });
    const list: ChallengeItem[] = [
      {
        id: 'e1',
        title: 'No phone for the first hour',
        date: null,
        started: true,
        outcome: 'open',
        notes: '24 November 2026: slept better',
        added: '2026-11-24',
      },
    ];
    expect(parseChallenges(serializeChallenges('experiments', list))).toEqual(list);
    expect(emptyChallenges().experiments).toEqual([]);
  });
});
