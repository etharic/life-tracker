import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { colors } from './theme';

const DOTS = 10;
const DISTANCE = 46;

function Dot({ i, t }: { i: number; t: SharedValue<number> }) {
  const angle = (i / DOTS) * Math.PI * 2 - Math.PI / 2;
  const far = DISTANCE * (i % 2 ? 0.75 : 1);
  const style = useAnimatedStyle(() => {
    const v = t.get();
    return {
      opacity: v === 0 ? 0 : 1 - v,
      transform: [
        { translateX: Math.cos(angle) * far * v },
        { translateY: Math.sin(angle) * far * v },
        { scale: 1 - v * 0.6 },
      ],
    };
  });
  return <Animated.View style={[styles.dot, i % 2 ? styles.soft : styles.strong, style]} />;
}

/**
 * A small, quiet burst of dots in the accent colour, played once when `play` turns true.
 * Not confetti: ten dots, 650 ms, then gone. Nothing at all with Reduce Motion.
 */
export function Burst({ play }: { play: boolean }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (play && !reduced) {
      t.set(0);
      t.set(withDelay(80, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) })));
    }
  }, [play, reduced, t]);
  if (reduced) return null;
  return (
    <View pointerEvents="none" style={styles.wrap}>
      {Array.from({ length: DOTS }, (_, i) => (
        <Dot key={i} i={i} t={t} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', width: 7, height: 7, borderRadius: 4 },
  strong: { backgroundColor: colors.accent },
  soft: { backgroundColor: colors.accent, opacity: 0.45 },
});
