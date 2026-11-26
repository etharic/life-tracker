import type { ReactNode } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';

import { T } from './text';
import { GUTTER, space } from './theme';

/**
 * A ribbon: a band of soft colour from one edge of the screen to the other, with no corners and
 * no border, named by a word turned on its side at its left end (so no line is spent on a title).
 * Used on Month for the goals, the hobbies and the weeks.
 */
export function Ribbon({
  label,
  tint,
  soft,
  children,
}: {
  label: string;
  /** The colour of the side word. */
  tint: ColorValue;
  /** The ribbon's colour. */
  soft: ColorValue;
  children: ReactNode;
}) {
  return (
    <View style={[styles.ribbon, { backgroundColor: soft }]}>
      <View style={styles.side} accessible accessibilityRole="header" accessibilityLabel={label}>
        <T
          variant="caption"
          weight="700"
          chrome
          numberOfLines={1}
          style={[styles.sideText, { color: tint }]}
          importantForAccessibility="no"
        >
          {label}
        </T>
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  ribbon: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: -GUTTER,
    paddingLeft: space.s,
    paddingRight: GUTTER - space.xs,
    paddingVertical: space.s,
  },
  // The name, turned to read upwards, in a narrow column at the ribbon's left end.
  side: { width: 22, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  sideText: { width: 90, textAlign: 'center', transform: [{ rotate: '-90deg' }], letterSpacing: 0.6 },
  body: { flex: 1, minWidth: 0, paddingLeft: space.xs },
});
