import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colorEase, EASE_OUT } from './motion';
import { colors } from './theme';

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  /** Style of the visible content. */
  style?: StyleProp<ViewStyle>;
  /** Style of the touch area itself, for layout in rows and grids (flex, width). */
  containerStyle?: StyleProp<ViewStyle>;
  /** 'scale' for buttons, chips and boxes; 'highlight' for full-width rows. */
  feedback?: 'scale' | 'highlight';
  /** Background and border colour ease over when they change (a selection). */
  colorTransition?: boolean;
}

/** Press in quickly, spring back on release: small, physical, on the UI thread. */
const PRESS_IN = { duration: 100, easing: EASE_OUT, reduceMotion: ReduceMotion.System };
/** Back to rest with no overshoot: a press confirms, it does not wobble. */
const FADE_OUT = { duration: 220, easing: EASE_OUT, reduceMotion: ReduceMotion.Never };
const RELEASE = { damping: 24, stiffness: 420, mass: 0.6, reduceMotion: ReduceMotion.System };

export function Press({
  children,
  style,
  containerStyle,
  feedback = 'scale',
  colorTransition,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const lit = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const highlight = useAnimatedStyle(() => ({ opacity: lit.get() }));
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={6}
      pressRetentionOffset={16}
      style={containerStyle}
      onPressIn={(e) => {
        if (feedback === 'scale') scale.set(withTiming(0.97, PRESS_IN));
        else lit.set(1);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (feedback === 'scale') scale.set(withSpring(1, RELEASE));
        else lit.set(withTiming(0, FADE_OUT));
        onPressOut?.(e);
      }}
      {...rest}
    >
      <Animated.View
        style={[
          feedback === 'scale' ? animated : null,
          colorTransition ? colorEase : null,
          style,
          rest.disabled && styles.disabled,
        ]}
      >
        {feedback === 'highlight' ? (
          <Animated.View pointerEvents="none" style={[styles.highlighted, highlight]} />
        ) : null}
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  highlighted: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.scrim },
  disabled: { opacity: 0.4 },
});
