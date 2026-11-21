import type { ReactNode } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptic } from './haptics';
import { Icon } from './icon';
import { T } from './text';
import { colors, space } from './theme';

/** How far a row travels before letting go counts. */
const THRESHOLD = 84;
const SETTLE = { damping: 22, stiffness: 260, mass: 0.8 };

export interface SwipeAction {
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
  color: ColorValue;
}

/**
 * A list row that can be swiped either way, as in a music app's queue: drag right for `right`,
 * left for `left`. Past the threshold the action's colour fills in and a tick is felt; letting go
 * there triggers it and the row springs back. Vertical scrolling wins over small sideways moves.
 */
export function SwipeRow({
  children,
  right,
  left,
  onSwipe,
  onSwipeStart,
}: {
  children: ReactNode;
  /** Revealed when dragging to the right. */
  right: SwipeAction;
  /** Revealed when dragging to the left. */
  left: SwipeAction;
  onSwipe: (direction: 'right' | 'left') => void;
  /** Called as soon as a swipe takes over (to ignore the tap that ends it). */
  onSwipeStart?: () => void;
}) {
  const x = useSharedValue(0);
  const armed = useSharedValue(0);

  const pan = usePanGesture({
    activeOffsetX: [-14, 14],
    failOffsetY: [-10, 10],
    onActivate: () => {
      'worklet';
      if (onSwipeStart) scheduleOnRN(onSwipeStart);
    },
    onUpdate: (e) => {
      'worklet';
      x.set(e.translationX);
      const now = e.translationX > THRESHOLD ? 1 : e.translationX < -THRESHOLD ? -1 : 0;
      if (now !== armed.get()) {
        armed.set(now);
        if (now !== 0) scheduleOnRN(haptic.select);
      }
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationX > THRESHOLD) scheduleOnRN(onSwipe, 'right');
      else if (e.translationX < -THRESHOLD) scheduleOnRN(onSwipe, 'left');
      armed.set(0);
      x.set(withSpring(0, SETTLE));
    },
  });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const rightStyle = useAnimatedStyle(() => {
    const v = x.get();
    return {
      opacity: interpolate(v, [0, THRESHOLD * 0.4, THRESHOLD], [0, 0.55, 1], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(v, [THRESHOLD * 0.6, THRESHOLD], [0.85, 1], Extrapolation.CLAMP) }],
    };
  });
  const leftStyle = useAnimatedStyle(() => {
    const v = -x.get();
    return {
      opacity: interpolate(v, [0, THRESHOLD * 0.4, THRESHOLD], [0, 0.55, 1], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(v, [THRESHOLD * 0.6, THRESHOLD], [0.85, 1], Extrapolation.CLAMP) }],
    };
  });

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.under, styles.underRight, { backgroundColor: right.color }, rightStyle]}>
        <Icon name={right.icon} size={18} color={colors.onAccent} weight="bold" />
        <T variant="subhead" weight="600" style={styles.underText} chrome>
          {right.label}
        </T>
      </Animated.View>
      <Animated.View style={[styles.under, styles.underLeft, { backgroundColor: left.color }, leftStyle]}>
        <T variant="subhead" weight="600" style={styles.underText} chrome>
          {left.label}
        </T>
        <Icon name={left.icon} size={18} color={colors.onAccent} weight="bold" />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.row, rowStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  row: { backgroundColor: colors.surface },
  under: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    paddingHorizontal: space.xl,
  },
  underRight: { justifyContent: 'flex-start' },
  underLeft: { justifyContent: 'flex-end' },
  underText: { color: colors.onAccent },
});
