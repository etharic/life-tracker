import { AppState } from 'react-native';
import { create } from 'zustand';

import { flushWrites, journalStore, onLocalWrite, useJournal } from '../state/journal';
import { AuthLostError, connectedAccount, isConnected, signIn, signOut, storedClientId } from './auth';
import { listConflicts, readManifest, resetManifest, resolveConflict, runSync } from './drive';

interface SyncState {
  connected: boolean;
  account: string | null;
  clientId: string | null;
  syncing: boolean;
  lastSync: number | null;
  error: string | null;
  conflicts: string[];
}

export const useSyncState = create<SyncState>()(() => ({
  connected: false,
  account: null,
  clientId: null,
  syncing: false,
  lastSync: null,
  error: null,
  conflicts: [],
}));

function relative(ms: number | null): string {
  if (!ms) return '';
  const min = Math.round((Date.now() - ms) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

export function useSync() {
  const s = useSyncState();
  return { ...s, conflicts: s.conflicts.length, conflictPaths: s.conflicts, lastSyncLabel: relative(s.lastSync) };
}

let running: Promise<void> | null = null;
let again = false;

/** Sync now; if a sync is running, run once more after it. */
export async function syncNow(): Promise<void> {
  if (!useSyncState.getState().connected) return;
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    useSyncState.setState({ syncing: true });
    try {
      do {
        again = false;
        await flushWrites();
        const r = await runSync(journalStore());
        if (r.downloaded > 0) await useJournal.getState().reload();
        useSyncState.setState({ lastSync: Date.now(), error: null, conflicts: [...new Set(r.conflicts)].sort() });
      } while (again);
    } catch (e) {
      if (e instanceof AuthLostError) {
        useSyncState.setState({ connected: false, error: e.message });
      } else {
        const msg = String(e instanceof Error ? e.message : e);
        useSyncState.setState({
          error: /network|offline|internet|timed out/i.test(msg)
            ? 'Offline. Changes stay on this iPhone and sync when you are online.'
            : msg,
        });
      }
    } finally {
      useSyncState.setState({ syncing: false });
      running = null;
    }
  })();
  return running;
}

let timer: ReturnType<typeof setTimeout> | undefined;
function soon(ms = 4000) {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), ms);
}

/** Sync on open, on return to the app, and shortly after every save. Returns a stop function. */
export function startSync(): () => void {
  void (async () => {
    const [connected, account, clientId, manifest, conflicts] = await Promise.all([
      isConnected(),
      connectedAccount(),
      storedClientId(),
      readManifest(),
      listConflicts(),
    ]);
    useSyncState.setState({ connected, account, clientId, lastSync: manifest.lastSync, conflicts });
    if (connected) void syncNow();
  })();
  const stopWrites = onLocalWrite(() => soon());
  let lastActive = 0;
  const sub = AppState.addEventListener('change', (s) => {
    if (s === 'active' && Date.now() - lastActive > 30_000) {
      lastActive = Date.now();
      void syncNow();
    }
    // Leaving the app: push what is pending right away.
    if (s === 'background') void syncNow();
  });
  return () => {
    stopWrites();
    sub.remove();
    clearTimeout(timer);
  };
}

export async function connectDrive(clientId: string): Promise<void> {
  await signIn(clientId);
  useSyncState.setState({ connected: true, clientId: clientId.trim(), account: await connectedAccount(), error: null });
  await syncNow();
}

export async function disconnectDrive(): Promise<void> {
  await signOut();
  await resetManifest();
  useSyncState.setState({ connected: false, account: null, lastSync: null, conflicts: [], error: null });
}

export async function resolve(path: string, keep: 'local' | 'remote'): Promise<void> {
  await resolveConflict(journalStore(), path, keep);
  if (keep === 'remote') await useJournal.getState().reload();
  useSyncState.setState({ conflicts: await listConflicts() });
  void syncNow();
}
