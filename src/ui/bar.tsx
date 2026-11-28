import { StyleSheet, View } from 'react-native';

import { barNeedsOutline } from '@/domain/contrast';

import { radius, usePalette } from './theme';

/**
 * A bar, as DESIGN.md (Bars) sets it: 6 pt tall, the `fill` track, ember unless it shows a
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

/** Above this font scale (accessibility text sizes) a row that would squeeze wraps instead. */
export const STACK_SCALE = 1.35;

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: radius.s, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.s },
});
