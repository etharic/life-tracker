import { planSync } from '../src/sync/plan';

const m = (o: Record<string, string>) => new Map(Object.entries(o));

describe('sync plan', () => {
  it('uploads new local files and downloads new remote files', () => {
    expect(planSync(m({ a: '1' }), m({ b: '2' }), {}, new Set())).toEqual([
      { kind: 'upload', path: 'a' },
      { kind: 'download', path: 'b' },
    ]);
  });

  it('does nothing when neither side changed', () => {
    expect(planSync(m({ a: '1' }), m({ a: '1' }), { a: { local: '1', remote: '1' } }, new Set())).toEqual([]);
  });

  it('sends a local edit up and brings a remote edit down', () => {
    const base = { a: { local: '1', remote: '1' }, b: { local: '1', remote: '1' } };
    expect(planSync(m({ a: '2', b: '1' }), m({ a: '1', b: '3' }), base, new Set())).toEqual([
      { kind: 'upload', path: 'a' },
      { kind: 'download', path: 'b' },
    ]);
  });

  it('never overwrites when the same file changed on both devices', () => {
    const base = { a: { local: '1', remote: '1' } };
    expect(planSync(m({ a: '2' }), m({ a: '3' }), base, new Set())).toEqual([{ kind: 'conflict', path: 'a' }]);
    // A file that exists on both sides without a shared history and differs: also a conflict.
    expect(planSync(m({ a: '2' }), m({ a: '3' }), {}, new Set())).toEqual([{ kind: 'conflict', path: 'a' }]);
  });

  it('treats an edit against a deletion as a conflict, not a silent loss', () => {
    const base = { a: { local: '1', remote: '1' } };
    expect(planSync(m({ a: '2' }), m({}), base, new Set())).toEqual([{ kind: 'conflict', path: 'a' }]);
  });

  it('propagates deletions of unchanged files', () => {
    const base = { a: { local: '1', remote: '1' }, b: { local: '1', remote: '1' } };
    expect(planSync(m({ b: '1' }), m({ a: '1' }), base, new Set())).toEqual([
      { kind: 'delete-remote', path: 'a' },
      { kind: 'delete-local', path: 'b' },
    ]);
  });

  it('records identical content and skips files waiting for a choice', () => {
    expect(planSync(m({ a: '5', c: '1' }), m({ a: '5', c: '2' }), {}, new Set(['c']))).toEqual([
      { kind: 'record', path: 'a', hash: '5' },
    ]);
  });
});
