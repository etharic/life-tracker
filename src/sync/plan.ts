/**
 * Two-way sync decisions, kept pure so they can be tested. For every path, compare this
 * iPhone's content hash and Drive's md5 with what both were at the last sync (the base).
 * The rule that matters: if a file changed on both sides, nothing is overwritten; both
 * versions are kept and the person chooses.
 */

export interface BaseEntry {
  /** Hash of the local file at the last sync. */
  local: string;
  /** md5 of the Drive file at the last sync. */
  remote: string;
}

export type Action =
  | { kind: 'upload'; path: string }
  | { kind: 'download'; path: string }
  | { kind: 'delete-remote'; path: string }
  | { kind: 'delete-local'; path: string }
  | { kind: 'record'; path: string; hash: string }
  | { kind: 'forget'; path: string }
  | { kind: 'conflict'; path: string };

export function planSync(
  local: Map<string, string>,
  remote: Map<string, string>,
  base: Record<string, BaseEntry>,
  unresolved: Set<string>,
): Action[] {
  const paths = new Set([...local.keys(), ...remote.keys(), ...Object.keys(base)]);
  const out: Action[] = [];
  for (const path of [...paths].sort()) {
    if (unresolved.has(path)) continue;
    const L = local.get(path) ?? null;
    const R = remote.get(path) ?? null;
    const b = base[path];
    if (!b) {
      if (L && !R) out.push({ kind: 'upload', path });
      else if (!L && R) out.push({ kind: 'download', path });
      else if (L && R) out.push(L === R ? { kind: 'record', path, hash: L } : { kind: 'conflict', path });
      continue;
    }
    const localChanged = L !== b.local;
    const remoteChanged = R !== b.remote;
    if (!localChanged && !remoteChanged) continue;
    if (localChanged && !remoteChanged) {
      out.push(L ? { kind: 'upload', path } : R ? { kind: 'delete-remote', path } : { kind: 'forget', path });
    } else if (!localChanged && remoteChanged) {
      out.push(R ? { kind: 'download', path } : L ? { kind: 'delete-local', path } : { kind: 'forget', path });
    } else if (L === R) {
      out.push(L ? { kind: 'record', path, hash: L } : { kind: 'forget', path });
    } else if (!L && !R) {
      out.push({ kind: 'forget', path });
    } else {
      // Changed on both sides (or deleted on one, edited on the other): keep both, ask.
      out.push({ kind: 'conflict', path });
    }
  }
  return out;
}
