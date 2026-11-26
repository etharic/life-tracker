import { useEffect, useRef } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  withDelay,
  withSequence,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import type { StripCell } from '../domain/progress';
import { T } from './text';
import { colors, palette, radius } from './theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A progress ring. Fills once on first appearance (instant with Reduce Motion). */
export function Ring({
  percent,
  size = 72,
  stroke = 7,
  label,
  color = 'accent',
}: {
  percent: number;
  size?: number;
  stroke?: number;
  label?: string;
  /** The arc's colour: ember for goals, sage for hobbies. */
  color?: 'accent' | 'hobby';
}) {
  const reduced = useReducedMotion();
  // SVG needs plain colour strings: pick them from the palette of the current appearance.
  const p = palette[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const target = Math.max(0, Math.min(100, percent));
  // Opening Month many times a day should not replay the fill: start where the value is.
  const progress = useSharedValue(target);
  const glow = useSharedValue(0);
  const previous = useRef(target);
  useEffect(() => {
    // From the old value to the new one, never a jump.
    progress.set(reduced ? target : withTiming(target, { duration: 450, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
    // Reaching 100%: one soft halo, once.
    if (target >= 100 && previous.current < 100 && !reduced) {
      glow.set(withDelay(450, withSequence(withTiming(1, { duration: 220 }), withTiming(0, { duration: 600 }))));
    }
    previous.current = target;
  }, [target, reduced, progress, glow]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - progress.get() / 100) }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: glow.get() * 0.9,
    transform: [{ scale: 1 + glow.get() * 0.14 }],
  }));
  return (
    <View style={{ width: size, height: size }} accessible={false}>
      <Animated.View style={[styles.halo, { borderRadius: size / 2 }, haloStyle]} pointerEvents="none" />
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={p.track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={p[color]}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <T variant="subhead" weight="600" chrome style={styles.tabular}>
          {label ?? `${percent}%`}
        </T>
      </View>
    </View>
  );
}

/** A horizontal bar for a percentage. */
export function Bar({ percent, height = 8 }: { percent: number; height?: number }) {
  const target = Math.max(0, Math.min(100, percent)) / 100;
  const fill = useSharedValue(target);
  useEffect(() => {
    fill.set(
      withTiming(target, { duration: 400, easing: Easing.bezier(0.23, 1, 0.32, 1), reduceMotion: ReduceMotion.System }),
    );
  }, [target, fill]);
  // Grows from the left by transform (no layout work per frame).
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.get() }] }));
  return (
    <View style={[styles.bar, { height, borderRadius: height / 2 }]}>
      <Animated.View style={[styles.barFill, { borderRadius: height / 2 }, style]} />
    </View>
  );
}

/** One cell per day: done (accent), missed (track), still to come (faint). */
export function DayStrip({ cells, height = 14 }: { cells: { state: StripCell }[]; height?: number }) {
  return (
    <View style={styles.strip} accessible={false}>
      {cells.map((c, i) => (
        <View
          key={i}
          style={[
            styles.stripCell,
            { height },
            c.state === 'done' ? styles.cellDone : c.state === 'missed' ? styles.cellMissed : styles.cellFuture,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  bar: { backgroundColor: colors.track, overflow: 'hidden', flex: 1 },
  barFill: { height: '100%', width: '100%', backgroundColor: colors.accent, transformOrigin: 'left' },
  halo: { ...StyleSheet.absoluteFill, backgroundColor: colors.accentSoft },
  strip: { flexDirection: 'row', gap: 2 },
  stripCell: { flex: 1, borderRadius: radius.s / 2 },
  cellDone: { backgroundColor: colors.accent },
  cellMissed: { backgroundColor: colors.track },
  cellFuture: { backgroundColor: colors.fill },
});
