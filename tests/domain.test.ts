import { hobbyTotals, hourAchievements, newAchievements } from '../src/domain/achievements';
import { addDays, logicalDate, monthOfWeek, weekMonday, weekOf, weeksOfMonth, weekSunday } from '../src/domain/dates';
import { currentStreak, isActive, longestStreak, ringStat, weekScore } from '../src/domain/progress';
import { duePrompts, promptId } from '../src/domain/prompts';
import {
  DEFAULT_SETTINGS,
  emptyDay,
  emptyMonth,
  emptyWeek,
  emptyYear,
  hobbyHours,
  outlookItems,
  type DayEntry,
  type MonthRecord,
  type MonthSetup,
} from '../src/domain/types';

function lookup(days: DayEntry[]) {
  const map = new Map(days.map((d) => [d.date, d]));
  return (date: string) => map.get(date);
}

function setup(skillBank = 'h-uke', priorityBank = 'g-dinner'): MonthSetup {
  const c = (text: string, bankId: string) => ({ text, bankId });
  return {
    goals: {
      health: c('Dinner before 5 pm', priorityBank),
      wealth: c('Log every expense', 'g-log'),
      wise: c('Read 20 pages', 'g-read'),
      versatility: c('One new thing', 'g-new'),
    },
    hobbies: {
      intellectual: c('Reading', 'h-read'),
      physical: c('Run 5 km', 'h-run'),
      creative: c('Ukulele', skillBank),
      social: c('Museum visit', 'h-mus'),
    },
    priority: 'health',
    priorityKind: 'build',
    skill: 'creative',
    weeklyChecks: { check_1: 'Travel', check_2: 'A novel', check_3: 'Memory' },
    outlook: '',
    extremeThing: 'Run 10 km',
  };
}

describe('day boundary', () => {
  it('01:30 on 20 Nov is the 19th; 04:00 is the 20th', () => {
    expect(logicalDate(new Date(2026, 10, 20, 1, 30), 4)).toBe('2026-11-19');
    expect(logicalDate(new Date(2026, 10, 20, 3, 59), 4)).toBe('2026-11-19');
    expect(logicalDate(new Date(2026, 10, 20, 4, 0), 4)).toBe('2026-11-20');
  });
  it('crosses month and year boundaries', () => {
    expect(logicalDate(new Date(2027, 0, 1, 2, 0), 4)).toBe('2026-12-31');
  });
});

describe('weeks', () => {
  it('a week ending Sunday 1 Dec belongs to December', () => {
    // 1 Dec 2024 was a Sunday.
    const w = weekOf('2024-12-01');
    expect(weekSunday(w)).toBe('2024-12-01');
    expect(weekMonday(w)).toBe('2024-11-25');
    expect(monthOfWeek(w)).toBe('2024-12');
  });
  it('months have 4 or 5 weeks', () => {
    expect(weeksOfMonth('2026-11')).toHaveLength(5); // Sundays 1, 8, 15, 22, 29
    expect(weeksOfMonth('2026-02')).toHaveLength(4);
  });
  it('ISO week ids round-trip across a year boundary', () => {
    expect(weekOf('2026-12-31')).toBe('2026-W53');
    expect(weekOf('2027-01-03')).toBe('2026-W53');
    expect(weekOf('2027-01-04')).toBe('2027-W01');
    expect(weekMonday('2027-W01')).toBe('2027-01-04');
  });
});

describe('percentage rule', () => {
  const ticks = (n: number) =>
    Array.from({ length: n }, (_, i) => {
      const d = emptyDay(addDays('2026-11-01', i));
      d.goals.health = true;
      return d;
    });
  it('day 19 with 10 ticks shows 53%, not 33%', () => {
    expect(ringStat('2026-11', 'health', '2026-11-19', lookup(ticks(10))).percent).toBe(53);
  });
  it('30 Nov with 15 ticks shows 50%', () => {
    const s = ringStat('2026-11', 'health', '2026-11-30', lookup(ticks(15)));
    expect(s.percent).toBe(50);
    expect(s.ticked).toBe(15);
    expect(s.passed).toBe(30);
  });
});

describe('streaks', () => {
  it('a title alone counts; an empty day does not', () => {
    const d = emptyDay('2026-11-19');
    expect(isActive(d)).toBe(false);
    d.title = 'Finished the valuation chapter';
    expect(isActive(d)).toBe(true);
  });
  it('counts back from today, or from yesterday while today is still empty', () => {
    const days = ['2026-11-16', '2026-11-17', '2026-11-18'].map((date) => ({ ...emptyDay(date), feeling: 6 }));
    expect(currentStreak('2026-11-19', lookup(days))).toBe(3);
    expect(currentStreak('2026-11-20', lookup(days))).toBe(0);
  });
  it('finds the longest run ever', () => {
    const dates = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-10', '2026-01-11'];
    const days = dates.map((date) => ({ ...emptyDay(date), title: 'x' }));
    expect(longestStreak(dates, lookup(days))).toBe(3);
  });
});

describe('achievements', () => {
  function monthsWith(skills: Record<string, string>): Map<string, MonthRecord> {
    const m = new Map<string, MonthRecord>();
    for (const [id, bank] of Object.entries(skills)) m.set(id, { ...emptyMonth(id), setup: setup(bank) });
    return m;
  }
  function tickedDays(month: string, n: number): DayEntry[] {
    return Array.from({ length: n }, (_, i) => {
      const d = emptyDay(addDays(`${month}-01`, i));
      d.hobbies.creative = true;
      return d;
    });
  }
  it('Ukulele for Jan, Feb, Mar with 80+ of 90 days is earned at the end of March', () => {
    const months = monthsWith({ '2027-01': 'h-uke', '2027-02': 'h-uke', '2027-03': 'h-uke' });
    const days = [...tickedDays('2027-01', 28), ...tickedDays('2027-02', 26), ...tickedDays('2027-03', 28)];
    expect(newAchievements(months, lookup(days), '2027-03-31', [])).toHaveLength(0); // March not over
    const got = newAchievements(months, lookup(days), '2027-04-01', []);
    const skill = got.filter((a) => a.kind === 'skill');
    expect(skill).toHaveLength(1);
    expect(skill[0]).toMatchObject({
      text: 'Ukulele',
      earned: '2027-03-31',
      months: ['2027-01', '2027-02', '2027-03'],
    });
  });
  it('switching skill in February resets the run', () => {
    const months = monthsWith({ '2027-01': 'h-uke', '2027-02': 'h-piano', '2027-03': 'h-uke' });
    const days = [...tickedDays('2027-01', 31), ...tickedDays('2027-02', 28), ...tickedDays('2027-03', 31)];
    expect(newAchievements(months, lookup(days), '2027-04-01', []).filter((a) => a.kind === 'skill')).toHaveLength(0);
  });
  it('is pooled over the three months, and can come later in the run', () => {
    const months = monthsWith({ '2027-01': 'h-uke', '2027-02': 'h-uke', '2027-03': 'h-uke', '2027-04': 'h-uke' });
    // Jan weak, Feb-Apr strong: missed at end of March, earned at end of April.
    const days = [
      ...tickedDays('2027-01', 5),
      ...tickedDays('2027-02', 27),
      ...tickedDays('2027-03', 30),
      ...tickedDays('2027-04', 29),
    ];
    const atApril = newAchievements(months, lookup(days), '2027-04-01', []).filter((a) => a.kind === 'skill');
    expect(atApril).toHaveLength(0);
    const atMay = newAchievements(months, lookup(days), '2027-05-01', []).filter((a) => a.kind === 'skill');
    expect(atMay).toHaveLength(1);
    expect(atMay[0].months).toEqual(['2027-02', '2027-03', '2027-04']);
    // Never awarded twice for the same run.
    expect(newAchievements(months, lookup(days), '2027-06-01', atMay).filter((a) => a.kind === 'skill')).toHaveLength(
      0,
    );
  });
});

describe('prompts', () => {
  const base = { years: new Map(), settings: { ...DEFAULT_SETTINGS, firstUse: '2026-11-02' } };
  it('asks for setup, week start, and week close on Sunday, oldest first', () => {
    const months = new Map<string, MonthRecord>();
    const p = duePrompts({ ...base, today: '2026-11-08', months });
    expect(p.map((x) => x.id)).toEqual([
      promptId('setup', '2026-11'),
      promptId('week-start', '2026-W45'),
      promptId('week-close', '2026-W45'),
    ]);
  });
  it('keeps a missed week until it is answered or skipped', () => {
    const nov: MonthRecord = { ...emptyMonth('2026-11'), setup: setup() };
    nov.weeks['2026-W46'] = { ...emptyWeek(), started: true };
    nov.weeks['2026-W45'] = { ...emptyWeek(), started: true, closed: true };
    const months = new Map([['2026-11', nov]]);
    const ids = duePrompts({ ...base, today: '2026-11-19', months }).map((x) => x.id);
    expect(ids).toEqual([promptId('week-close', '2026-W46'), promptId('week-start', '2026-W47')]);
    nov.skipped[promptId('week-close', '2026-W46')] = 'Travelling';
    expect(duePrompts({ ...base, today: '2026-11-19', months }).map((x) => x.id)).toEqual([
      promptId('week-start', '2026-W47'),
    ]);
  });
  it('asks to close the month on its last day', () => {
    const nov: MonthRecord = { ...emptyMonth('2026-11'), setup: setup() };
    const months = new Map([['2026-11', nov]]);
    const ids = duePrompts({ ...base, today: '2026-11-30', months }).map((x) => x.id);
    expect(ids).toContain(promptId('month-close', '2026-11'));
  });
  it('reviews the Misogi Ritual on 25 December, even when one was recorded during the year', () => {
    const dec: MonthRecord = { ...emptyMonth('2026-12'), setup: setup() };
    const months = new Map([['2026-12', dec]]);
    const year = (reviewed: boolean) =>
      new Map([
        [
          '2026',
          {
            ...emptyYear('2026'),
            reviewed,
            defining: { text: 'Ran 10 km', source: 'custom' as const, month: null, date: null },
          },
        ],
      ]);
    const id = promptId('year-close', '2026');
    expect(duePrompts({ ...base, today: '2026-12-24', months }).map((x) => x.id)).not.toContain(id);
    expect(duePrompts({ ...base, today: '2026-12-25', months, years: year(false) }).map((x) => x.id)).toContain(id);
    expect(duePrompts({ ...base, today: '2026-12-25', months, years: year(true) }).map((x) => x.id)).not.toContain(id);
  });
});

describe('outlookItems', () => {
  it('reads lines, commas and a closing "and" as separate items', () => {
    expect(outlookItems('Finish the valuation chapters, land two interviews;\nand build the ukulele habit.')).toEqual([
      'Finish the valuation chapters',
      'Land two interviews',
      'Build the ukulele habit',
    ]);
    expect(outlookItems('  \n , ')).toEqual([]);
  });
});

describe('weekScore', () => {
  // 2026-W47 runs Monday 16 to Sunday 22 November.
  const full = (date: string): DayEntry => {
    const d = emptyDay(date);
    d.goals = { health: true, wealth: true, wise: true, versatility: true };
    d.hobbies.creative = true;
    d.hobbies.social = true;
    return d;
  };
  const week = { ...emptyWeek(), priorities: [{ text: 'Ship it', done: false }] };
  week.checks = { check_1: true, check_2: true, check_3: true };

  it('is 100 when the minimum is met, and stays 100 with more', () => {
    const days = new Map(['2026-11-16', '2026-11-17'].map((d) => [d, full(d)]));
    days.get('2026-11-16')!.prioritiesDone.push('Ship it');
    days.get('2026-11-17')!.hobbies.physical = true;
    expect(weekScore('2026-W47', '2026-11-17', (d) => days.get(d), week, 'creative')).toBe(100);
  });

  it('counts each part equally, and leaves out priorities while none are set', () => {
    const d = emptyDay('2026-11-16');
    d.goals.health = true; // goals 1/4
    d.hobbies.social = true; // hobbies: other but not the skill, 1/2
    const rec = { ...emptyWeek(), checks: { check_1: true, check_2: false, check_3: false } }; // 1/3
    const score = weekScore('2026-W47', '2026-11-16', (x) => (x === d.date ? d : undefined), rec, 'creative');
    expect(score).toBe(Math.round(((0.25 + 0.5 + 1 / 3) / 3) * 100));
  });

  it('is null before the week starts', () => {
    expect(weekScore('2026-W48', '2026-11-19', () => undefined, undefined, 'creative')).toBeNull();
  });
});

describe('hobby hours', () => {
  const setupWith = (bankId: string): MonthSetup => setup(bankId);

  it('counts a tick as an hour, more when recorded, and carries on across months', () => {
    const months = new Map<string, MonthRecord>();
    for (const m of ['2026-09', '2026-11']) months.set(m, { ...emptyMonth(m), setup: setupWith('h1') });
    months.set('2026-10', { ...emptyMonth('2026-10'), setup: setupWith('h2') });
    const days = new Map<string, DayEntry>();
    const tick = (date: string, hours?: number) => {
      const d = emptyDay(date);
      d.hobbies.creative = true;
      if (hours) d.hobbyHours.creative = hours;
      days.set(date, d);
    };
    tick('2026-09-03');
    tick('2026-10-05', 3); // another hobby held the slot in October
    tick('2026-11-02', 2.5);
    const totals = hobbyTotals(months, (d) => days.get(d), '2026-11-19');
    expect(totals.get('h1')?.hours).toBe(3.5);
    expect(totals.get('h2')?.hours).toBe(3);
    expect(hobbyHours(days.get('2026-09-03'), 'creative')).toBe(1);
  });

  it('awards each milestone once', () => {
    const months = new Map<string, MonthRecord>([['2026-11', { ...emptyMonth('2026-11'), setup: setupWith('h1') }]]);
    const allDay = (date: string) => {
      const d = emptyDay(date);
      d.hobbies.creative = true;
      d.hobbyHours.creative = 24;
      return d;
    };
    const first = hourAchievements(months, allDay, '2026-11-11', []); // 11 days x 24 h = 264 h
    expect(first.map((a) => a.hours)).toEqual([100, 250]);
    expect(hourAchievements(months, allDay, '2026-11-11', first)).toEqual([]);
  });
});
