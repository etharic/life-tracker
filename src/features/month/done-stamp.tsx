import { useEffect } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { dayNumber, monthName, monthOf, yearOf } from '@/domain/dates';
import type { ISODate } from '@/domain/types';
import { haptic } from '@/ui/haptics';

const INK = { light: '#2E8B3E', dark: '#5BBE6A' };
const TILT = -11;

/**
 * A rubber "DONE" stamp, like PAID on a receipt: it comes down from above, lands with a small
 * overshoot and a thud, and stays as translucent green ink with a double frame and the date.
 */
/** `fresh`: stamped today; the landing is also felt, once per visit. */
export function DoneStamp({ date, fresh }: { date: ISODate | null; fresh?: boolean }) {
  const reduced = useReducedMotion();
  const ink_ = INK[useColorScheme() === 'dark' ? 'dark' : 'light'];
  // Seen on every visit to Month: only the day it was stamped does it come down.
  const still = reduced || !fresh;
  const drop = useSharedValue(still ? 1 : 0);
  const ink = useSharedValue(still ? 0.86 : 0);

  useEffect(() => {
    if (still) return;
    drop.set(withDelay(250, withSpring(1, { damping: 11, stiffness: 260, mass: 0.7 })));
    // The ink darkens on impact and settles a little lighter, as a real stamp does.
    ink.set(
      withDelay(
        330,
        withSequence(
          withTiming(1, { duration: 90 }),
          withTiming(0.86, { duration: 500, easing: Easing.out(Easing.quad) }),
        ),
      ),
    );
    if (!fresh) return;
    const t = setTimeout(() => haptic.commit(), 380);
    return () => clearTimeout(t);
  }, [still, drop, ink, fresh]);

  const style = useAnimatedStyle(() => {
    const d = drop.get();
    return {
      opacity: ink.get() * 0.82,
      transform: [{ scale: 2.4 - 1.4 * d }, { rotate: `${TILT - 8 * (1 - d)}deg` }],
    };
  });

  const label = date
    ? `${dayNumber(date)} ${monthName(monthOf(date)).slice(0, 3)} ${yearOf(date)}`.toUpperCase()
    : null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.stamp, { borderColor: ink_ }, style]}
      accessible
      accessibilityLabel={date ? `Done on ${label}` : 'Done'}
    >
      <View style={[styles.inner, { borderColor: ink_ }]}>
        <Text style={[styles.word, { color: ink_ }]} allowFontScaling={false}>
          DONE
        </Text>
        {label ? (
          <Text style={[styles.date, { color: ink_ }]} allowFontScaling={false}>
            {label}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

/** Room the stamp needs at the right of its row, so it never sits on the words. */
export const STAMP_ROOM = 140;

const styles = StyleSheet.create({
  stamp: {
    position: 'absolute',
    right: 14,
    top: 14,
    borderWidth: 2.5,
    borderRadius: 9,
    padding: 3,
  },
  inner: {
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingTop: 2,
    paddingBottom: 4,
    alignItems: 'center',
  },
  word: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: 3.5,
    fontFamily: 'ui-rounded',
  },
  date: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
});
