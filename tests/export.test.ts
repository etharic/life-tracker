import { bookHtml } from '../src/export/book';
import { viewerHtml } from '../src/export/viewer';
import { emptyDay, emptyMonth } from '../src/domain/types';
import { readmeText } from '../src/format/readme';

const day = {
  ...emptyDay('2026-11-19'),
  title: 'Finished the </script> chapter',
  feeling: 7,
  writing: 'Long library day.',
};
day.media = [{ kind: 'photo', path: 'media/2026-11-19-1.jpg' }];

describe('viewer.html', () => {
  const html = viewerHtml({
    days: [day],
    months: [emptyMonth('2026-11')],
    years: [],
    note: 'For whoever reads this.',
    generated: '2026-11-19',
  });

  it('is one self-contained page: no external scripts or styles', () => {
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+stylesheet/);
  });

  it('carries the days, titles and feelings, safely embedded', () => {
    const json = /<script id="data" type="application\/json">([\s\S]*?)<\/script>/.exec(html)![1];
    const data = JSON.parse(json);
    expect(data.days[0]).toMatchObject({ d: '2026-11-19', t: 'Finished the </script> chapter', f: 7 });
    expect(data.days[0].m[0].p).toBe('2026/2026-11/media/2026-11-19-1.jpg');
    expect(data.feelings).toHaveLength(11);
  });
});

describe('yearly book', () => {
  it('includes the feelings year, the month pages and the writing', () => {
    const html = bookHtml({
      year: '2026',
      days: [day],
      months: [emptyMonth('2026-11')],
      yearRec: undefined,
      note: '',
      photo: () => 'data:image/jpeg;base64,AAAA',
    });
    expect(html).toContain('How the days felt');
    expect(html).toContain('November 2026');
    expect(html).toContain('Finished the &lt;/script&gt; chapter');
    expect(html).toContain('data:image/jpeg;base64,AAAA');
  });
});

describe('README.txt', () => {
  it('explains the format and carries the note to future readers', () => {
    const t = readmeText('Read this first.');
    expect(t).toContain('format: journal-v1');
    expect(t).toContain('Read this first.');
    expect(t).toContain('Best day ever');
  });
});
