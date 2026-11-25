import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, useExclusiveGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { feeling, FEELINGS } from '../domain/feelings';
import { TextAction } from './controls';
import { haptic } from './haptics';
import { RM } from './motion';
import { T } from './text';
import { colors, space, usePalette } from './theme';

const ORB = 132;
const THUMB = 30;
const STOPS = FEELINGS.map((f) => f.score);
const HUES = FEELINGS.map((f) => f.color);
const SNAP = { damping: 20, stiffness: 320, mass: 0.7, reduceMotion: RM } as const;

/**
 * How the day felt, as one dial (after Apple's State of Mind): drag along the scale and the orb
 * above takes on that feeling's colour and grows as the day gets better, with a light tick at each
 * of the eleven steps. A tap on the scale jumps there. Nothing is saved until the finger lifts.
 */
export function FeelingDial({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const p = usePalette();
  const [width, setWidth] = useState(0);
  // The step under the finger while dragging; the saved value otherwise.
  const [live, setLive] = useState<number | null>(null);
  const shown = live ?? value;
  const f = feeling(shown);
  const pos = useSharedValue(value ?? 5);
  const set = useSharedValue(value == null ? 0 : 1);
  useEffect(() => {
    pos.set(withSpring(value ?? 5, SNAP));
    set.set(withSpring(value == null ? 0 : 1, SNAP));
  }, [value, pos, set]);

  const step = (s: number) => {
    haptic.select();
    setLive(s);
  };
  const commit = (s: number) => {
    setLive(null);
    if (s !== value) onChange(s);
  };

  const track = Math.max(1, width - THUMB);
  const toPos = (x: number) => {
    'worklet';
    return Math.min(10, Math.max(0, ((x - THUMB / 2) / track) * 10));
  };
  const pan = usePanGesture({
    activeOffsetX: [-6, 6],
    failOffsetY: [-12, 12],
    maxPointers: 1,
    onActivate: (e) => {
      'worklet';
      set.set(withSpring(1, SNAP));
      const v = toPos(e.x);
      pos.set(v);
      scheduleOnRN(step, Math.round(v));
    },
    onUpdate: (e) => {
      'worklet';
      const before = Math.round(pos.get());
      const v = toPos(e.x);
      pos.set(v);
      if (Math.round(v) !== before) scheduleOnRN(step, Math.round(v));
    },
    onDeactivate: () => {
      'worklet';
      const s = Math.round(pos.get());
      pos.set(withSpring(s, SNAP));
      scheduleOnRN(commit, s);
    },
  });
  const tap = useTapGesture({
    onActivate: (e) => {
      'worklet';
      const s = Math.round(toPos(e.x));
      set.set(withSpring(1, SNAP));
      pos.set(withSpring(s, SNAP));
      scheduleOnRN(haptic.select);
      scheduleOnRN(commit, s);
    },
  });
  const gesture = useExclusiveGestures(pan, tap);

  const orb = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(set.get(), [0, 1], [p.fill, interpolateColor(pos.get(), STOPS, HUES)]),
    transform: [{ scale: interpolate(pos.get(), [0, 10], [0.78, 1.04]) * interpolate(set.get(), [0, 1], [0.92, 1]) }],
  }));
  const halo = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(pos.get(), STOPS, HUES),
    opacity: 0.22 * set.get(),
    transform: [{ scale: interpolate(pos.get(), [0, 10], [0.9, 1.3]) }],
  }));
  const thumb = useAnimatedStyle(() => ({
    opacity: interpolate(set.get(), [0, 1], [0.55, 1]),
    borderColor: interpolateColor(pos.get(), STOPS, HUES),
    transform: [{ translateX: (pos.get() / 10) * track }],
  }));

  const adjust = (d: number) => {
    // Unset, either direction starts in the middle.
    const s = value == null ? 5 : Math.min(10, Math.max(0, value + d));
    haptic.select();
    onChange(s);
  };

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="How did the day feel"
      accessibilityValue={f ? { min: 0, max: 10, now: f.score, text: `${f.score}, ${f.name}` } : { text: 'Not chosen' }}
      accessibilityActions={[
        { name: 'increment' },
        { name: 'decrement' },
        ...(value != null ? [{ name: 'clear', label: 'Clear the feeling' }] : []),
      ]}
      onAccessibilityAction={(e) => {
        const a = e.nativeEvent.actionName;
        if (a === 'clear') onChange(null);
        else adjust(a === 'increment' ? 1 : -1);
      }}
    >
      <View style={styles.stage}>
        <Animated.View style={[styles.halo, halo]} />
        <Animated.View style={[styles.orb, orb, !f && { borderColor: p.hairline, borderWidth: 1.5 }]}>
          {f ? (
            <T variant="pageTitle" chrome style={[styles.score, { color: f.on }]}>
              {String(f.score)}
            </T>
          ) : (
            <T variant="footnote" tone="ink2" style={styles.center}>
              Drag or tap the scale
            </T>
          )}
        </Animated.View>
      </View>
      <View style={styles.nameRow}>
        {f ? (
          <T variant="title3" weight="600" style={styles.center} accessibilityLiveRegion="polite">
            {f.name}
          </T>
        ) : (
          <T variant="subhead" tone="ink2" style={styles.center}>
            Not chosen yet
          </T>
        )}
      </View>
      <GestureDetector gesture={gesture}>
        <View style={styles.hit} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <LinearGradient
            colors={HUES as unknown as [string, string, ...string[]]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.gradient}
          />
          <Animated.View style={[styles.thumb, { backgroundColor: p.surface }, thumb]} />
        </View>
      </GestureDetector>
      <View style={styles.ends}>
        <T variant="caption" tone="ink2">
          0 worst day ever
        </T>
        {value != null ? (
          <TextAction title="Clear" tone="ink2" onPress={() => onChange(null)} accessibilityLabel="Clear the feeling" />
        ) : null}
        <T variant="caption" tone="ink2">
          10 best day ever
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.m },
  stage: { height: ORB * 1.28, alignItems: 'center', justifyContent: 'center' },
  orb: {
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.edge,
    borderWidth: 1,
  },
  halo: { position: 'absolute', width: ORB, height: ORB, borderRadius: ORB / 2 },
  score: { fontSize: 64, lineHeight: 72, fontVariant: ['tabular-nums'] },
  center: { textAlign: 'center' },
  nameRow: { alignItems: 'center', minHeight: 30 },
  hit: { height: 48, justifyContent: 'center' },
  gradient: { height: 12, borderRadius: 6, marginHorizontal: THUMB / 2 - 6 },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  ends: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
