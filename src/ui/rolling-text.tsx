import { useEffect, useState, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { RM } from './motion';
import { T } from './text';

type TProps = Omit<ComponentProps<typeof T>, 'children'>;

const ROLL = { damping: 22, stiffness: 140, mass: 0.9, reduceMotion: RM } as const;
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Text whose digits roll like an odometer when they change (after Robinhood's numbers): each digit
 * is a column of 0 to 9 that springs to its new place. Everything else in the text stays still.
 * `fromZero` rolls every digit up from 0 when it first appears (a number being revealed).
 * One line only; VoiceOver reads the plain text.
 */
export function RollingText({ text, fromZero, ...props }: { text: string; fromZero?: boolean } & TProps) {
  const [h, setH] = useState(0);
  const chars = [...text];
  return (
    <View style={styles.row} accessible accessibilityLabel={text}>
      {/* Measures one digit's line, so the columns move by exactly one line at any text size. */}
      <T {...props} style={[props.style, styles.probe]} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
        0
      </T>
      {chars.map((c, i) => {
        // Keyed from the right, so the ones stay the ones when the number grows a digit.
        const key = chars.length - i;
        return /\d/.test(c) && h ? (
          <Digit key={key} d={Number(c)} h={h} fromZero={fromZero} delay={i * 40} props={props} />
        ) : (
          <T key={key} {...props}>
            {c}
          </T>
        );
      })}
    </View>
  );
}

function Digit({
  d,
  h,
  fromZero,
  delay,
  props,
}: {
  d: number;
  h: number;
  fromZero?: boolean;
  delay: number;
  props: TProps;
}) {
  const y = useSharedValue(-(fromZero ? 0 : d) * h);
  useEffect(() => {
    y.set(withDelay(fromZero ? delay : 0, withSpring(-d * h, ROLL)));
  }, [d, h, y, fromZero, delay]);
  const roll = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return (
    <View style={{ height: h, overflow: 'hidden' }}>
      <Animated.View style={roll}>
        {DIGITS.map((x) => (
          <T key={x} {...props} style={[props.style, { height: h }]}>
            {x}
          </T>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  probe: { position: 'absolute', opacity: 0 },
});
