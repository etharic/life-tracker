import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from './theme';

/** Converts a metering value (dBFS, about -60 quiet to 0 loud) to a bar height from 0.06 to 1. */
export function levelFromDb(db: number | undefined): number {
  if (db == null || !Number.isFinite(db)) return 0.06;
  return Math.max(0.06, Math.min(1, (db + 55) / 55));
}

/** Squeezes any number of levels into `count` bars (loudest per bucket). */
export function bucket(levels: number[], count: number): number[] {
  if (levels.length <= count) return levels;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const from = Math.floor((i * levels.length) / count);
    const to = Math.max(from + 1, Math.floor(((i + 1) * levels.length) / count));
    out.push(Math.max(...levels.slice(from, to)));
  }
  return out;
}

/**
 * Bars of the recording's loudness. While recording the newest bar is on the right;
 * in playback, bars up to `progress` are filled in the accent colour.
 */
export const Waveform = memo(function Waveform({
  levels,
  count = 48,
  height = 72,
  progress,
}: {
  levels: number[];
  count?: number;
  height?: number;
  progress?: number;
}) {
  const shown = progress == null ? levels.slice(-count) : bucket(levels, count);
  const pad = Array.from({ length: Math.max(0, count - shown.length) }, () => 0.06);
  const bars = progress == null ? [...pad, ...shown] : [...shown, ...pad];
  return (
    <View style={[styles.row, { height }]} accessible={false} importantForAccessibility="no-hide-descendants">
      {bars.map((v, i) => {
        const played = progress == null ? true : i / count <= progress;
        return (
          <View
            key={i}
            style={[
              styles.bar,
              { height: Math.max(3, v * height), backgroundColor: played ? colors.accent : colors.track },
            ]}
          />
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 2 },
  bar: { flex: 1, borderRadius: 2 },
});
