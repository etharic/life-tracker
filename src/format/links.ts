import { isISODate } from '../domain/dates';
import type { ListLink, NextMisogi, SealedNote } from '../domain/types';
import { boolOrNull, obj, str } from './frontmatter';

/** `{bucket_id: b7}` or `{rejection_id: r2}`, with the answers to its one-tap questions. */
export function parseLink(v: unknown): ListLink | null {
  const o = obj(v);
  const bucket = str(o.bucket_id);
  const rejection = str(o.rejection_id);
  if (!bucket && !rejection) return null;
  return {
    kind: bucket ? 'bucket' : 'rejections',
    id: bucket || rejection,
    confirmed: boolOrNull(o.confirmed),
    outcomeConfirmed: boolOrNull(o.outcome_confirmed),
  };
}

export function serializeLink(l: ListLink): Record<string, unknown> {
  return {
    [l.kind === 'bucket' ? 'bucket_id' : 'rejection_id']: l.id,
    confirmed: l.confirmed,
    outcome_confirmed: l.outcomeConfirmed,
  };
}

export function parseNextMisogi(v: unknown): NextMisogi | null {
  const o = obj(v);
  const text = str(o.text).trim();
  if (!text) return null;
  const done = boolOrNull(o.done);
  return {
    text,
    link: parseLink(o),
    done,
    doneOn: done === true && isISODate(o.done_on) ? o.done_on : null,
  };
}

export function serializeNextMisogi(m: NextMisogi): Record<string, unknown> {
  return {
    text: m.text,
    ...(m.link ? serializeLink(m.link) : {}),
    done: m.done,
    ...(m.done === true && m.doneOn ? { done_on: m.doneOn } : {}),
  };
}

export function parseSealedNote(v: unknown): SealedNote | null {
  const o = obj(v);
  const path = str(o.path).trim();
  if (!path || !isISODate(o.sealed_until)) return null;
  return { path, sealedUntil: o.sealed_until };
}

export function serializeSealedNote(n: SealedNote): Record<string, unknown> {
  return { path: n.path, sealed_until: n.sealedUntil };
}
