import { isISODate } from '../domain/dates';
import { isFeelingScore } from '../domain/feelings';
import {
  emptyDay,
  GOAL_CATEGORIES,
  HOBBY_CATEGORIES,
  type DayEntry,
  type ISODate,
  type MediaRef,
} from '../domain/types';
import { arr, bool, extras, FORMAT, obj, parseFrontmatter, serializeFrontmatter, str } from './frontmatter';

const KNOWN = ['format', 'date', 'title', 'feeling', 'goals', 'hobbies', 'hobby_hours', 'priorities_done'] as const;

const MEDIA_LINK = /(!?)\[([^\]]*)\]\((media\/[^)\s]+)\)/g;
const AUDIO_EXT = /\.(m4a|mp3|aac|wav|caf|aif|aiff|ogg|opus|flac|mp4)$/i;

export function mediaKind(path: string): MediaRef['kind'] {
  return AUDIO_EXT.test(path) ? 'audio' : 'photo';
}

function mediaLine(m: MediaRef): string {
  return m.kind === 'photo' ? `![photo](${m.path})` : `[audio](${m.path})`;
}

/**
 * A file body as writing plus attachments. Media links anywhere in the body are attachments;
 * lines that hold nothing but a media link are the app's own attachment lines, not writing.
 */
export function splitBody(body: string): { writing: string; media: MediaRef[] } {
  const media: MediaRef[] = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(MEDIA_LINK)) {
    const path = m[3];
    if (seen.has(path)) continue;
    seen.add(path);
    media.push({ kind: m[1] === '!' ? 'photo' : mediaKind(path), path });
  }
  const lines = body.split('\n').filter((l) => !/^\s*!?\[[^\]]*\]\(media\/[^)\s]+\)\s*$/.test(l));
  return { writing: lines.join('\n').trim(), media };
}

/** The writing, then a line for each attachment not already linked from the writing. */
export function joinBody(writing: string, media: MediaRef[]): string {
  const inWriting = new Set([...writing.matchAll(MEDIA_LINK)].map((m) => m[3]));
  const mediaLines = media.filter((m) => !inWriting.has(m.path)).map(mediaLine);
  return [writing.trim(), mediaLines.join('\n')].filter(Boolean).join('\n\n');
}

export function parseDay(text: string, fallbackDate: ISODate): DayEntry {
  const { data, body } = parseFrontmatter(text);
  const date = isISODate(data.date) ? data.date : fallbackDate;
  const day = emptyDay(date);
  day.title = str(data.title).trim();
  day.feeling = isFeelingScore(data.feeling) ? data.feeling : null;
  const goals = obj(data.goals);
  for (const c of GOAL_CATEGORIES) day.goals[c] = bool(goals[c]);
  const hobbies = obj(data.hobbies);
  for (const c of HOBBY_CATEGORIES) day.hobbies[c] = bool(hobbies[c]);
  const hours = obj(data.hobby_hours);
  for (const c of HOBBY_CATEGORIES) {
    const h = Number(hours[c]);
    if (day.hobbies[c] && Number.isFinite(h) && h > 0 && h !== 1) day.hobbyHours[c] = Math.min(24, h);
  }
  day.prioritiesDone = arr(data.priorities_done)
    .map((p) => str(p))
    .filter(Boolean);

  const { writing, media } = splitBody(body);
  day.writing = writing;
  day.media = media;
  day.extra = extras(data, KNOWN);
  return day;
}

export function serializeDay(day: DayEntry): string {
  const data: Record<string, unknown> = {
    format: FORMAT,
    date: day.date,
    title: day.title,
    feeling: day.feeling,
    goals: { ...day.goals },
    hobbies: { ...day.hobbies },
    ...(Object.keys(day.hobbyHours).length ? { hobby_hours: { ...day.hobbyHours } } : {}),
    priorities_done: [...day.prioritiesDone],
    ...day.extra,
  };
  return serializeFrontmatter(data, joinBody(day.writing, day.media));
}
