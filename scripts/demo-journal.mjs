// Writes a realistic demo Journal folder (journal-v1) for simulator screenshots.
//   node scripts/demo-journal.mjs <out dir> <today YYYY-MM-DD>
// Never used by the app itself.
import { mkdirSync, writeFileSync } from 'node:fs';
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
  `---\nformat: journal-v1\nday_starts_at_hour: 4\nfirst_use: 2026-09-01\nlast_backup: null\nnote_to_future_readers: ""\n---\n`,
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
write('challenges/rejections.md', challengeFile(REJ, 'r'));
write('challenges/bucket-list.md', challengeFile(BUCKET, 'b'));
console.log(`demo journal written to ${out}`);
