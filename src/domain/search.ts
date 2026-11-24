import { addDays, weekMonday } from './dates';
import type { DayEntry, ISODate, MonthId, MonthRecord, WeekId, YearRecord } from './types';

/**
 * Search over everything written: day titles and writing, week and month highlights, defining
 * moments and misogis. Case and accents are ignored ("cafe" finds "Café"), and every word of the
 * query must appear in the same entry. The folded text is built once per change of the journal
 * (buildIndex) and filtered per keystroke (searchIndex).
 */

export type SearchKind = 'day' | 'week' | 'month' | 'defining' | 'misogi';

/** A span [start, end) in a string. */
export type Span = [number, number];

interface Field {
  text: string;
  folded: string;
  /** folded index -> original index */
  map: number[];
}

export interface SearchDoc {
  key: string;
  kind: SearchKind;
  /** Newest first by this (an ISO date or month). */
  sort: string;
  /** Where the result opens. */
  route: string;
  /** The day for a day result; the week, month or year otherwise. */
  ref: string;
  /** Title-like line (day title, or the highlight / moment / misogi itself). */
  head: Field;
  /** Body text (the day's writing); empty for the other kinds. */
  body: Field;
}

export interface SearchHit {
  doc: SearchDoc;
  /** Marked spans in the head line. */
  headMarks: Span[];
  /** A piece of the body around the first match, and the marks within it. */
  snippet: string;
  snippetMarks: Span[];
}

export interface SearchResult {
  hits: SearchHit[];
  /** More entries matched than are shown. */
  more: boolean;
}

export const SEARCH_LIMIT = 200;
export const MIN_QUERY = 2;

/** Lower case without accents. */
export function fold(s: string): string {
  return foldField(s).folded;
}

function foldField(text: string): Field {
  let folded = '';
  const map: number[] = [];
  let i = 0;
  for (const ch of text) {
    const f = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    for (let k = 0; k < f.length; k++) map.push(i);
    folded += f;
    i += ch.length;
  }
  map.push(i);
  return { text, folded, map };
}

const EMPTY: Field = { text: '', folded: '', map: [0] };

export interface Searchable {
  days: Record<ISODate, DayEntry>;
  months: Record<MonthId, MonthRecord>;
  years: Record<string, YearRecord>;
}

export function buildIndex(j: Searchable): SearchDoc[] {
  const docs: SearchDoc[] = [];
  for (const d of Object.values(j.days)) {
    if (!d.title && !d.writing) continue;
    docs.push({
      key: `day:${d.date}`,
      kind: 'day',
      sort: d.date,
      route: `/day/${d.date}`,
      ref: d.date,
      head: foldField(d.title),
      body: foldField(d.writing.replace(/\s+/g, ' ').trim()),
    });
  }
  for (const m of Object.values(j.months)) {
    for (const [week, w] of Object.entries(m.weeks) as [WeekId, MonthRecord['weeks'][WeekId]][]) {
      if (!w.highlight) continue;
      const monday = weekMonday(week);
      docs.push({
        key: `week:${week}`,
        kind: 'week',
        // A week sorts by its Sunday, so it sits after the days it sums up.
        sort: addDays(monday, 6),
        route: `/day/${monday}`,
        ref: week,
        head: foldField(w.highlight),
        body: EMPTY,
      });
    }
    if (m.highlight) {
      docs.push({
        key: `month:${m.month}`,
        kind: 'month',
        sort: `${m.month}-99`,
        route: `/months/${m.month}`,
        ref: m.month,
        head: foldField(m.highlight),
        body: EMPTY,
      });
    }
  }
  for (const y of Object.values(j.years)) {
    if (y.defining?.text) {
      const at = y.defining.date;
      docs.push({
        key: `defining:${y.year}`,
        kind: 'defining',
        sort: `${y.year}-99`,
        route: at ? `/day/${at}` : `/past/year/${y.year}`,
        ref: y.year,
        head: foldField(y.defining.text),
        body: EMPTY,
      });
    }
    if (y.nextMisogi?.text) {
      // The misogi is written in a year's file at its review, but it belongs to the year after.
      const year = String(Number(y.year) + 1);
      docs.push({
        key: `misogi:${year}`,
        kind: 'misogi',
        sort: `${year}-00`,
        route: `/past/year/${year}`,
        ref: year,
        head: foldField(y.nextMisogi.text),
        body: EMPTY,
      });
    }
  }
  return docs.sort((a, b) => (a.sort < b.sort ? 1 : a.sort > b.sort ? -1 : 0));
}

function spansOf(f: Field, words: string[]): Span[] {
  const out: Span[] = [];
  for (const w of words) {
    let at = f.folded.indexOf(w);
    while (at >= 0) {
      out.push([f.map[at], f.map[at + w.length]]);
      at = f.folded.indexOf(w, at + w.length);
    }
  }
  return merge(out);
}

function merge(spans: Span[]): Span[] {
  const s = [...spans].sort((a, b) => a[0] - b[0]);
  const out: Span[] = [];
  for (const sp of s) {
    const last = out[out.length - 1];
    if (last && sp[0] <= last[1]) last[1] = Math.max(last[1], sp[1]);
    else out.push([sp[0], sp[1]]);
  }
  return out;
}

const LEAD = 30;

export function searchIndex(index: SearchDoc[], query: string, limit = SEARCH_LIMIT): SearchResult {
  const q = fold(query.trim());
  if (q.length < MIN_QUERY) return { hits: [], more: false };
  const words = [...new Set(q.split(/\s+/).filter(Boolean))];
  const hits: SearchHit[] = [];
  let more = false;
  for (const doc of index) {
    if (!words.every((w) => doc.head.folded.includes(w) || doc.body.folded.includes(w))) continue;
    if (hits.length === limit) {
      more = true;
      break;
    }
    const headMarks = spansOf(doc.head, words);
    const bodyMarks = spansOf(doc.body, words);
    let snippet = doc.body.text;
    let snippetMarks = bodyMarks;
    if (bodyMarks.length && bodyMarks[0][0] > LEAD) {
      const cut = bodyMarks[0][0] - LEAD;
      snippet = `…${doc.body.text.slice(cut)}`;
      snippetMarks = bodyMarks.map(([a, b]) => [a - cut + 1, b - cut + 1] as Span);
    }
    hits.push({ doc, headMarks, snippet, snippetMarks });
  }
  return { hits, more };
}

export function searchJournal(j: Searchable, query: string, limit = SEARCH_LIMIT): SearchResult {
  return searchIndex(buildIndex(j), query, limit);
}
