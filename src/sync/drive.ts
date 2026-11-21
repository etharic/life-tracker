import { fetch } from 'expo/fetch';
import { Directory, File, Paths } from 'expo-file-system';

import type { FileStore } from '../storage/file-store';
import { accessToken } from './auth';
import { planSync, type BaseEntry } from './plan';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';

/** Sync bookkeeping lives outside the Journal folder (it is not part of the journal). */
const stateDir = new Directory(Paths.document, '.lifetracker');
const conflictDir = new Directory(stateDir, 'conflicts');
const manifestFile = new File(stateDir, 'sync.json');

interface Manifest {
  v: 1;
  rootId: string | null;
  /** path -> last synced hashes, plus the local file's mtime/size to skip re-hashing. */
  base: Record<string, BaseEntry & { mt: number; sz: number }>;
  /** Files changed on both sides, waiting for a choice. */
  conflicts: Record<string, { remoteId: string | null; md5: string | null; found: number }>;
  lastSync: number | null;
}

function emptyManifest(): Manifest {
  return { v: 1, rootId: null, base: {}, conflicts: {}, lastSync: null };
}

export async function readManifest(): Promise<Manifest> {
  try {
    if (!manifestFile.exists) return emptyManifest();
    const m = JSON.parse(await manifestFile.text()) as Manifest;
    return m.v === 1 ? m : emptyManifest();
  } catch {
    return emptyManifest();
  }
}

async function writeManifest(m: Manifest): Promise<void> {
  stateDir.create({ idempotent: true, intermediates: true });
  const tmp = new File(stateDir, 'sync.json.tmp');
  if (tmp.exists) tmp.delete();
  tmp.create();
  await tmp.write(JSON.stringify(m));
  await tmp.move(manifestFile, { overwrite: true });
}

export async function resetManifest(): Promise<void> {
  if (stateDir.exists) stateDir.delete();
}

// ---------- Drive REST ----------

async function api<T>(
  url: string,
  init: { method?: string; body?: string | File; headers?: Record<string, string> } = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const token = await accessToken();
    const res = await fetch(url, {
      method: init.method ?? 'GET',
      body: init.body,
      headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
    if (res.ok) {
      const text = await res.text();
      return (text ? JSON.parse(text) : {}) as T;
    }
    // Rate limits and server hiccups: back off and retry a few times.
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
      continue;
    }
    throw new Error(`Google Drive answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

interface DriveFile {
  id: string;
  mimeType: string;
  md5Checksum?: string;
  createdTime?: string;
  appProperties?: { lt?: string; path?: string };
}

async function listAll(): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const q = encodeURIComponent(
      "trashed = false and (appProperties has { key='lt' and value='file' } or appProperties has { key='lt' and value='folder' } or appProperties has { key='lt' and value='root' })",
    );
    const fields = encodeURIComponent('nextPageToken, files(id, mimeType, md5Checksum, createdTime, appProperties)');
    const page = await api<{ files: DriveFile[]; nextPageToken?: string }>(
      `${API}/files?q=${q}&fields=${fields}&pageSize=1000&spaces=drive${pageToken ? `&pageToken=${pageToken}` : ''}`,
    );
    out.push(...page.files);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return out;
}

async function createFolder(name: string, parent: string | null, props: Record<string, string>): Promise<string> {
  const body = JSON.stringify({
    name,
    mimeType: FOLDER,
    ...(parent ? { parents: [parent] } : {}),
    appProperties: props,
  });
  const r = await api<{ id: string }>(`${API}/files?fields=id`, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  });
  return r.id;
}

function mimeOf(path: string): string {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  return (
    (
      {
        md: 'text/markdown',
        txt: 'text/plain',
        html: 'text/html',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        heic: 'image/heic',
        m4a: 'audio/mp4',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        aac: 'audio/aac',
        caf: 'audio/x-caf',
      } as Record<string, string>
    )[ext] ?? 'application/octet-stream'
  );
}

async function downloadTo(id: string, target: File): Promise<void> {
  const token = await accessToken();
  target.parentDirectory.create({ idempotent: true, intermediates: true });
  const tmp = new File(target.parentDirectory, `.${target.name}.download`);
  await File.downloadFileAsync(`${API}/files/${id}?alt=media`, tmp, {
    headers: { Authorization: `Bearer ${token}` },
    idempotent: true,
  });
  await tmp.move(target, { overwrite: true });
}

// ---------- One sync run ----------

export interface SyncResult {
  uploaded: number;
  downloaded: number;
  conflicts: string[];
}

export async function runSync(store: FileStore): Promise<SyncResult> {
  const m = await readManifest();
  const all = await listAll();

  // The Journal folder in Drive: the oldest one this app made.
  const roots = all
    .filter((f) => f.appProperties?.lt === 'root')
    .sort((a, b) => ((a.createdTime ?? '') < (b.createdTime ?? '') ? -1 : 1));
  let rootId = roots[0]?.id ?? null;
  if (!rootId) rootId = await createFolder('Journal', null, { lt: 'root' });
  if (m.rootId && m.rootId !== rootId) m.base = {}; // a different Drive folder: start a fresh history, never delete
  m.rootId = rootId;

  const folders = new Map<string, string>([['', rootId]]);
  const remote = new Map<string, { id: string; md5: string }>();
  for (const f of all) {
    const p = f.appProperties?.path;
    if (p == null) continue;
    if (f.appProperties?.lt === 'folder') folders.set(p, f.id);
    else if (f.appProperties?.lt === 'file' && f.md5Checksum) remote.set(p, { id: f.id, md5: f.md5Checksum });
  }

  const ensureFolder = async (path: string): Promise<string> => {
    const known = folders.get(path);
    if (known) return known;
    const parentPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    const parent = await ensureFolder(parentPath);
    const id = await createFolder(path.slice(path.lastIndexOf('/') + 1), parent, { lt: 'folder', path });
    folders.set(path, id);
    return id;
  };

  // Local hashes; unchanged files (same mtime and size as at the last sync) are not re-read.
  const local = new Map<string, string>();
  for (const f of await store.list()) {
    if (f.path.endsWith('.tmp') || f.path.endsWith('.download')) continue;
    const b = m.base[f.path];
    local.set(f.path, b && b.mt === f.modified && b.sz === f.size ? b.local : ((await store.md5(f.path)) ?? ''));
  }

  const actions = planSync(
    local,
    new Map([...remote].map(([p, r]) => [p, r.md5])),
    m.base,
    new Set(Object.keys(m.conflicts)),
  );
  const result: SyncResult = { uploaded: 0, downloaded: 0, conflicts: Object.keys(m.conflicts) };

  const record = (path: string, localHash: string, remoteMd5: string) => {
    const s = store.fileRef(path);
    m.base[path] = {
      local: localHash,
      remote: remoteMd5,
      mt: s.exists ? (s.modificationTime ?? 0) : 0,
      sz: s.exists ? s.size : 0,
    };
  };

  for (const a of actions) {
    const r = remote.get(a.path);
    switch (a.kind) {
      case 'upload': {
        const file = store.fileRef(a.path);
        let id = r?.id;
        if (!id) {
          const dir = a.path.includes('/') ? a.path.slice(0, a.path.lastIndexOf('/')) : '';
          const parent = await ensureFolder(dir);
          const name = a.path.slice(a.path.lastIndexOf('/') + 1);
          id = (
            await api<{ id: string }>(`${API}/files?fields=id`, {
              method: 'POST',
              body: JSON.stringify({ name, parents: [parent], appProperties: { lt: 'file', path: a.path } }),
              headers: { 'Content-Type': 'application/json' },
            })
          ).id;
        }
        const up = await api<{ md5Checksum: string }>(`${UPLOAD}/files/${id}?uploadType=media&fields=md5Checksum`, {
          method: 'PATCH',
          body: file,
          headers: { 'Content-Type': mimeOf(a.path) },
        });
        record(a.path, local.get(a.path)!, up.md5Checksum);
        result.uploaded++;
        break;
      }
      case 'download': {
        await downloadTo(r!.id, store.fileRef(a.path));
        record(a.path, r!.md5, r!.md5);
        result.downloaded++;
        break;
      }
      case 'delete-remote':
        await api(`${API}/files/${r!.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ trashed: true }),
          headers: { 'Content-Type': 'application/json' },
        });
        delete m.base[a.path];
        break;
      case 'delete-local':
        await store.remove(a.path);
        delete m.base[a.path];
        result.downloaded++;
        break;
      case 'record':
        record(a.path, a.hash, a.hash);
        break;
      case 'forget':
        delete m.base[a.path];
        break;
      case 'conflict': {
        // Keep Drive's version beside the local one; nothing is overwritten until you choose.
        if (r) await downloadTo(r.id, new File(conflictDir, ...a.path.split('/')));
        m.conflicts[a.path] = { remoteId: r?.id ?? null, md5: r?.md5 ?? null, found: Date.now() };
        result.conflicts.push(a.path);
        break;
      }
    }
  }

  m.lastSync = Date.now();
  await writeManifest(m);
  return result;
}

// ---------- Conflicts ----------

export async function listConflicts(): Promise<string[]> {
  return Object.keys((await readManifest()).conflicts).sort();
}

export function conflictCopy(path: string): File {
  return new File(conflictDir, ...path.split('/'));
}

/** Resolves a conflict: keep this iPhone's version, or Drive's. */
export async function resolveConflict(store: FileStore, path: string, keep: 'local' | 'remote'): Promise<void> {
  const m = await readManifest();
  const c = m.conflicts[path];
  if (!c) return;
  const copy = conflictCopy(path);
  const localFile = store.fileRef(path);
  if (keep === 'remote') {
    if (copy.exists) await copy.move(localFile, { overwrite: true });
    else if (localFile.exists) localFile.delete(); // Drive had deleted it
    const md5 = localFile.exists ? ((await store.md5(path)) ?? '') : '';
    if (c.md5) m.base[path] = { local: md5, remote: c.md5, mt: localFile.modificationTime ?? 0, sz: localFile.size };
    else delete m.base[path];
  } else {
    // Mark the base as Drive's version: the next sync sees only a local change and uploads it.
    const md5 = localFile.exists ? ((await store.md5(path)) ?? '') : '';
    m.base[path] = { local: `${md5}-pending`, remote: c.md5 ?? '', mt: -1, sz: -1 };
    if (!c.md5) delete m.base[path];
    if (copy.exists) copy.delete();
  }
  delete m.conflicts[path];
  await writeManifest(m);
}
