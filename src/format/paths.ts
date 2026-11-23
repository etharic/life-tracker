import { isISODate } from '../domain/dates';
import type { ISODate, MonthId } from '../domain/types';

/** All paths are relative to the Journal/ folder and use forward slashes. */

export const BANK = 'bank.md';
export const ACHIEVEMENTS = 'achievements.md';
export const SETTINGS = 'settings.md';
export const CHALLENGE_FILES = {
  rejections: 'challenges/rejections.md',
  bucket: 'challenges/bucket-list.md',
} as const;
export const README = 'README.txt';
export const VIEWER = 'viewer.html';

export function monthFolder(month: MonthId): string {
  return `${month.slice(0, 4)}/${month}`;
}
export function dayPath(date: ISODate): string {
  return `${monthFolder(date.slice(0, 7))}/${date}.md`;
}
export function monthPath(month: MonthId): string {
  return `${monthFolder(month)}/month.md`;
}
export function yearPath(year: string): string {
  return `${year}/year.md`;
}
/**
 * A media link is relative to the folder of the file that links it: a day's month folder, or
 * the year folder for a year's defining moment (owner '2026').
 */
export function mediaFile(owner: ISODate | string, relative: string): string {
  if (/^\d{4}$/.test(owner)) return `${owner}/${relative}`;
  return `${monthFolder(owner.slice(0, 7))}/${relative}`;
}

export type JournalFile =
  | { type: 'day'; date: ISODate }
  | { type: 'month'; month: MonthId }
  | { type: 'year'; year: string }
  | { type: 'bank' }
  | { type: 'achievements' }
  | { type: 'settings' }
  | { type: 'challenges'; kind: 'rejections' | 'bucket' }
  | { type: 'other' };

export function classify(path: string): JournalFile {
  if (path === BANK) return { type: 'bank' };
  if (path === ACHIEVEMENTS) return { type: 'achievements' };
  if (path === SETTINGS) return { type: 'settings' };
  if (path === CHALLENGE_FILES.rejections) return { type: 'challenges', kind: 'rejections' };
  if (path === CHALLENGE_FILES.bucket) return { type: 'challenges', kind: 'bucket' };
  let m = /^(\d{4})\/year\.md$/.exec(path);
  if (m) return { type: 'year', year: m[1] };
  m = /^(\d{4})\/(\d{4}-\d{2})\/month\.md$/.exec(path);
  if (m && m[2].startsWith(m[1])) return { type: 'month', month: m[2] };
  m = /^(\d{4})\/(\d{4}-\d{2})\/(\d{4}-\d{2}-\d{2})\.md$/.exec(path);
  if (m && m[3].startsWith(m[2]) && isISODate(m[3])) return { type: 'day', date: m[3] };
  return { type: 'other' };
}
