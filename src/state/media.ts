import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { MediaRef } from '../domain/types';
import { mediaFile } from '../format/paths';
import { journalStore, useJournal } from './journal';

export const PHOTO_LONG_EDGE = 2000;

/**
 * What a photo or recording belongs to: a day (its date, 2026-11-19) or a year's defining moment
 * (the year, 2026). Day media lives in the month folder, a year's in the year folder.
 */
export type MediaOwner = string;

export function isYearOwner(owner: MediaOwner): boolean {
  return /^\d{4}$/.test(owner);
}

function mediaOf(owner: MediaOwner): MediaRef[] {
  const s = useJournal.getState();
  return (isYearOwner(owner) ? s.years[owner]?.media : s.days[owner]?.media) ?? [];
}

function setMedia(owner: MediaOwner, fn: (media: MediaRef[]) => MediaRef[]): void {
  const s = useJournal.getState();
  if (isYearOwner(owner)) s.updateYear(owner, (y) => void (y.media = fn(y.media)));
  else s.updateDay(owner, (d) => void (d.media = fn(d.media)));
}

/** media/2026-11-19-3.jpg for a day, media/misogi-1.jpg for a year: the next free number. */
function nextName(owner: MediaOwner, ext: string): string {
  const used = new Set(mediaOf(owner).map((m) => m.path));
  const stem = isYearOwner(owner) ? 'misogi' : owner;
  for (let n = 1; ; n++) {
    const rel = `media/${stem}-${n}.${ext}`;
    if (!used.has(rel) && !journalStore().exists(mediaFile(owner, rel))) return rel;
  }
}

export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
}

/** Resizes (long edge 2000 px), stores as JPEG next to its day or year file, and links it. */
export async function addPhoto(owner: MediaOwner, photo: PickedPhoto): Promise<MediaRef> {
  const ctx = ImageManipulator.manipulate(photo.uri);
  if (Math.max(photo.width, photo.height) > PHOTO_LONG_EDGE) {
    ctx.resize(
      photo.width >= photo.height ? { width: PHOTO_LONG_EDGE, height: null } : { width: null, height: PHOTO_LONG_EDGE },
    );
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  const rel = nextName(owner, 'jpg');
  await journalStore().importFile(saved.uri, mediaFile(owner, rel));
  const ref: MediaRef = { kind: 'photo', path: rel };
  setMedia(owner, (m) => [...m, ref]);
  return ref;
}

/** Stores an audio file exactly as received (m4a etc.). */
export async function addAudio(owner: MediaOwner, file: { uri: string; name: string }): Promise<MediaRef> {
  const ext = (/\.([a-z0-9]{1,5})$/i.exec(file.name)?.[1] ?? 'm4a').toLowerCase();
  const rel = nextName(owner, ext);
  await journalStore().importFile(file.uri, mediaFile(owner, rel));
  const ref: MediaRef = { kind: 'audio', path: rel };
  setMedia(owner, (m) => [...m, ref]);
  return ref;
}

/** Stores a video exactly as received (.mov or .mp4) next to its day. */
export async function addVideo(owner: MediaOwner, file: { uri: string }): Promise<MediaRef> {
  const ext = (/\.([a-z0-9]{1,5})(?:\?|$)/i.exec(file.uri)?.[1] ?? 'mov').toLowerCase();
  const rel = nextName(owner, ext);
  await journalStore().importFile(file.uri, mediaFile(owner, rel));
  const ref: MediaRef = { kind: 'video', path: rel };
  setMedia(owner, (m) => [...m, ref]);
  return ref;
}

export async function removeMedia(owner: MediaOwner, ref: MediaRef): Promise<void> {
  setMedia(owner, (m) => m.filter((x) => x.path !== ref.path));
  await journalStore().remove(mediaFile(owner, ref.path));
}

export function mediaUri(owner: MediaOwner, ref: MediaRef): string {
  return journalStore().uri(mediaFile(owner, ref.path));
}
