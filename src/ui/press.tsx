import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { EASE_OUT } from './motion';
import { colors } from './theme';

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  /** Style of the visible content. */
  style?: StyleProp<ViewStyle>;
  /** Style of the touch area itself, for layout in rows and grids (flex, width). */
  containerStyle?: StyleProp<ViewStyle>;
  /** 'scale' for buttons, chips and boxes; 'highlight' for full-width rows. */
  feedback?: 'scale' | 'highlight';
}

/** Press in quickly, spring back on release: small, physical, on the UI thread. */
const PRESS_IN = { duration: 100, easing: EASE_OUT, reduceMotion: ReduceMotion.System };
/** Back to rest with no overshoot: a press confirms, it does not wobble. */
const RELEASE = { damping: 24, stiffness: 420, mass: 0.6, reduceMotion: ReduceMotion.System };

export function Press({ children, style, containerStyle, feedback = 'scale', onPressIn, onPressOut, ...rest }: Props) {
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={6}
      pressRetentionOffset={16}
      style={containerStyle}
      onPressIn={(e) => {
        if (feedback === 'scale') scale.set(withTiming(0.97, PRESS_IN));
        else setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (feedback === 'scale') scale.set(withSpring(1, RELEASE));
        else setPressed(false);
        onPressOut?.(e);
      }}
      {...rest}
    >
      <Animated.View
        style={[
          feedback === 'scale' ? animated : null,
          style,
          pressed && styles.highlighted,
          rest.disabled && styles.disabled,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  highlighted: { backgroundColor: colors.scrim },
  disabled: { opacity: 0.4 },
});
