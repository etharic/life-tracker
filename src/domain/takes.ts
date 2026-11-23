/**
 * Where recordings left behind by a crash go at the next launch. A sealed note is recorded
 * with a marker naming its year; takes made after the marker was written belong to that note
 * (the newest one), never to a day, so a crash can never put a sealed note on a media strip.
 */
export interface Take {
  uri: string;
  /** Last modified, in milliseconds. */
  modified: number;
}

export interface SealedMarker {
  year: string;
  /** When the sealed recording started, in milliseconds. */
  started: number;
}

export interface TakeRoute {
  /** Takes attached to the day they were made, as before. */
  toDays: Take[];
  /** The take that becomes the year's sealed note. */
  toSealed: Take | null;
  /** Earlier takes of the same sealed session, replaced by the newest. */
  discard: Take[];
}

export function routeTakes(takes: Take[], marker: SealedMarker | null): TakeRoute {
  if (!marker) return { toDays: takes, toSealed: null, discard: [] };
  const sealed = takes.filter((t) => t.modified >= marker.started).sort((a, b) => b.modified - a.modified);
  return {
    toDays: takes.filter((t) => t.modified < marker.started),
    toSealed: sealed[0] ?? null,
    discard: sealed.slice(1),
  };
}

export function parseMarker(text: string | null): SealedMarker | null {
  if (!text) return null;
  try {
    const o = JSON.parse(text) as { year?: unknown; started?: unknown };
    return typeof o.year === 'string' && /^\d{4}$/.test(o.year) && typeof o.started === 'number'
      ? { year: o.year, started: o.started }
      : null;
  } catch {
    return null;
  }
}
