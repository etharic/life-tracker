import {
  CHALLENGE_KINDS,
  type ChallengeItem,
  type ChallengeKind,
  type ExtremeIncident,
  type MonthId,
  type MonthRecord,
  type WeekId,
} from './types';

/**
 * The rules behind the redesigned lists, kept out of the screens so they can be tested:
 * the merged month highlights, the challenges under way, and where a list's + sits.
 */

/** One line of Month highlights: the line chosen at Close month, or the extreme incident. */
export type HighlightRow =
  | { month: MonthId; kind: 'highlight'; text: string; fromWeek: WeekId | null }
  | { month: MonthId; kind: 'incident'; incident: ExtremeIncident };

/**
 * Month highlights, good or bad: newest month first, and within a month its closing highlight,
 * then its extreme incident. A month with neither is left out.
 */
export function monthHighlightRows(months: MonthRecord[]): HighlightRow[] {
  return [...months]
    .sort((a, b) => (a.month < b.month ? 1 : -1))
    .flatMap((m): HighlightRow[] => [
      ...(m.highlight.trim()
        ? [{ month: m.month, kind: 'highlight' as const, text: m.highlight, fromWeek: m.highlightFromWeek }]
        : []),
      ...(m.extremeIncident ? [{ month: m.month, kind: 'incident' as const, incident: m.extremeIncident }] : []),
    ]);
}

/** Every challenge under way, from every list, newest first (by its date, or the day it was added). */
export function activeChallenges(
  challenges: Record<ChallengeKind, ChallengeItem[]>,
): { kind: ChallengeKind; item: ChallengeItem }[] {
  return CHALLENGE_KINDS.flatMap((kind) =>
    challenges[kind].filter((it) => it.started && it.outcome === 'open').map((item) => ({ kind, item })),
  ).sort((a, b) => ((a.item.date ?? a.item.added) < (b.item.date ?? b.item.added) ? 1 : -1));
}

/**
 * Where This week's commitments put their +, so it never takes a line of its own:
 *   done-line  at the end of the "n done" line, when there is one
 *   last-item  at the end of the last line still showing
 *   own-line   on a line of its own, only when the list is empty or a new line is being typed
 *   none       a past week, shown as it was
 */
export function plusPlace(p: {
  interactive: boolean;
  adding: boolean;
  shown: number;
  folded: number;
}): 'done-line' | 'last-item' | 'own-line' | 'none' {
  if (!p.interactive) return 'none';
  if (p.adding) return 'own-line';
  if (p.folded) return 'done-line';
  if (p.shown) return 'last-item';
  return 'own-line';
}
