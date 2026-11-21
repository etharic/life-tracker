import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';

import type { DayEntry } from '../domain/types';
import { mediaFile, README, VIEWER } from '../format/paths';
import { readmeText } from '../format/readme';
import { flushWrites, journalStore, useJournal } from '../state/journal';
import { bookHtml } from './book';
import { viewerHtml } from './viewer';

const TEXT = /\.(md|txt|html|json|csv)$/i;

function cacheFile(name: string): File {
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  return f;
}

/** Writes README.txt and viewer.html into the Journal folder, fresh. */
export async function refreshReadmeAndViewer(): Promise<void> {
  const s = useJournal.getState();
  const store = journalStore();
  await store.writeText(README, readmeText(s.settings.noteToReaders));
  await store.writeText(
    VIEWER,
    viewerHtml({
      days: Object.values(s.days),
      months: Object.values(s.months),
      years: Object.values(s.years),
      note: s.settings.noteToReaders,
      generated: s.today,
    }),
  );
}

function markBackup() {
  const today = useJournal.getState().today;
  useJournal.getState().updateSettings((s) => void (s.lastBackup = today));
}

/** One ZIP of the whole Journal folder, viewer.html and README.txt included. */
export async function exportZip(onProgress?: (pct: number) => void): Promise<void> {
  await flushWrites();
  await refreshReadmeAndViewer();
  const store = journalStore();
  const zip = new JSZip();
  const root = zip.folder('Journal')!;
  const files = await store.list();
  for (const f of files) {
    if (TEXT.test(f.path)) {
      root.file(f.path, (await store.readText(f.path)) ?? '');
    } else {
      // Photos and audio are already compressed: store them as they are.
      root.file(f.path, (await store.readBase64(f.path)) ?? '', { base64: true, compression: 'STORE' });
    }
  }
  const b64 = await zip.generateAsync(
    { type: 'base64', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (m) => onProgress?.(m.percent),
  );
  const out = cacheFile(`Journal-${useJournal.getState().today}.zip`);
  out.create();
  await out.write(b64, { encoding: 'base64' });
  await Sharing.shareAsync(out.uri, {
    mimeType: 'application/zip',
    UTI: 'public.zip-archive',
    dialogTitle: 'Save the journal',
  });
  markBackup();
}

/** The yearly book as a printable PDF. Photos are embedded at a reduced size. */
export async function exportBook(year: string): Promise<void> {
  await flushWrites();
  const s = useJournal.getState();
  const store = journalStore();
  const photos = new Map<string, string>();
  for (const d of Object.values(s.days)) {
    if (!d.date.startsWith(year)) continue;
    for (const m of d.media) {
      if (m.kind !== 'photo') continue;
      try {
        const img = await ImageManipulator.manipulate(store.uri(mediaFile(d.date, m.path)))
          .resize({ width: 900, height: null })
          .renderAsync();
        const saved = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
        if (saved.base64) photos.set(`${d.date}/${m.path}`, `data:image/jpeg;base64,${saved.base64}`);
      } catch {
        // A photo that cannot be read is left out of the book; the file itself is untouched.
      }
    }
  }
  const html = bookHtml({
    year,
    days: Object.values(s.days),
    months: Object.values(s.months),
    yearRec: s.years[year],
    note: s.settings.noteToReaders,
    photo: (d: DayEntry, path: string) => photos.get(`${d.date}/${path}`),
  });
  // A4 at 72 points per inch.
  const { uri } = await Print.printToFileAsync({
    html,
    width: 595,
    height: 842,
    margins: { top: 36, bottom: 36, left: 36, right: 36 },
  });
  const out = cacheFile(`Journal ${year}.pdf`);
  await new File(uri).move(out);
  await Sharing.shareAsync(out.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `The ${year} book`,
  });
  markBackup();
}

export interface RestoreReport {
  added: number;
  skipped: number;
}

/**
 * Restores from a ZIP made by this app (or any ZIP of a Journal folder). Files missing here are
 * added; files that already exist are left untouched, so nothing is ever overwritten.
 */
export async function restoreZip(uri: string): Promise<RestoreReport> {
  const zip = await JSZip.loadAsync(await new File(uri).base64(), { base64: true });
  const store = journalStore();
  let added = 0;
  let skipped = 0;
  const entries = Object.values(zip.files).filter((e) => !e.dir);
  // Accept "Journal/2026/..." as well as "2026/..." at the top level.
  const prefix = entries.every((e) => e.name.startsWith('Journal/')) ? 'Journal/' : '';
  for (const e of entries) {
    const path = e.name.slice(prefix.length);
    if (!path || path.startsWith('__MACOSX') || path.split('/').some((p) => p.startsWith('.') || p === '..')) continue;
    if (store.exists(path)) {
      skipped++;
      continue;
    }
    if (TEXT.test(path)) await store.writeText(path, await e.async('string'));
    else await store.writeBase64(path, await e.async('base64'));
    added++;
  }
  await useJournal.getState().reload();
  return { added, skipped };
}
