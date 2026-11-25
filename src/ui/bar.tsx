import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { barNeedsOutline } from '@/domain/contrast';

import { T } from './text';
import { radius, space, usePalette } from './theme';

/**
 * A bar, as DESIGN.md (Bars) sets it: 6 pt tall, the `fill` track, pen blue unless it shows a
 * feeling. A fill below 3:1 against the track gets a 1 pt ink3 outline so it stays visible.
 */
export function Bar({ share, color }: { share: number; color?: string }) {
  const p = usePalette();
  const fill = color ?? p.accent;
  const outline = barNeedsOutline(fill, p.fill);
  return (
    <View style={[styles.track, { backgroundColor: p.fill }]}>
      <View
        style={[
          styles.fill,
          { width: `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%`, backgroundColor: fill },
          outline ? { borderWidth: 1, borderColor: p.ink3 } : null,
        ]}
      />
    </View>
  );
}

/** Large accessibility text sizes stack a bar row instead of squeezing it. */
export const STACK_SCALE = 1.35;

/**
 * A labelled bar row: name, value and bar on one line, or name and value above a full-width bar
 * at accessibility text sizes.
 */
export function BarRow({
  name,
  value,
  share,
  color,
  label,
}: {
  name: ReactNode;
  value: string;
  share: number;
  color?: string;
  label: string;
}) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > STACK_SCALE;
  return (
    <View style={[styles.row, stacked && styles.stacked]} accessible accessibilityLabel={label}>
      {stacked ? (
        <>
          <View style={styles.line}>
            <T variant="body" style={styles.flex}>
              {name}
            </T>
            <T variant="body" tone="ink2">
              {value}
            </T>
          </View>
          <Bar share={share} color={color} />
        </>
      ) : (
        <>
          <T variant="body" style={styles.name} numberOfLines={1}>
            {name}
          </T>
          <View style={styles.flex}>
            <Bar share={share} color={color} />
          </View>
          <T variant="body" tone="ink2" style={styles.value}>
            {value}
          </T>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: radius.s, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.s },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 44, paddingHorizontal: space.l },
  stacked: { flexDirection: 'column', alignItems: 'stretch', gap: space.s, paddingVertical: space.m },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  flex: { flex: 1 },
  name: { width: 104 },
  value: { minWidth: 52, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
