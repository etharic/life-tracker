import { formatFull, monthName } from './dates';
import { feeling } from './feelings';
import { isActive, longestStreak } from './progress';
import { wordCount } from './stats';
import {
  CATEGORY_LABEL,
  GOAL_CATEGORIES,
  HOBBY_CATEGORIES,
  hobbyHours,
  type ChallengeItem,
  type ChallengeKind,
  type DayEntry,
  type HobbyCategory,
  type GoalCategory,
  type ISODate,
  type MonthId,
  type MonthRecord,
} from './types';

/**
 * The recap that opens Close month and the year review, one card at a time (after Spotify
 * Wrapped): a small line above, one big thing, a line under it. A card is left out when there
 * is nothing true to say on it. Feeling cards take that feeling's colour; the rest are pen blue.
 */
export interface RecapSlide {
  key: string;
  kicker: string;
  big: string;
  line: string;
  /** A feeling score whose colour the card takes; otherwise the card is pen blue or ink. */
  feeling?: number;
  tone?: 'accent' | 'ink';
}

export type RecapPeriod = { kind: 'month'; month: MonthId } | { kind: 'year'; year: string };

export interface RecapInput {
  days: Record<ISODate, DayEntry | undefined>;
  months: Record<MonthId, MonthRecord | undefined>;
  challenges: Record<ChallengeKind, ChallengeItem[]>;
  today: ISODate;
}

const n = (x: number) => x.toLocaleString('en-GB');
const plural = (x: number, one: string, many = `${one}s`) => `${n(x)} ${x === 1 ? one : many}`;

function inPeriod(p: RecapPeriod, date: ISODate): boolean {
  return p.kind === 'month' ? date.slice(0, 7) === p.month : date.slice(0, 4) === p.year;
}

/** A goal's or hobby's own words in the month a day belongs to, else its category. */
function nameOf(months: RecapInput['months'], date: ISODate, c: GoalCategory | HobbyCategory): string {
  const setup = months[date.slice(0, 7)]?.setup;
  if (!setup) return CATEGORY_LABEL[c];
  return (c in setup.goals ? setup.goals[c as GoalCategory] : setup.hobbies[c as HobbyCategory]).text;
}

export function recapSlides(p: RecapPeriod, input: RecapInput): RecapSlide[] {
  const { days, months, challenges, today } = input;
  const list = Object.values(days)
    .filter((d): d is DayEntry => !!d && d.date <= today && inPeriod(p, d.date))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const active = list.filter(isActive);
  const label = p.kind === 'month' ? monthName(p.month) : p.year;
  const slides: RecapSlide[] = [];

  slides.push({
    key: 'intro',
    kicker: p.kind === 'month' ? 'Your month' : 'Your year',
    big: label,
    line: active.length ? `${plural(active.length, 'day')} in the journal.` : 'A quiet one. Nothing was written down.',
    tone: 'ink',
  });
  if (!active.length) return slides;

  const lookup = (d: ISODate) => days[d];
  const run = longestStreak(
    list.map((d) => d.date),
    lookup,
  );
  if (run >= 2) {
    slides.push({
      key: 'run',
      kicker: 'Your longest run',
      big: plural(run, 'day'),
      line: 'In a row, without missing one.',
      tone: 'accent',
    });
  }

  let words = 0;
  let longest: { date: ISODate; words: number } | null = null;
  for (const d of list) {
    const w = wordCount(d.writing);
    words += w;
    if (w && (!longest || w >= longest.words)) longest = { date: d.date, words: w };
  }
  if (words) {
    slides.push({
      key: 'words',
      kicker: 'You wrote',
      big: plural(words, 'word'),
      line: longest ? `The most on ${formatFull(longest.date)}: ${plural(longest.words, 'word')}.` : '',
      tone: 'ink',
    });
  }

  const felt = list.filter((d) => d.feeling != null);
  if (felt.length) {
    const avg = felt.reduce((s, d) => s + d.feeling!, 0) / felt.length;
    const f = feeling(Math.round(avg))!;
    slides.push({
      key: 'feeling',
      kicker: `${label} felt`,
      big: f.name,
      line: `An average of ${avg.toFixed(1)} over ${plural(felt.length, 'day')}.`,
      feeling: f.score,
    });
    // The best day: the highest feeling, the latest one on a tie, with its line if it has one.
    const best = felt.reduce((a, b) => (b.feeling! >= a.feeling! ? b : a));
    const bf = feeling(best.feeling)!;
    slides.push({
      key: 'best',
      kicker: 'Your best day',
      big: best.title.trim() || formatFull(best.date),
      line: best.title.trim() ? `${formatFull(best.date)}, ${bf.name.toLowerCase()}.` : `${bf.name}.`,
      feeling: bf.score,
    });
  }

  // Goals: the one kept most often, by its own words.
  const goalCount = new Map<string, number>();
  let goalTicks = 0;
  for (const d of list) {
    for (const c of GOAL_CATEGORIES) {
      if (!d.goals[c]) continue;
      goalTicks++;
      const k = nameOf(months, d.date, c);
      goalCount.set(k, (goalCount.get(k) ?? 0) + 1);
    }
  }
  if (goalTicks) {
    const [top, times] = [...goalCount.entries()].sort((a, b) => b[1] - a[1])[0];
    slides.push({
      key: 'goals',
      kicker: 'Goals kept',
      big: n(goalTicks),
      line: `The most: ${top}, ${plural(times, 'day')}.`,
      tone: 'accent',
    });
  }

  const hobbyTime = new Map<string, number>();
  let hours = 0;
  for (const d of list) {
    for (const c of HOBBY_CATEGORIES) {
      const h = hobbyHours(d, c);
      if (!h) continue;
      hours += h;
      const k = nameOf(months, d.date, c);
      hobbyTime.set(k, (hobbyTime.get(k) ?? 0) + h);
    }
  }
  if (hours) {
    const [top, h] = [...hobbyTime.entries()].sort((a, b) => b[1] - a[1])[0];
    slides.push({
      key: 'hobbies',
      kicker: 'Time on hobbies',
      big: `${Number.isInteger(hours) ? n(hours) : hours.toFixed(1)} hours`,
      line: `Most of it on ${top}: ${Number.isInteger(h) ? h : h.toFixed(1)} h.`,
      tone: 'ink',
    });
  }

  // Challenges that ended in the period (by their date).
  const ended = (kind: ChallengeKind) =>
    challenges[kind].filter((c) => c.outcome !== 'open' && c.date != null && inPeriod(p, c.date));
  const asked = ended('rejections');
  const bucket = ended('bucket').filter((c) => c.outcome === 'succeeded');
  if (asked.length || bucket.length) {
    const yes = asked.filter((c) => c.outcome === 'succeeded').length;
    slides.push({
      key: 'challenges',
      kicker: asked.length ? 'You went for it' : 'Off the bucket list',
      big: asked.length ? plural(asked.length, 'attempt') : plural(bucket.length, 'thing'),
      line: asked.length
        ? `${n(yes)} said yes.${bucket.length ? ` And ${plural(bucket.length, 'thing')} off the bucket list.` : ''}`
        : bucket.map((b) => b.title).join(', '),
      tone: 'accent',
    });
  }

  return slides;
}
