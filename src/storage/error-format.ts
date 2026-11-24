/**
 * The lines of Documents/errors.log: one block per error, newest last, so a crash can be copied
 * and sent as it is. Kept small: only the last MAX_LOG characters stay.
 */

export const MAX_LOG = 200_000;

export type ErrorKind = 'screen' | 'fatal' | 'background';

export interface ErrorContext {
  when: Date;
  build: string;
  route: string;
  kind: ErrorKind;
}

function describe(e: unknown): { message: string; stack: string } {
  if (e instanceof Error) return { message: `${e.name}: ${e.message}`, stack: e.stack ?? '' };
  if (typeof e === 'string') return { message: e, stack: '' };
  try {
    return { message: JSON.stringify(e) ?? String(e), stack: '' };
  } catch {
    return { message: String(e), stack: '' };
  }
}

/** One error as plain text: a header line, the message, the stack (when there is one). */
export function formatError(e: unknown, c: ErrorContext): string {
  const { message, stack } = describe(e);
  const head = `[${c.when.toISOString()}] ${c.kind} · ${c.build} · ${c.route || '/'}`;
  const body = stack && !stack.startsWith(message) ? `${message}\n${stack}` : stack || message;
  return `${head}\n${body.trim()}\n\n`;
}

/** The log with a new block added, cut from the front to the last `max` characters at a block start. */
export function appendTrimmed(log: string, block: string, max = MAX_LOG): string {
  const next = log + block;
  if (next.length <= max) return next;
  const cut = next.slice(next.length - max);
  const start = cut.indexOf('\n[');
  return start >= 0 ? cut.slice(start + 1) : cut;
}
