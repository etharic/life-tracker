import { isSealed } from './misogi';
import type { ISODate, YearRecord } from './types';

export interface BookNote {
  /** The year whose review sealed it. */
  from: string;
  /** Relative to that year's folder. */
  path: string;
  /** "2026/media/sealed-2026.m4a", as named in the book. */
  file: string;
}

/**
 * One rule for books: a sealed note appears only in the book of the year it opens in (the note
 * sealed in 2026 can appear only in the 2027 book), and only if that book is made on or after
 * the day it opens. Every other book, and viewer.html, leaves it out.
 */
export function bookNote(years: Record<string, YearRecord | undefined>, year: string, today: ISODate): BookNote | null {
  const from = String(Number(year) - 1);
  const note = years[from]?.sealedNote;
  if (!note || !note.sealedUntil.startsWith(`${year}-`) || isSealed(note, today)) return null;
  return { from, path: note.path, file: `${from}/${note.path}` };
}
