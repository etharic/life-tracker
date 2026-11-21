import {
  formatFull,
  formatLong,
  formatMonth,
  formatShort,
  formatWeekRange,
  monthDates,
  monthName,
  weekDates,
} from '../domain/dates';
import { feeling } from '../domain/feelings';
import {
  CHECK_KEYS,
  formatHours,
  GOAL_CATEGORIES,
  HOBBY_CATEGORIES,
  hobbyHours,
  outlookItems,
  rejectionCounts,
  type DayEntry,
  type MonthRecord,
  type Rejection,
  type YearRecord,
} from '../domain/types';

/**
 * The documents Google Drive shows: one Google Doc per month, written to be read by a person
 * (the app's own files are kept in Drive's hidden app folder for restoring). Plain HTML that
 * Google Docs imports cleanly: headings, paragraphs, bold, italics and coloured text only.
 */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const paras = (s: string) =>
  s
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
const GREY = '#6B6A64';
const muted = (s: string) => `<p><span style="color:${GREY}">${s}</span></p>`;
const tick = (on: boolean) => (on ? '&#10003;' : '&#9675;');

function page(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body>
${body}
</body></html>`;
}

/** "05 May 2024": readable, and in month order when Drive sorts by name. */
export function docName(month: string): string {
  return `${month.slice(5, 7)} ${monthName(month)} ${month.slice(0, 4)}`;
}

function hasContent(d: DayEntry): boolean {
  return !!(
    d.title.trim() ||
    d.feeling != null ||
    d.writing.trim() ||
    d.media.length ||
    d.prioritiesDone.length ||
    GOAL_CATEGORIES.some((c) => d.goals[c]) ||
    HOBBY_CATEGORIES.some((c) => d.hobbies[c])
  );
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function dayHtml(d: DayEntry, rec: MonthRecord | undefined): string {
  const s = rec?.setup;
  const out: string[] = [`<h3>${esc(formatLong(d.date))}</h3>`];
  if (d.title.trim()) out.push(`<p><b>${esc(d.title.trim())}</b></p>`);
  const f = feeling(d.feeling);
  const facts: string[] = [];
  if (f) facts.push(`<span style="color:${f.color}">&#9679;</span> Feeling ${f.score}, ${esc(f.name)}`);
  const goals = GOAL_CATEGORIES.filter((c) => d.goals[c]);
  if (goals.length)
    facts.push(`Goals ${goals.length} of 4: ${goals.map((c) => esc(s?.goals[c].text ?? c)).join(', ')}`);
  const hobbies = HOBBY_CATEGORIES.filter((c) => d.hobbies[c]);
  if (hobbies.length)
    facts.push(
      `Hobbies: ${hobbies.map((c) => `${esc(s?.hobbies[c].text ?? c)} ${formatHours(hobbyHours(d, c))}`).join(', ')}`,
    );
  if (d.prioritiesDone.length) facts.push(`Priorities done: ${d.prioritiesDone.map(esc).join(', ')}`);
  if (facts.length) out.push(muted(facts.join('<br>')));
  if (d.writing.trim()) out.push(paras(d.writing));
  const photos = d.media.filter((m) => m.kind === 'photo').length;
  const audio = d.media.length - photos;
  if (d.media.length) {
    const what = [
      photos ? plural(photos, 'photo', 'photos') : '',
      audio ? plural(audio, 'voice note', 'voice notes') : '',
    ]
      .filter(Boolean)
      .join(' and ');
    out.push(`<p><i><span style="color:${GREY}">${what} in Life-Tracker.</span></i></p>`);
  }
  return out.join('\n');
}

function monthSummary(rec: MonthRecord, days: Map<string, DayEntry>): string {
  const s = rec.setup;
  const out: string[] = [];
  if (s) {
    out.push(
      `<p><b>Daily goals</b><br>${GOAL_CATEGORIES.map(
        (c) => `${esc(s.goals[c].text)}${c === s.priority ? ' &#9733;' : ''}`,
      ).join('<br>')}</p>`,
    );
    out.push(
      `<p><b>Hobbies</b><br>${HOBBY_CATEGORIES.map((c) => {
        const h = monthDates(rec.month).reduce((n, date) => n + hobbyHours(days.get(date), c), 0);
        return `${esc(s.hobbies[c].text)}${c === s.skill ? ' &#9733;' : ''}${h ? ` <span style="color:${GREY}">${formatHours(h)} this month</span>` : ''}`;
      }).join('<br>')}</p>`,
    );
    const commitments = CHECK_KEYS.map((k) => s.weeklyChecks[k]).filter(Boolean);
    if (commitments.length)
      out.push(`<p><b>Other commitments each week</b><br>${commitments.map(esc).join('<br>')}</p>`);
    const items = outlookItems(s.outlook);
    if (items.length)
      out.push(
        `<p><b>Outlook</b><br>${items.map((t) => `${tick(rec.outlookDone.includes(t))} ${esc(t)}`).join('<br>')}</p>`,
      );
    if (s.extremeThing) {
      const status =
        rec.extremeDone === true
          ? rec.extremeDoneOn
            ? `done on ${formatShort(rec.extremeDoneOn)}`
            : 'done'
          : rec.extremeDone === false
            ? 'not done'
            : '';
      out.push(
        `<p><b>Kevin’s Rule</b><br>${esc(s.extremeThing)}${status ? ` <span style="color:${GREY}">(${status})</span>` : ''}</p>`,
      );
    }
  }
  if (rec.extremeIncident)
    out.push(
      `<p><b>Extreme incident</b><br>${esc(rec.extremeIncident.title)} <span style="color:${GREY}">(${formatShort(rec.extremeIncident.date)}, ${rec.extremeIncident.mark})</span></p>`,
    );
  return out.join('\n');
}

function weeksHtml(rec: MonthRecord, days: Map<string, DayEntry>): string {
  const s = rec.setup;
  const out: string[] = [];
  for (const w of Object.keys(rec.weeks).sort()) {
    const wk = rec.weeks[w];
    const done = new Set(weekDates(w).flatMap((d) => days.get(d)?.prioritiesDone ?? []));
    const lines: string[] = [];
    if (wk.highlight) lines.push(`<i>${esc(wk.highlight)}</i>`);
    if (wk.priorities.length)
      lines.push(`Priorities: ${wk.priorities.map((p) => `${tick(done.has(p.text))} ${esc(p.text)}`).join(', ')}`);
    const commitments = s ? CHECK_KEYS.filter((k) => s.weeklyChecks[k]) : [];
    if (commitments.length)
      lines.push(
        `Commitments: ${commitments.map((k) => `${tick(wk.checks[k])} ${esc(s!.weeklyChecks[k])}`).join(', ')}`,
      );
    if (lines.length) out.push(`<p><b>${formatWeekRange(w)}</b><br>${lines.join('<br>')}</p>`);
  }
  return out.length ? `<h2>Weeks</h2>\n${out.join('\n')}` : '';
}

function misogiHtml(y: YearRecord): string {
  if (!y.defining) return '';
  return `<h2>Misogi Ritual of ${y.year}</h2>
${y.defining.date ? muted(formatFull(y.defining.date)) : ''}
<p><b>${esc(y.defining.text)}</b></p>
${y.notes.trim() ? paras(y.notes) : ''}`;
}

/** The month's document, or null when nothing was written that month. */
export function monthDocHtml(input: {
  month: string;
  rec: MonthRecord | undefined;
  days: DayEntry[];
  /** The year's Misogi Ritual, when it belongs to this month (its date, or December when undated). */
  misogi?: YearRecord;
}): string | null {
  const { month, rec } = input;
  const days = input.days.filter((d) => d.date.startsWith(month) && hasContent(d));
  days.sort((a, b) => (a.date < b.date ? -1 : 1));
  const byDate = new Map(days.map((d) => [d.date, d]));
  const misogi = input.misogi?.defining ? input.misogi : undefined;
  if (!days.length && !rec?.setup && !misogi) return null;
  const parts = [`<h1>${formatMonth(month)}</h1>`, muted('Life-Tracker journal')];
  const summary = rec ? monthSummary(rec, byDate) : '';
  if (summary) parts.push('<h2>The month</h2>', summary);
  if (misogi) parts.push(misogiHtml(misogi));
  if (rec) parts.push(weeksHtml(rec, byDate));
  if (days.length) parts.push('<h2>Days</h2>', ...days.map((d) => dayHtml(d, rec)));
  return page(formatMonth(month), parts.filter(Boolean).join('\n'));
}

/** The Rejection list as one document. */
export function rejectionsDocHtml(list: Rejection[]): string {
  const { total, rejected, accepted } = rejectionCounts(list);
  const sorted = [...list].sort((a, b) => ((a.date ?? a.added) < (b.date ?? b.added) ? 1 : -1));
  const mark = (r: Rejection) =>
    r.outcome === 'rejected'
      ? '<span style="color:#C96442">&#10007; Rejected</span>'
      : r.outcome === 'accepted'
        ? '<span style="color:#3F8A4F">&#10003; Successful</span>'
        : `<span style="color:${GREY}">Waiting</span>`;
  const items = sorted.map(
    (r) => `<h3>${esc(r.title)}</h3>
${muted([r.date ? formatFull(r.date) : '', mark(r)].filter(Boolean).join(' · '))}
${r.notes.trim() ? paras(r.notes) : ''}`,
  );
  return page(
    'Rejection list',
    [
      '<h1>Rejection list</h1>',
      muted(`${plural(total, 'attempt', 'attempts')} logged · ${rejected} rejected · ${accepted} successful`),
      ...items,
    ].join('\n'),
  );
}
