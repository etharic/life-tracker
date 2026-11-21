import { RecordingPresets, type RecordingOptions } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';

import { logicalDate } from '../domain/dates';
import type { MediaRef } from '../domain/types';
import { useJournal } from './journal';
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

/** Saves a finished take to its day (or year), like any attached recording, and removes the working file. */
export async function saveRecording(owner: MediaOwner, uri: string): Promise<MediaRef> {
  const ref = await addAudio(owner, { uri, name: 'recording.m4a' });
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // The take is safe in the journal; a leftover working file is cleaned up at the next launch.
  }
  return ref;
}

export function discardRecording(uri: string | null): void {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Nothing to clean up.
  }
}

/**
 * Takes left behind when the app was closed during a recording are attached to the day they
 * were made, at the next launch, so no recording is ever lost.
 */
export async function recoverRecordings(): Promise<number> {
  const dir = inProgressDir();
  if (!dir.exists) return 0;
  let n = 0;
  const cutoff = useJournal.getState().settings.dayStartHour;
  for (const item of dir.list()) {
    if (!(item instanceof File) || item.size === 0) continue;
    const date = logicalDate(new Date(item.modificationTime ?? Date.now()), cutoff);
    try {
      await saveRecording(date, item.uri);
      n++;
    } catch {
      // Keep the file for the next attempt.
    }
  }
  return n;
}
