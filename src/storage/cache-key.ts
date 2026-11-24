import Constants from 'expo-constants';

/**
 * The launch cache holds records as parsed by the build that wrote it. A later build may parse
 * them into a different shape, so a cache is used only by the exact build that wrote it: after
 * every update the files are read once and the cache is written again. Nobody has to remember to
 * raise a version when a field is added.
 */
const FORMAT = 3;

export function appBuild(): string {
  const c = Constants.expoConfig;
  return `${c?.version ?? '0'}+${c?.ios?.buildNumber ?? '0'}`;
}

export function cacheHeader<E>(build: string, entries: Record<string, E>) {
  return { v: FORMAT, b: build, e: entries };
}

/** The entries of a parsed cache file, or none when another build (or format) wrote it. */
export function cacheEntries<E>(json: unknown, build: string): Record<string, E> {
  if (!json || typeof json !== 'object') return {};
  const o = json as { v?: unknown; b?: unknown; e?: unknown };
  if (o.v !== FORMAT || o.b !== build || !o.e || typeof o.e !== 'object') return {};
  return o.e as Record<string, E>;
}
