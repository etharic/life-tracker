import { parseDocument, stringify } from 'yaml';

export const FORMAT = 'journal-v1';

export interface Parsed {
  data: Record<string, unknown>;
  body: string;
}

/** Splits `---\nYAML\n---\nbody`. A file without frontmatter is all body. */
export function parseFrontmatter(text: string): Parsed {
  const src = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  if (!src.startsWith('---\n')) return { data: {}, body: src };
  const end = src.indexOf('\n---', 4);
  if (end < 0) return { data: {}, body: src };
  const yamlText = src.slice(4, end);
  let rest = src.slice(end + 4);
  if (rest.startsWith('\n')) rest = rest.slice(1);
  const doc = parseDocument(yamlText);
  if (doc.errors.length) throw new Error(`Invalid frontmatter: ${doc.errors[0].message}`);
  const data = doc.toJS() as unknown;
  return {
    data: data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {},
    body: rest,
  };
}

/** Writes frontmatter in block style (one named field per line) followed by the body. */
export function serializeFrontmatter(data: Record<string, unknown>, body = ''): string {
  const yaml = stringify(data, { lineWidth: 0, defaultStringType: 'PLAIN', defaultKeyType: 'PLAIN' });
  const b = body.replace(/\s+$/, '');
  return `---\n${yaml}---\n${b ? `${b}\n` : ''}`;
}

// ---------- Small readers that never throw on old or hand-edited files ----------

export function str(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return fallback;
}

export function bool(v: unknown): boolean {
  return v === true || v === 'true' || v === 'yes';
}

export function boolOrNull(v: unknown): boolean | null {
  if (v === true || v === 'true') return true;
  if (v === false || v === 'false') return false;
  return null;
}

export function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** Keys of `data` not in `known`, kept so a future version's fields survive a save. */
export function extras(data: Record<string, unknown>, known: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) if (!known.includes(k)) out[k] = v;
  return out;
}
