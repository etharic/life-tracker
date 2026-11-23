import { RecordingPresets, type RecordingOptions } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';

import { logicalDate } from '../domain/dates';
import { unsealDate } from '../domain/misogi';
import { parseMarker, routeTakes, type Take } from '../domain/takes';
import type { MediaRef } from '../domain/types';
import { mediaFile } from '../format/paths';
import { journalStore, useJournal } from './journal';
import { addAudio, type MediaOwner } from './media';

/**
 * Voice notes recorded in the app. AAC in .m4a, mono (a voice, not music), with level metering
 * for the waveform. They are written to the app's Documents folder while recording, so a take
 * survives even if the app is closed mid-way, and moved into the day's media/ folder on save.
 */
export const VOICE_NOTE: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 96000,
  isMeteringEnabled: true,
  directory: 'document',
};

/** Where expo-audio writes recordings in progress (Documents/ExpoAudio). */
function inProgressDir(): Directory {
  return new Directory(Paths.document, 'ExpoAudio');
}

/** Written when a sealed note starts recording, removed once it is saved or discarded. */
function markerFile(): File {
  return new File(Paths.document, 'sealed-take.json');
}

function deleteFile(uri: string): void {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // A leftover working file is cleaned up at the next launch.
  }
}

/** Saves a finished take to its day (or year), like any attached recording, and removes the working file. */
export async function saveRecording(owner: MediaOwner, uri: string): Promise<MediaRef> {
  const ref = await addAudio(owner, { uri, name: 'recording.m4a' });
  deleteFile(uri);
  return ref;
}

export function discardRecording(uri: string | null): void {
  if (uri) deleteFile(uri);
}

// ---------- The sealed note: its own path, never an attachment ----------

export function beginSealedTake(year: string): void {
  try {
    const f = markerFile();
    if (f.exists) f.delete();
    f.create();
    f.write(JSON.stringify({ year, started: Date.now() - 1000 }));
  } catch {
    // Without the marker a crash would attach the take to a day; the save itself still works.
  }
}

export function endSealedTake(): void {
  try {
    const f = markerFile();
    if (f.exists) f.delete();
  } catch {
    // Nothing to clean up.
  }
}

/** media/sealed-2026.m4a in the year folder, linked only from sealed_note (never listed as media). */
export async function saveSealedNote(year: string, uri: string): Promise<void> {
  const rel = `media/sealed-${year}.m4a`;
  await journalStore().importFile(uri, mediaFile(year, rel));
  useJournal.getState().updateYear(year, (y) => void (y.sealedNote = { path: rel, sealedUntil: unsealDate(year) }));
  deleteFile(uri);
  endSealedTake();
}

export async function removeSealedNote(year: string): Promise<void> {
  const note = useJournal.getState().years[year]?.sealedNote;
  if (!note) return;
  useJournal.getState().updateYear(year, (y) => void (y.sealedNote = null));
  await journalStore().remove(mediaFile(year, note.path));
}

export function sealedNoteUri(year: string, path: string): string | null {
  const p = mediaFile(year, path);
  return journalStore().exists(p) ? journalStore().uri(p) : null;
}

/**
 * Takes left behind when the app was closed during a recording, at the next launch: a sealed
 * note's take returns to its sealed note, any other is attached to the day it was made.
 */
export async function recoverRecordings(): Promise<number> {
  const dir = inProgressDir();
  let marker = null;
  try {
    marker = markerFile().exists ? parseMarker(await markerFile().text()) : null;
  } catch {
    marker = null;
  }
  if (!dir.exists) {
    endSealedTake();
    return 0;
  }
  const takes: Take[] = [];
  for (const item of dir.list())
    if (item instanceof File && item.size > 0)
      takes.push({ uri: item.uri, modified: item.modificationTime ?? Date.now() });
  const route = routeTakes(takes, marker);
  let n = 0;
  const cutoff = useJournal.getState().settings.dayStartHour;
  for (const t of route.toDays) {
    try {
      await saveRecording(logicalDate(new Date(t.modified), cutoff), t.uri);
      n++;
    } catch {
      // Keep the file for the next attempt.
    }
  }
  if (route.toSealed && marker) {
    try {
      await saveSealedNote(marker.year, route.toSealed.uri);
      n++;
    } catch {
      return n;
    }
  }
  for (const t of route.discard) deleteFile(t.uri);
  endSealedTake();
  return n;
}
