import { StyleSheet, View } from 'react-native';

import { T } from './text';
import { colors, space } from './theme';

/** A step of a one-thing-at-a-time flow: its title, step dots ("Step 2 of 5") and a prompt. */
export function StepHead({
  overline,
  title,
  step,
  total,
  prompt,
}: {
  overline: string;
  title: string;
  step: number;
  total: number;
  prompt?: string;
}) {
  return (
    <View style={styles.head}>
      <T variant="pageTitle" accessibilityRole="header">
        {title}
      </T>
      <View style={styles.dots} accessible accessibilityLabel={`Step ${step} of ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.dot, i < step && styles.dotOn]} />
        ))}
        <T variant="footnote" tone="ink2" style={styles.dotsText}>{`${overline}, step ${step} of ${total}`}</T>
      </View>
      {prompt ? (
        <T variant="body" style={styles.prompt}>
          {prompt}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.xs, marginBottom: space.xs },
  prompt: { marginTop: space.s },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: space.xs },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.track },
  dotOn: { backgroundColor: colors.accent },
  dotsText: { marginLeft: space.s },
});
