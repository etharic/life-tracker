import { addDays, daysBetween } from './dates';
import type { ChallengeItem, ISODate, ListLink, NextMisogi, SealedNote, YearRecord } from './types';

/**
 * The rules of the year that faces both ways, as pure functions of the year records and the
 * journal date (the day starts at the hour set in Settings, 04:00 by default, like everywhere).
 *
 *   year Y's review (from 25 December) commits Y+1's misogi and may seal a voice note;
 *   both are stored in Y's year.md. The misogi of year Y therefore lives in Y-1's file.
 */

type Years = Record<string, YearRecord | undefined>;

const prev = (y: string) => String(Number(y) - 1);
const next = (y: string) => String(Number(y) + 1);

/** The misogi set for year `y` (stored in the file of the year before). */
export function misogiFor(years: Years, y: string): NextMisogi | null {
  return years[prev(y)]?.nextMisogi ?? null;
}

/** Is the note still locked in the app on `today`? It opens on its date. */
export function isSealed(note: SealedNote, today: ISODate): boolean {
  return today < note.sealedUntil;
}

/** The date a note sealed at year `y`'s review opens: the next 25 December. */
export function unsealDate(y: string): ISODate {
  return `${next(y)}-12-25`;
}

/**
 * Next year's misogi and the sealed note can be changed until 31 January of the following
 * year, or 7 days after the sitting, whichever is later. Before the sitting it is always open.
 */
export function forwardDeadline(rec: YearRecord): ISODate {
  const jan = `${next(rec.year)}-01-31`;
  if (!rec.reviewedOn) return jan;
  const week = addDays(rec.reviewedOn, 7);
  return week > jan ? week : jan;
}

export function forwardWindowOpen(rec: YearRecord | undefined, y: string, today: ISODate): boolean {
  if (!rec?.reviewed) return today >= `${y}-12-25` || today.slice(0, 4) > y;
  return today <= forwardDeadline(rec);
}

export type SittingStep = 'note' | 'judge' | 'defining' | 'next' | 'seal';

/**
 * The steps of year `y`'s review, in order. The first year has no note and no misogi, so it
 * starts at the defining moment. A note from the year before plays only once its date has come.
 */
export function sittingSteps(years: Years, y: string, today: ISODate): SittingStep[] {
  const out: SittingStep[] = [];
  const note = years[prev(y)]?.sealedNote;
  if (note && !isSealed(note, today)) out.push('note');
  if (misogiFor(years, y)) out.push('judge');
  out.push('defining', 'next', 'seal');
  return out;
}

export interface PlanLine {
  /** The year the misogi belongs to. */
  year: string;
  text: string;
  /**
   *   upcoming  committed, starts 1 January
   *   active    during its year, not yet done
   *   ask       its year is ending or over and it is not judged
   *   done      marked done (until its year ends)
   */
  state: 'upcoming' | 'active' | 'ask' | 'done';
  daysLeft: number;
}

/**
 * The misogi line on Plan. Only one line shows. While the year-close card is showing it is
 * hidden, so one question is never asked in two places. Once judged and its year over, it goes.
 */
export function planLine(years: Years, today: ISODate, yearCardShowing: boolean): PlanLine | null {
  if (yearCardShowing) return null;
  const Y = today.slice(0, 4);
  // Last year's, still unjudged after its year ended (a skipped or late review).
  const last = misogiFor(years, prev(Y));
  if (last && last.done === null) return { year: prev(Y), text: last.text, state: 'ask', daysLeft: 0 };

  const cur = misogiFor(years, Y);
  const upcoming = years[Y]?.nextMisogi ?? null;
  if (cur) {
    if (cur.done === null && today >= `${Y}-12-26`) return { year: Y, text: cur.text, state: 'ask', daysLeft: 0 };
    if (cur.done === true && !(upcoming && today >= `${Y}-12-25`))
      return { year: Y, text: cur.text, state: 'done', daysLeft: 0 };
    if (cur.done === null && !(upcoming && today >= `${Y}-12-25`))
      return { year: Y, text: cur.text, state: 'active', daysLeft: daysBetween(today, `${Y}-12-31`) + 1 };
  }
  if (upcoming)
    return { year: next(Y), text: upcoming.text, state: 'upcoming', daysLeft: daysBetween(today, `${next(Y)}-01-01`) };
  return null;
}

/** This year's misogi, when it can still be marked done today (Today's ••• menu, Plan's "Done it?"). */
export function unjudgedMisogi(years: Years, today: ISODate): { year: string; misogi: NextMisogi } | null {
  const Y = today.slice(0, 4);
  const m = misogiFor(years, Y);
  return m && m.done === null ? { year: Y, misogi: m } : null;
}

// ---------- One-tap list questions (nothing on a list changes without a confirm) ----------

export interface ListAnswer {
  label: string;
  /** The change to the list item, or null to leave it as it is. */
  patch: Partial<Pick<ChallengeItem, 'started' | 'outcome'>> | null;
  /** A "not now" answer: nothing changes, and the question is not asked again. */
  dismiss?: boolean;
}

export interface ListQuestion {
  title: string;
  answers: ListAnswer[];
}

/** When a misogi or Kevin's Rule is picked from the bucket list: "Mark it active?" (asked once). */
export function activateQuestion(link: ListLink | null, item: ChallengeItem | undefined): ListQuestion | null {
  // Only bucket items are marked active when picked; a rejection item is started by doing it.
  if (!link || link.kind !== 'bucket' || !item || link.confirmed !== null) return null;
  if (item.started || item.outcome !== 'open') return null;
  return {
    title: `Mark “${item.title}” active on your bucket list?`,
    answers: [
      { label: 'Mark it active', patch: { started: true } },
      { label: 'Not now', patch: null, dismiss: true },
    ],
  };
}

/**
 * When it is judged. Asked once per judgement; a changed judgement asks again. A deleted item
 * asks nothing (its text stays where it was used).
 *   bucket, done        "Mark it as Done?"              yes: started, succeeded
 *   bucket, not done    "Keep it active?" (if active)   no: not started (a lifetime goal is never failed)
 *   rejection, done     "Rejected or successful?"       failed / succeeded / not yet (started)
 *   rejection, not done nothing
 */
export function outcomeQuestion(
  link: ListLink | null,
  item: ChallengeItem | undefined,
  done: boolean,
): ListQuestion | null {
  if (!link || !item || link.outcomeConfirmed !== null) return null;
  if (link.kind === 'bucket') {
    if (done) {
      if (item.outcome === 'succeeded') return null;
      return {
        title: `Mark “${item.title}” as Done on your bucket list?`,
        answers: [
          { label: 'Mark as Done', patch: { started: true, outcome: 'succeeded' } },
          { label: 'Not now', patch: null, dismiss: true },
        ],
      };
    }
    if (!(item.started && item.outcome === 'open')) return null;
    return {
      title: `Keep “${item.title}” active on your bucket list?`,
      answers: [
        { label: 'Keep it active', patch: null },
        { label: 'No, not started', patch: { started: false } },
      ],
    };
  }
  if (!done || item.outcome !== 'open') return null;
  return {
    title: `“${item.title}”: rejected or successful?`,
    answers: [
      { label: 'Rejected', patch: { started: true, outcome: 'failed' } },
      { label: 'Successful', patch: { started: true, outcome: 'succeeded' } },
      { label: 'Not yet', patch: { started: true } },
    ],
  };
}

/** The bucket items a misogi can be picked from: not started, or active. */
export function misogiCandidates(bucket: ChallengeItem[]): ChallengeItem[] {
  return bucket.filter((b) => b.outcome === 'open');
}
