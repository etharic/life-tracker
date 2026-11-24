import { File, Paths } from 'expo-file-system';

import { appBuild } from './cache-key';
import { appendTrimmed, formatError, type ErrorKind } from './error-format';

/**
 * Documents/errors.log, beside the Journal folder (so never in a ZIP), visible in the Files app.
 * Writing is synchronous so a fatal error is on disk before the app closes.
 */
export const ERROR_LOG = 'errors.log';

let route = '/';
/** The screen the app is on, for the log's header line. */
export function setErrorRoute(r: string) {
  route = r;
}

/** The text a Copy error button puts on the clipboard. */
export function errorText(e: unknown, kind: ErrorKind = 'screen'): string {
  return formatError(e, { when: new Date(), build: appBuild(), route, kind }).trim();
}

/** Appends an error to the log. Never throws: it must not hide the error it is writing down. */
export function logError(e: unknown, kind: ErrorKind): void {
  try {
    const f = new File(Paths.document, ERROR_LOG);
    const old = f.exists ? f.textSync() : '';
    if (!f.exists) f.create();
    f.write(appendTrimmed(old, formatError(e, { when: new Date(), build: appBuild(), route, kind })));
  } catch {
    // The log is the last resort; nothing more can be done here.
  }
}

interface HermesTracker {
  enablePromiseRejectionTracker?: (o: {
    allRejections: boolean;
    onUnhandled: (id: number, e: unknown) => void;
  }) => void;
}
interface ErrorUtilsLike {
  getGlobalHandler(): (e: unknown, fatal?: boolean) => void;
  setGlobalHandler(h: (e: unknown, fatal?: boolean) => void): void;
}

let installed = false;

/**
 * Fatal JavaScript errors and promise rejections nobody handled are written to the log. The
 * fatal handler writes first and then hands over to the one React Native had, which closes the
 * app as before. Native crashes (memory, a native module) are out of reach of JavaScript.
 */
export function installErrorHandlers(): void {
  if (installed) return;
  installed = true;
  const g = globalThis as unknown as { ErrorUtils?: ErrorUtilsLike; HermesInternal?: HermesTracker };
  const eu = g.ErrorUtils;
  if (eu) {
    const previous = eu.getGlobalHandler();
    eu.setGlobalHandler((e, fatal) => {
      logError(e, fatal ? 'fatal' : 'background');
      previous(e, fatal);
    });
  }
  // In development React Native's own tracker shows rejections on screen; it stays in charge there.
  if (__DEV__) return;
  g.HermesInternal?.enablePromiseRejectionTracker?.({
    allRejections: true,
    onUnhandled: (_id, e) => logError(e, 'background'),
  });
}
