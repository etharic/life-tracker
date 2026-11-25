import { recapSlides } from '../src/domain/recap';
import { emptyDay, emptyMonth, type ChallengeItem, type DayEntry, type ISODate } from '../src/domain/types';

const day = (date: ISODate, patch: Partial<DayEntry> = {}): DayEntry => ({ ...emptyDay(date), ...patch });
const byDate = (list: DayEntry[]) => Object.fromEntries(list.map((d) => [d.date, d]));
const none = { rejections: [] as ChallengeItem[], bucket: [] as ChallengeItem[] };
const item = (patch: Partial<ChallengeItem>): ChallengeItem => ({
  id: Math.random().toString(36).slice(2),
  title: 'x',
  date: null,
  started: true,
  outcome: 'open',
  notes: '',
  added: '2026-01-01',
  ...patch,
});

describe('recap cards', () => {
  test('an empty month says so on one card and stops', () => {
    const s = recapSlides(
      { kind: 'month', month: '2026-11' },
      { days: {}, months: {}, challenges: none, today: '2026-11-30' },
    );
    expect(s.map((x) => x.key)).toEqual(['intro']);
    expect(s[0].line).toMatch(/quiet/);
  });

  test('a month with writing, feelings, goals and hobbies', () => {
    const goals = { health: true, wealth: false, wise: true, versatility: false };
    const days = byDate([
      day('2026-11-01', { title: 'Hike', feeling: 9, writing: 'one two three', goals }),
      day('2026-11-02', { feeling: 5, writing: 'one', goals: { ...goals, wise: false } }),
      day('2026-11-03', {
        feeling: 7,
        hobbies: { intellectual: false, physical: true, creative: false, social: false },
        hobbyHours: { physical: 2.5 },
      }),
      // Outside the month: not counted.
      day('2026-10-31', { feeling: 0, writing: 'a b c d e f' }),
    ]);
    const s = recapSlides(
      { kind: 'month', month: '2026-11' },
      { days, months: { '2026-11': emptyMonth('2026-11') }, challenges: none, today: '2026-11-30' },
    );
    const by = Object.fromEntries(s.map((x) => [x.key, x]));
    expect(by.intro.line).toBe('3 days in the journal.');
    expect(by.run.big).toBe('3 days');
    expect(by.words.big).toBe('4 words');
    expect(by.feeling.big).toBe('Good');
    expect(by.feeling.feeling).toBe(7);
    expect(by.best.big).toBe('Hike');
    expect(by.best.feeling).toBe(9);
    expect(by.goals.big).toBe('3');
    expect(by.goals.line).toMatch(/Health, 2 days/);
    expect(by.hobbies.big).toBe('2.5 hours');
  });

  test('days after today are left out', () => {
    const days = byDate([day('2026-11-01', { title: 'a' }), day('2026-11-20', { title: 'b' })]);
    const s = recapSlides(
      { kind: 'month', month: '2026-11' },
      { days, months: {}, challenges: none, today: '2026-11-10' },
    );
    expect(s[0].line).toBe('1 day in the journal.');
  });

  test('a year counts its attempts and bucket list wins', () => {
    const days = byDate([day('2026-03-01', { title: 'a' })]);
    const challenges = {
      rejections: [
        item({ outcome: 'succeeded', date: '2026-05-01' }),
        item({ outcome: 'failed', date: '2026-06-01' }),
        item({ outcome: 'failed', date: '2025-06-01' }),
        item({ outcome: 'open', date: '2026-07-01' }),
      ],
      bucket: [item({ outcome: 'succeeded', date: '2026-08-01', title: 'Marathon' })],
    };
    const s = recapSlides({ kind: 'year', year: '2026' }, { days, months: {}, challenges, today: '2026-12-25' });
    const c = s.find((x) => x.key === 'challenges')!;
    expect(c.big).toBe('2 attempts');
    expect(c.line).toBe('1 said yes. And 1 thing off the bucket list.');
  });
});
