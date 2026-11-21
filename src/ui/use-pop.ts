import { useEffect, useRef } from 'react';
import { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { POP, RM } from './motion';

/**
 * A short spring "pop" when `on` turns true (a tick, a selection, a milestone).
 * Never on first render, so screens do not bounce when they open. Reduce Motion: no movement.
 */
export function usePop(on: boolean, amount = 0.14) {
  const scale = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (on) scale.set(withSequence(withTiming(1 - amount / 2, { duration: 70, reduceMotion: RM }), withSpring(1, POP)));
  }, [on, amount, scale]);
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
}

/** The same pop, fired whenever `value` grows (a streak, a count). */
export function useBump(value: number, amount = 0.12) {
  const scale = useSharedValue(1);
  const prev = useRef(value);
  useEffect(() => {
    if (value > prev.current)
      scale.set(withSequence(withTiming(1 + amount, { duration: 110, reduceMotion: RM }), withSpring(1, POP)));
    prev.current = value;
  }, [value, amount, scale]);
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
}
