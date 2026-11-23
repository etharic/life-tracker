import { daysInMonth, formatLong, MONTHS, toISO } from '../domain/dates';
import { feeling, FEELINGS } from '../domain/feelings';
import type { BookNote } from '../domain/book-rules';
import { misogiOf, NAMES } from '../domain/names';
import {
  CATEGORY_LABEL,
  type DayEntry,
  type MediaRef,
  type MonthRecord,
  type NextMisogi,
  type YearRecord,
} from '../domain/types';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const para = (s: string) =>
  esc(s)
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>');

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "2 voice notes and a video" for a day's recordings and videos. */
function soundWords(media: MediaRef[]): string {
  const a = media.filter((m) => m.kind === 'audio').length;
  const v = media.filter((m) => m.kind === 'video').length;
  return [a ? count(a, 'voice note', 'voice notes') : '', v ? count(v, 'video', 'videos') : '']
    .filter(Boolean)
    .join(' and ');
}

/**
 * The yearly book: one volume per year for children and grandchildren.
 * Day titles, month pages, extreme things, weekly highlights, the feelings year, and the writing.
 * `photo` returns an inline data URI (local file URLs cannot be printed on iOS).
 *
 * Two editions from the same pages. `print` is the PDF: paper cannot play anything, so each day
 * says which voice notes and videos it has and where they are. `player` is one HTML file that
 * opens in any browser and plays them in place; `sound` returns each one as a data URI, or
 * nothing when it was too large to carry.
 */
export function bookHtml(input: {
  year: string;
  days: DayEntry[];
  months: MonthRecord[];
  yearRec: YearRecord | undefined;
  note: string;
  photo: (day: DayEntry, path: string) => string | undefined;
  mode?: 'print' | 'player';
  sound?: (day: DayEntry, media: MediaRef) => string | undefined;
  /** The misogi set for this year (stored in last year's file). */
  misogi?: NextMisogi | null;
  /** The voice note sealed a year ago, when this book may carry it (see bookNote). */
  openedNote?: BookNote | null;
  /** The opened note as a data URI, for the edition with sound. */
  noteSound?: string;
}): string {
  const { year } = input;
  const player = input.mode === 'player';
  const days = input.days.filter((d) => d.date.startsWith(year)).sort((a, b) => (a.date < b.date ? -1 : 1));
  const byDate = new Map(days.map((d) => [d.date, d]));
  const months = input.months.filter((m) => m.month.startsWith(year)).sort((a, b) => (a.month < b.month ? -1 : 1));

  let grid = '<table class="grid"><tr><td></td>' + MONTHS.map((m) => `<th>${m[0]}</th>`).join('') + '</tr>';
  for (let n = 1; n <= 31; n++) {
    grid += `<tr><td class="n">${n % 5 === 1 ? n : ''}</td>`;
    for (let m = 1; m <= 12; m++) {
      const month = `${year}-${String(m).padStart(2, '0')}`;
      if (n > daysInMonth(month)) {
        grid += '<td></td>';
        continue;
      }
      const f = feeling(byDate.get(toISO(Number(year), m, n))?.feeling);
      grid += f ? `<td><div class="c" style="background:${f.color}"></div></td>` : '<td><div class="c e"></div></td>';
    }
    grid += '</tr>';
  }
  grid +=
    '</table><div class="legend">' +
    FEELINGS.map((f) => `<span><i style="background:${f.color}"></i>${f.score} ${esc(f.name)}</span>`).join('') +
    '</div>';

  const monthPages = months
    .map((m) => {
      const name = `${MONTHS[Number(m.month.slice(5, 7)) - 1]} ${year}`;
      const titles = days.filter((d) => d.date.startsWith(m.month) && d.title);
      const s = m.setup;
      const highlights = Object.keys(m.weeks)
        .sort()
        .map((w) => m.weeks[w].highlight)
        .filter(Boolean);
      return `<section class="page"><h2>${name}</h2>
${
  s
    ? `<div class="cols"><div><h4>Daily goals</h4><ul>${Object.entries(s.goals)
        .map(
          ([c, v]) =>
            `<li><span class="k">${CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL]}</span> ${esc(v.text)}${c === s.priority ? ' &#9733;' : ''}</li>`,
        )
        .join('')}</ul></div>
<div><h4>Hobbies</h4><ul>${Object.entries(s.hobbies)
        .map(
          ([c, v]) =>
            `<li><span class="k">${CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL]}</span> ${esc(v.text)}${c === s.skill ? ' &#9733;' : ''}</li>`,
        )
        .join('')}</ul></div></div>
${s.outlook ? `<p><b>Outlook.</b> ${para(s.outlook)}</p>` : ''}
${s.extremeThing ? `<p><b>Kevin’s Rule.</b> ${esc(s.extremeThing)}${m.extremeDone === true ? ' (done)' : m.extremeDone === false ? ' (not done)' : ''}</p>` : ''}`
    : ''
}
${m.extremeIncident ? `<p><b>Extreme incident.</b> ${esc(m.extremeIncident.title)}, ${formatLong(m.extremeIncident.date)} (${m.extremeIncident.mark})</p>` : ''}
${highlights.length ? `<h4>Weekly highlights</h4><ul>${highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
${titles.length ? `<h4>Day titles</h4><ul class="titles">${titles.map((d) => `<li><span class="k">${Number(d.date.slice(8))}</span> ${esc(d.title)}</li>`).join('')}</ul>` : ''}
</section>`;
    })
    .join('\n');

  const writing = days
    .filter((d) => d.title || d.writing || d.media.length)
    .map((d) => {
      const f = feeling(d.feeling);
      const photos = d.media
        .filter((x) => x.kind === 'photo')
        .map((x) => input.photo(d, x.path))
        .filter(Boolean)
        // Decoded before the page is drawn: a photo still decoding when the PDF is made comes out blank.
        .map((src) => `<img src="${src}" decoding="sync" loading="eager" alt="">`)
        .join('');
      const sounds = d.media.filter((x) => x.kind !== 'photo');
      let listen = '';
      if (sounds.length && player) {
        listen = sounds
          .map((x) => {
            const src = input.sound?.(d, x);
            const name = esc(x.path.replace(/^media\//, ''));
            if (!src)
              return `<div class="miss">${x.kind === 'video' ? 'Video' : 'Voice note'} ${name}: too large for the book; it is in the Journal folder.</div>`;
            return x.kind === 'video'
              ? `<video controls playsinline preload="metadata" src="${src}"></video>`
              : `<audio controls preload="metadata" src="${src}"></audio>`;
          })
          .join('');
        listen = `<div class="av">${listen}</div>`;
      } else if (sounds.length) {
        listen = `<div class="listen">${esc(soundWords(sounds))}: play ${sounds.length === 1 ? 'it' : 'them'} in the ${year} book with sound and video, or find ${sounds.length === 1 ? 'it' : 'them'} in the Journal folder (${sounds.map((x) => esc(x.path.replace(/^media\//, ''))).join(', ')}).</div>`;
      }
      return `<article><div class="meta">${f ? `<i style="background:${f.color}"></i>${f.score} ${esc(f.name)} &middot; ` : ''}${formatLong(d.date)}</div>
${d.title ? `<h3>${esc(d.title)}</h3>` : ''}${d.writing ? `<p>${para(d.writing)}</p>` : ''}${photos ? `<div class="ph">${photos}</div>` : ''}${listen}</article>`;
    })
    .join('\n');

  const defining = input.yearRec?.defining?.text;
  const m = input.misogi;
  const misogi = m
    ? `<p><b>${esc(misogiOf(year))}.</b> ${esc(m.text)}${m.done === true ? ' (done)' : m.done === false ? ' (not this time)' : ''}</p>`
    : '';
  const n = input.openedNote;
  const note = n
    ? player && input.noteSound
      ? `<div class="av"><p><b>A note from 25 December ${n.from}.</b></p><audio controls preload="metadata" src="${input.noteSound}"></audio></div>`
      : `<p class="listen">A voice note from 25 December ${n.from}, opened on 25 December ${year}: ${player ? 'too large for the book; it is' : 'play it in the book with sound and video, or find it'} in the Journal folder (${esc(n.file)}).</p>`
    : '';

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The ${year} book</title><style>
*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}
@page{margin:18mm 16mm}${player ? 'body{max-width:720px;margin:0 auto;padding:24px 18px}' : ''}body{font-family:Georgia,'Times New Roman',serif;color:#1E1E22;font-size:11.5pt;line-height:1.5}
h1{font-size:44pt;margin:0;font-weight:normal}h2{font-size:24pt;font-weight:normal;margin:0 0 10pt}h3{font-size:13pt;margin:4pt 0}h4{font:600 9pt -apple-system,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#66666E;margin:14pt 0 4pt}
.cover{min-height:200mm;display:flex;flex-direction:column;justify-content:center}.cover .sub{color:#66666E;font-size:14pt;margin-top:8pt}
.page{page-break-before:always}.cols{display:flex;gap:24pt}.cols>div{flex:1}ul{padding-left:14pt;margin:2pt 0}.k{color:#66666E;font:9pt -apple-system,Helvetica,sans-serif;margin-right:4pt}
.grid{border-collapse:separate;border-spacing:2pt;margin:10pt 0}.grid th{font:600 8pt Helvetica,sans-serif;color:#66666E}.grid .n{font:7pt Helvetica,sans-serif;color:#66666E;text-align:right}
.c{width:28pt;height:8pt;border-radius:2pt}.c.e{border:.5pt dashed #CBC5BA}
.legend{font:8pt Helvetica,sans-serif;color:#66666E;display:flex;flex-wrap:wrap;gap:8pt}.legend i,.meta i{display:inline-block;width:8pt;height:8pt;border-radius:2pt;margin-right:3pt;vertical-align:-1pt}
article{page-break-inside:avoid;border-top:.5pt solid #E7E2D8;padding:8pt 0}.meta{font:9pt -apple-system,Helvetica,sans-serif;color:#66666E}
.ph{margin-top:6pt;font-size:0}.ph img{display:inline-block;width:48%;height:auto;max-height:70mm;object-fit:cover;border-radius:4pt;margin:0 2% 6pt 0;vertical-align:top}
.listen,.miss{font:9pt -apple-system,Helvetica,sans-serif;color:#66666E;margin-top:6pt}.av{margin-top:8pt}.av audio{display:block;width:100%;margin:4pt 0}.av video{display:block;width:100%;max-height:420px;border-radius:6pt;margin:6pt 0;background:#000}.note{white-space:pre-wrap;font-style:italic;margin-top:30pt}
</style></head><body>
<section class="cover"><h1>${year}</h1><div class="sub">A year of the journal${player ? ', with its voice notes and videos' : ''}</div>
${defining ? `<p style="margin-top:28pt"><b>${NAMES.defining}.</b> ${esc(defining)}</p>` : ''}
${misogi}${note}
${input.note ? `<div class="note">${para(input.note)}</div>` : ''}</section>
<section class="page"><h2>How the days felt</h2>${grid}</section>
${monthPages}
<section class="page"><h2>The days</h2>${writing || '<p>No writing this year.</p>'}</section>
</body></html>`;
}
