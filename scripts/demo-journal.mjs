// Writes a realistic demo Journal folder (journal-v1) for simulator screenshots.
//   node scripts/demo-journal.mjs <out dir> <today YYYY-MM-DD>
// Never used by the app itself.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [out, today] = process.argv.slice(2);
if (!out || !/^\d{4}-\d{2}-\d{2}$/.test(today ?? '')) {
  console.error('usage: node scripts/demo-journal.mjs <out dir> <YYYY-MM-DD>');
  process.exit(1);
}

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (s, n) => iso(new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10) + n)));
const dow = (s) => ((new Date(s + 'T00:00:00Z').getUTCDay() + 6) % 7) + 1;
const write = (rel, text) => {
  const p = join(out, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
};
const q = (s) => JSON.stringify(s);
function isoWeek(s) {
  const th = addDays(s, 4 - dow(s));
  const y = +th.slice(0, 4);
  const w =
    Math.floor((Date.UTC(+th.slice(0, 4), +th.slice(5, 7) - 1, +th.slice(8, 10)) - Date.UTC(y, 0, 1)) / 864e5 / 7) + 1;
  return `${y}-W${pad(w)}`;
}

const TITLES = [
  'Finished the valuation chapter',
  'Bad sleep, great lecture',
  'Rainy walk in the park',
  'Case practice finally clicked',
  'Slow Sunday, long call home',
  'Museum day with friends',
  'Missed the 5 pm dinner rule',
  'Interview prep, three hours deep',
  'Cold start, warm coffee',
  'First full run, 6 km',
  'Library until closing',
  'Left the laptop at home',
  'Saturday market',
  'Cooked for the whole floor',
  'Ukulele chords stopped hurting',
  'Quiet day, early night',
  'Group project went sideways',
  'Sunny lunch by the river',
  'Exam registration done',
  'Long talk with an old friend',
  'Lost in the DCF model',
  'Day trip by train',
  'Read until 1 am',
  'Too much coffee, little done',
];
const BANK = {
  goals: {
    health: ['Dinner before 5 pm', 'In bed by 11 pm', '10,000 steps', 'No sugar after lunch'],
    wealth: ['Log every expense', 'No food delivery', 'Read one market brief'],
    wise: ['Read 20 pages', 'One hour deep work', 'Write three sentences'],
    versatility: ['One new thing', 'Learn ten new words', 'Try a new route'],
  },
  hobbies: {
    intellectual: ['Reading', 'Chess puzzles', 'Podcasts on history'],
    physical: ['Run 5 km', 'Climbing', 'Swimming'],
    creative: ['Ukulele', 'Sketching', 'Photography'],
    social: ['Museum visit', 'Call a friend', 'Board game night with the whole study group'],
  },
};
const ids = {};
let n = 0;
let bank = '---\nformat: journal-v1\n';
for (const kind of ['goals', 'hobbies']) {
  bank += `${kind}:\n`;
  for (const [cat, list] of Object.entries(BANK[kind])) {
    bank += `  ${cat}:\n`;
    for (const text of list) {
      const id = `${kind[0]}${(++n).toString(36).padStart(5, '0')}`;
      ids[text] = id;
      bank += `    - id: ${id}\n      text: ${q(text)}\n      added: 2026-09-01\n`;
    }
  }
}
write('bank.md', bank + '---\nIdeas for daily goals and monthly hobbies, by category.\n');
write(
  'settings.md',
  `---\nformat: journal-v1\nday_starts_at_hour: 4\nfirst_use: 2026-09-01\nlast_backup: null\nnote_to_future_readers: ""\nreminders:\n  - time: "21:00"\n    on: true\n---\n`,
);

const MONTHS = {
  '2026-09': {
    goals: ['Dinner before 5 pm', 'Log every expense', 'Read 20 pages', 'One new thing'],
    hobbies: ['Reading', 'Run 5 km', 'Ukulele', 'Museum visit'],
    extreme: 'Swim across the lake',
  },
  '2026-10': {
    goals: ['Dinner before 5 pm', 'No food delivery', 'Read 20 pages', 'Try a new route'],
    hobbies: ['Chess puzzles', 'Run 5 km', 'Ukulele', 'Call a friend'],
    extreme: 'Give a talk without notes',
  },
  '2026-11': {
    goals: ['Dinner before 5 pm', 'Log every expense', 'Read 20 pages', 'One new thing'],
    hobbies: ['Podcasts on history', 'Run 5 km', 'Ukulele', 'Board game night with the whole study group'],
    extreme: 'Run 10 km without stopping',
  },
};
const GC = ['health', 'wealth', 'wise', 'versatility'];
const HC = ['intellectual', 'physical', 'creative', 'social'];
const PRIOS = [
  ['Send two application emails', 'Finish valuation chapter notes', 'Plan the museum visit'],
  ['Prepare the case interview', 'Send the thank-you notes', 'Book the museum tickets'],
  ['Hand in the problem set', 'Call the landlord', 'Buy running shoes'],
  ['Draft the cover letter', 'Clean up the budget sheet', 'Renew the library card'],
];
const HIGHLIGHTS = [
  'Got the interview invite',
  'First full run, 6 km',
  'Ukulele: a whole song',
  'Dinner with the study group',
  'Finished the problem set early',
];

const days = {};
let titleIx = 0;
for (let d = '2026-09-01'; d <= today; d = addDays(d, 1)) {
  const isToday = d === today;
  const f = Math.min(10, Math.max(1, Math.round(6.4 + (rnd() - 0.5) * 5)));
  const tick = (p) => !isToday && rnd() < p;
  days[d] = {
    title: isToday ? '' : rnd() < 0.86 ? TITLES[titleIx++ % TITLES.length] : '',
    feeling: isToday ? null : rnd() < 0.93 ? f : null,
    goals: [tick(0.84), tick(0.63), tick(0.74), tick(0.47)],
    hobbies: [tick(0.68), tick(0.47), tick(0.82), tick(0.16)],
    prio: [],
  };
}

for (const [month, m] of Object.entries(MONTHS)) {
  if (`${month}-01` > today) continue;
  const weeks = {};
  for (let d = `${month}-01`; d.startsWith(month); d = addDays(d, 1)) {
    if (dow(d) !== 7 || d > addDays(today, 6)) continue;
    const w = isoWeek(d);
    const mon = addDays(d, -6);
    const ps = PRIOS[Object.keys(weeks).length % PRIOS.length];
    const doneCount = d < today ? 2 + (rnd() < 0.5 ? 1 : 0) : 1;
    ps.slice(0, doneCount).forEach((p, i) => {
      const day = addDays(mon, 1 + i);
      if (days[day] && day < today) days[day].prio.push(p);
    });
    weeks[w] = {
      checks: [rnd() < 0.8, rnd() < 0.6, d < today && rnd() < 0.7],
      highlight: d < today ? HIGHLIGHTS[Object.keys(weeks).length % HIGHLIGHTS.length] : '',
      ps,
      started: true,
      closed: d < today,
    };
  }
  let t = `---\nformat: journal-v1\nmonth: ${month}\ngoals:\n`;
  m.goals.forEach((g, i) => (t += `  ${GC[i]}:\n    text: ${q(g)}\n    bank_id: ${ids[g]}\n`));
  t += 'hobbies:\n';
  m.hobbies.forEach((h, i) => (t += `  ${HC[i]}:\n    text: ${q(h)}\n    bank_id: ${ids[h]}\n`));
  const closed = month < today.slice(0, 7);
  t += `priority: health\npriority_kind: build\nskill: creative\nweekly_checks:\n  check_1: "Travel somewhere"\n  check_2: "Read a novel"\n  check_3: "Memory activity"\n`;
  t += `outlook: "Finish the valuation chapters, land two interviews, keep the 5 pm dinner rule, build the ukulele habit."\n`;
  t += `outlook_done: ["Land two interviews", "Keep the 5 pm dinner rule"]\n`;
  // This month's Kevin's Rule was done a few days ago, so the Month page shows its stamp.
  const doneOn = `${today.slice(0, 8)}${String(Math.max(1, Number(today.slice(8)) - 3)).padStart(2, '0')}`;
  t += `extreme_thing:\n  text: ${q(m.extreme)}\n  done: true\n${closed ? '' : `  done_on: ${doneOn}\n`}weeks:\n`;
  for (const [w, x] of Object.entries(weeks)) {
    t += `  ${w}:\n    checks:\n      check_1: ${x.checks[0]}\n      check_2: ${x.checks[1]}\n      check_3: ${x.checks[2]}\n    highlight: ${q(x.highlight)}\n    priorities:\n`;
    t += x.ps.map((p) => `      - text: ${q(p)}\n        done: false\n`).join('');
    t += `    started: ${x.started}\n    closed: ${x.closed}\n`;
  }
  if (closed) {
    const inc = Object.keys(days).find((d) => d.startsWith(month) && days[d].title.includes('Museum')) ?? `${month}-14`;
    t += `extreme_incident:\n  date: ${inc}\n  title: ${q(days[inc]?.title || 'Museum day with friends')}\n  mark: positive\n`;
    // The month highlight, chosen at month close from one of its week highlights.
    const firstWeek = Object.keys(weeks).find((w) => weeks[w].highlight);
    if (firstWeek) t += `highlight: ${q(weeks[firstWeek].highlight)}\nhighlight_from_week: ${firstWeek}\n`;
    t += `close:\n  closed_on: ${month}-${month === '2026-09' ? 30 : 31}\n  keep_priority: true\n  keep_skill: true\n  keep_lineup: true\n`;
  }
  write(`${month.slice(0, 4)}/${month}/month.md`, t + '---\n');
}

for (const [d, x] of Object.entries(days)) {
  const has = x.title || x.feeling != null || x.goals.some(Boolean) || x.hobbies.some(Boolean) || x.prio.length;
  if (!has) continue;
  let t = `---\nformat: journal-v1\ndate: ${d}\ntitle: ${q(x.title)}\nfeeling: ${x.feeling ?? 'null'}\ngoals:\n`;
  GC.forEach((c, i) => (t += `  ${c}: ${x.goals[i]}\n`));
  t += 'hobbies:\n';
  HC.forEach((c, i) => (t += `  ${c}: ${x.hobbies[i]}\n`));
  t += `priorities_done: [${x.prio.map(q).join(', ')}]\n---\n`;
  if (x.title && rnd() < 0.4)
    t += 'Long library day. The chapter finally clicked after lunch. Walked home the long way and called home.\n';
  write(`${d.slice(0, 4)}/${d.slice(0, 7)}/${d}.md`, t);
}
// Yesterday has a photo, a voice note and a video, so the day, its media strip and the yearly book
// can be checked. Only the photo is a real file; the others stand in by name.
{
  const y = addDays(today, -1);
  const folder = `${y.slice(0, 4)}/${y.slice(0, 7)}`;
  const photo = Buffer.from(demoPhoto(), 'base64');
  mkdirSync(join(out, folder, 'media'), { recursive: true });
  writeFileSync(join(out, folder, 'media', `${y}-1.jpg`), photo);
  writeFileSync(join(out, folder, 'media', `${y}-2.m4a`), '');
  writeFileSync(join(out, folder, 'media', `${y}-3.mov`), '');
  const file = join(out, folder, `${y}.md`);
  const body = existsSync(file) ? readFileSync(file, 'utf8') : `---
format: journal-v1
date: ${y}
---
`;
  writeFileSync(file, `${body}
![photo](media/${y}-1.jpg)
[audio](media/${y}-2.m4a)
[video](media/${y}-3.mov)
`);
}
// Challenges: [title, date, started, outcome, notes]
const REJ = [
  ['Applied to a summer internship', addDays(today, -40), true, 'failed', 'Asked for feedback afterwards. They said the case answer was too slow.'],
  ['Asked the café for a student discount', addDays(today, -31), true, 'succeeded', ''],
  ['Cold email asking for a mentor', addDays(today, -22), true, 'failed', ''],
  ['Pitched a column to the student paper', addDays(today, -15), true, 'succeeded', 'They want 600 words by Friday.'],
  ['Asked a friend to review my CV', null, true, 'succeeded', ''],
  ['Applied to an insight day', addDays(today, -6), true, 'open', ''],
  ['Ask to present at the department seminar', null, false, 'open', ''],
  ['Asked for a later deadline on the problem set', addDays(today, -2), true, 'failed', ''],
];
const BUCKET = [
  ['Run a marathon', null, true, 'open', 'Training plan: 16 weeks, four runs a week.'],
  ['See the northern lights', null, false, 'open', ''],
  ['Learn to play a whole album on the ukulele', null, true, 'open', ''],
  ['Swim in all five oceans', null, false, 'open', ''],
  ['Climb a 4,000 m peak', addDays(today, -60), true, 'succeeded', 'Started at 3 am. Worth every step.'],
  ['Write a short story and send it out', addDays(today, -20), true, 'failed', ''],
];
const NL = String.fromCharCode(10);
const EXPERIMENTS = [
  ['No phone for the first hour of the day', addDays(today, -9), true, 'open', `${addDays(today, -9)}: Restless by 8.

${addDays(today, -4)}: Read 30 pages before work instead.`],
  ['Cold shower every morning for two weeks', addDays(today, -30), true, 'succeeded', 'Woke up faster; kept it.'],
  ['Only coffee before noon', addDays(today, -50), true, 'failed', 'Slept no better.'],
  ['Write by hand for a week', null, false, 'open', ''],
];

function challengeFile(items, prefix) {
  const out = ['---', 'format: journal-v1', 'items:'];
  items.forEach(([title, date, started, outcome, notes], i) => {
    out.push(`  - id: ${prefix}${i + 1}`, `    title: ${q(title)}`);
    if (date) out.push(`    date: ${date}`);
    out.push(`    started: ${started}`, `    outcome: ${outcome}`, `    added: ${date ?? addDays(today, -10 - i)}`);
    if (notes) out.push(`    notes: ${q(notes)}`);
  });
  out.push('---', '');
  return out.join(NL);
}
// Last year was reviewed on 25 December: its defining moment, and this year's misogi (the
// bucket list's marathon, still to judge), so Plan, Look back and the year review can be checked.
{
  const last = String(Number(today.slice(0, 4)) - 1);
  write(
    `${last}/year.md`,
    [
      '---',
      'format: journal-v1',
      `year: "${last}"`,
      'defining_incident:',
      '  text: "Moved to a new city on my own"',
      '  source: custom',
      'next_misogi:',
      '  text: "Run a marathon"',
      '  bucket_id: b1',
      '  confirmed: true',
      '  outcome_confirmed: null',
      '  done: null',
      'reviewed: true',
      `reviewed_on: ${last}-12-25`,
      '---',
      '',
    ].join(NL),
  );
}
write('challenges/rejections.md', challengeFile(REJ, 'r'));
write('challenges/bucket-list.md', challengeFile(BUCKET, 'b'));
write('challenges/experiments.md', challengeFile(EXPERIMENTS, 'e'));
console.log(`demo journal written to ${out}`);

/** A small landscape, drawn for the demo. */
function demoPhoto() {
  return '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAFAAeADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDo6KSivLsesLRSUUWAWikoosAtFJRRYBaKSiiwC0UlFFgFopKKLALRSUUWAWikoosAtFJRRYBaKSiiwC0UlFFgFopKKLALRSUUWAWikoosAtFJRRYBaKSiiwC0UlFFgFopKKLALRSUUWAWikoosAtFJRRYBaKSiiwC0UlFFgFopKKLALRSUUWAWikoosAtFJRRYBaKSiiwC0UlFFgEooopiCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA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';
}
