import { activeChallenges, monthHighlightRows, plusPlace } from '../src/domain/lists';
import { emptyChallenges, emptyMonth, type ChallengeItem, type MonthRecord } from '../src/domain/types';

const month = (id: string, patch: Partial<MonthRecord> = {}): MonthRecord => ({ ...emptyMonth(id), ...patch });
const item = (patch: Partial<ChallengeItem> = {}): ChallengeItem => ({
  id: 'x1',
  title: 'A challenge',
  date: null,
  started: true,
  outcome: 'open',
  notes: '',
  added: '2026-11-01',
  ...patch,
});

describe('Month highlights, good or bad', () => {
  it('lists each month newest first, its closing highlight before its extreme incident', () => {
    const rows = monthHighlightRows([
      month('2026-10', { highlight: 'October line', highlightFromWeek: '2026-W42' }),
      month('2026-11', {
        highlight: 'November line',
        extremeIncident: { date: '2026-11-03', title: 'Lost the bike', mark: 'negative' },
      }),
    ]);
    expect(rows.map((r) => `${r.month}/${r.kind}`)).toEqual([
      '2026-11/highlight',
      '2026-11/incident',
      '2026-10/highlight',
    ]);
    expect(rows[2]).toMatchObject({ text: 'October line', fromWeek: '2026-W42' });
  });

  it('keeps a month with only an incident, a bad one included, and leaves out an empty month', () => {
    const rows = monthHighlightRows([
      month('2026-09'),
      month('2026-08', { highlight: '   ' }),
      month('2026-07', { extremeIncident: { date: '2026-07-14', title: '', mark: 'negative' } }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ month: '2026-07', kind: 'incident', incident: { mark: 'negative' } });
  });

  it('counts both kinds together, which is the number Look back shows', () => {
    const rows = monthHighlightRows([
      month('2026-11', { highlight: 'a', extremeIncident: { date: '2026-11-03', title: 'b', mark: 'positive' } }),
      month('2026-10', { highlight: 'c' }),
    ]);
    expect(rows).toHaveLength(3);
  });
});

describe('challenges under way', () => {
  it('takes only started, open items from every list, newest first', () => {
    const c = emptyChallenges();
    c.rejections = [item({ id: 'r1', date: '2026-11-20' }), item({ id: 'r2', outcome: 'failed' })];
    c.bucket = [item({ id: 'b1', started: false }), item({ id: 'b2', added: '2026-11-25' })];
    c.experiments = [item({ id: 'e1', date: '2026-11-17' })];
    expect(activeChallenges(c).map((a) => `${a.kind}/${a.item.id}`)).toEqual([
      'bucket/b2',
      'rejections/r1',
      'experiments/e1',
    ]);
  });

  it('is empty when nothing is under way', () => {
    expect(activeChallenges(emptyChallenges())).toEqual([]);
  });
});

describe('the + on This week’s commitments never takes a line of its own', () => {
  it('sits on the "n done" line when some are done', () => {
    expect(plusPlace({ interactive: true, adding: false, shown: 3, folded: 2 })).toBe('done-line');
    expect(plusPlace({ interactive: true, adding: false, shown: 0, folded: 5 })).toBe('done-line');
  });

  it('sits at the end of the last item when none are done yet', () => {
    expect(plusPlace({ interactive: true, adding: false, shown: 4, folded: 0 })).toBe('last-item');
  });

  it('takes a line only for an empty list or while a new line is typed', () => {
    expect(plusPlace({ interactive: true, adding: false, shown: 0, folded: 0 })).toBe('own-line');
    expect(plusPlace({ interactive: true, adding: true, shown: 3, folded: 2 })).toBe('own-line');
  });

  it('is not there on a past week', () => {
    expect(plusPlace({ interactive: false, adding: false, shown: 3, folded: 0 })).toBe('none');
  });
});
