import { FEELINGS } from '../domain/feelings';

/** README.txt: the plain-English key to the folder, for any future reader. */
export function readmeText(noteToReaders: string): string {
  const scale = FEELINGS.map((f) => `    ${String(f.score).padStart(2)}  ${f.name.padEnd(15)} ${f.color}`).join('\n');
  const note = noteToReaders.trim()
    ? `\nA NOTE TO WHOEVER READS THIS\n\n${noteToReaders.trim().replace(/^/gm, '    ')}\n`
    : '';
  return `JOURNAL
=======

This folder is a personal journal, kept day by day with the Life-Tracker app.
Everything is plain text. You do not need the app to read it: any text editor
works, and viewer.html (if present) shows it in a web browser.
${note}
HOW THE FOLDER IS ORGANISED

    README.txt          this file
    viewer.html         open in a browser to read the journal without the app
    bank.md             ideas for daily goals and monthly hobbies, by category
    achievements.md     earned achievements, with the date they were earned
    challenges/rejections.md   the Rejection list: each attempt, its date, outcome and notes
    settings.md         app settings (when a new day starts, last backup)
    2026/               one folder per year
      year.md           the Misogi Ritual of that year
      2026-11/          one folder per month
        month.md        the month's plan and how it went
        2026-11-19.md   one file per day
        media/          photos and audio recordings, linked from the day files

Every .md file starts with a block between two "---" lines. That block holds
named fields (YAML). Below it is free writing. "format: journal-v1" names the
version of this layout. Dates are written YYYY-MM-DD.

THE METHOD

The month is the unit. At the start of each month four daily goals are chosen
(Health, Wealth, Wise, Versatility), one of them the priority goal, which is
either being built or broken. Four hobbies are chosen (Intellectual, Physical,
Creative, Social), one of them the skill being built. Three other commitments
get one box per week. The outlook lists what the month is for, one item per
line; Kevin's Rule is the most extreme thing planned for it.

Each day: tick the goals and hobbies done, give the day a one-line title and
a feeling from 0 to 10, and write anything else. A ticked hobby counts as one
hour; more time is kept under hobby_hours.

Weeks run Monday to Sunday and belong to the month their Sunday falls in.
Each week has priorities and, at its end, a highlight.

At the end of a month the most memorable day is chosen as the extreme
incident (positive or negative). At the end of a year one moment is chosen as
the Misogi Ritual.

WORDS USED

    Kevin's Rule        what was planned as the month's most extreme thing
                        (extreme_thing in the files)
    extreme incident    the day that turned out most memorable that month
    Misogi Ritual       what defined the year (defining_incident in the files)
    achievement         the same priority goal or skill for 3 months in a row,
                        done on more than 80% of the days; or 100, 250, 500
                        and 1000 hours on one hobby, across every month it
                        was chosen

HOW THE DAY FELT (0 TO 10)

${scale}
`;
}
