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

export interface MisogiRow {
  /** The year the misogi belongs to. */
  year: string;
  text: string;
  /**
   *   active         during its year, not yet judged (until 25 December)
   *   ask            from 26 December, or after its year, and not judged
   *   done           marked done
   *   not-this-time  judged not done
   *   upcoming       next year's, chosen at this year's review
   */
  status: 'active' | 'ask' | 'done' | 'not-this-time' | 'upcoming';
  /** Days left in its year (active), or until it starts (upcoming); 0 otherwise. */
  days: number;
}

/**
 * The Misogi ribbon on Plan, shown all year: this year's misogi (or none yet), last year's while
 * it is still not judged, and next year's once it is chosen.
 */
export function misogiRibbon(
  years: Years,
  today: ISODate,
): { year: string; current: MisogiRow | null; last: MisogiRow | null; upcoming: MisogiRow | null } {
  const Y = today.slice(0, 4);
  const cur = misogiFor(years, Y);
  const old = misogiFor(years, prev(Y));
  const nxt = years[Y]?.nextMisogi ?? null;
  const current: MisogiRow | null = cur
    ? {
        year: Y,
        text: cur.text,
        status:
          cur.done === true ? 'done' : cur.done === false ? 'not-this-time' : today >= `${Y}-12-26` ? 'ask' : 'active',
        days: cur.done === null && today < `${Y}-12-26` ? daysBetween(today, `${Y}-12-31`) + 1 : 0,
      }
    : null;
  return {
    year: Y,
    current,
    last: old && old.done === null ? { year: prev(Y), text: old.text, status: 'ask', days: 0 } : null,
    upcoming: nxt
      ? { year: next(Y), text: nxt.text, status: 'upcoming', days: daysBetween(today, `${next(Y)}-01-01`) }
      : null,
  };
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
