import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { parseDay, serializeDay } from '../src/format/day';
import { parseMonth, serializeMonth } from '../src/format/month';
import { classify } from '../src/format/paths';
import { parseBank } from '../src/format/records';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('a whole journal folder', () => {
  const dir = mkdtempSync(join(tmpdir(), 'journal-'));
  execFileSync(process.execPath, ['scripts/demo-journal.mjs', dir, '2026-11-19']);
  const files = walk(dir).map((p) => ({ path: relative(dir, p).split('\\').join('/'), text: readFileSync(p, 'utf8') }));

  it('reads every file, and writing it back changes nothing', () => {
    let days = 0;
    let months = 0;
    for (const f of files) {
      const k = classify(f.path);
      if (k.type === 'day') {
        const d = parseDay(f.text, k.date);
        expect(d.date).toBe(k.date);
        expect(parseDay(serializeDay(d), k.date)).toEqual(d);
        days++;
      } else if (k.type === 'month') {
        const m = parseMonth(f.text, k.month);
        expect(m.setup).not.toBeNull();
        expect(parseMonth(serializeMonth(m), k.month)).toEqual(m);
        months++;
      }
    }
    expect(days).toBeGreaterThan(60);
    expect(months).toBe(3);
  });

  it('links months to bank entries by id', () => {
    const bank = parseBank(files.find((f) => f.path === 'bank.md')!.text);
    const ids = new Set([...Object.values(bank.goals), ...Object.values(bank.hobbies)].flat().map((e) => e.id));
    const nov = parseMonth(files.find((f) => f.path === '2026/2026-11/month.md')!.text, '2026-11');
    for (const c of Object.values(nov.setup!.goals)) expect(ids.has(c.bankId)).toBe(true);
  });
});
