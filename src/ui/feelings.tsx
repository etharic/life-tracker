import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { feeling, FEELINGS } from '../domain/feelings';
import { T } from './text';
import { colors, radius, space } from './theme';

/** "7 · Good" with its swatch: colour is never the only signal. */
export function FeelingLabel({ score, size = 'large' }: { score: number; size?: 'large' | 'small' }) {
  const f = feeling(score);
  if (!f) return null;
  const sw = size === 'large' ? 22 : 14;
  return (
    <View style={styles.label}>
      <View style={[styles.swatch, { width: sw, height: sw, backgroundColor: f.color }]} />
      <T variant={size === 'large' ? 'title3' : 'subhead'} weight="600">{`${f.name} (${f.score})`}</T>
    </View>
  );
}

/**
 * A day's box in the week, month and year views. Empty days: dashed outline.
 * Shows its number when there is room; the accessibility label always says it.
 */
export function FeelingBox({
  score,
  showNumber,
  label,
  selected,
  dim,
  style,
}: {
  score: number | null;
  showNumber?: boolean;
  label?: string;
  selected?: boolean;
  dim?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const f = feeling(score);
  return (
    <View
      style={[
        styles.box,
        f ? { backgroundColor: f.color, borderColor: colors.edge } : styles.boxEmpty,
        dim && styles.boxDim,
        selected && styles.boxSelected,
        style,
      ]}
    >
      {label ? (
        <T variant="caption" weight="600" chrome style={[styles.boxCorner, { color: f ? f.on : colors.ink2 }]}>
          {label}
        </T>
      ) : null}
      {showNumber && f ? (
        <T variant="subhead" weight="700" chrome style={{ color: f.on }}>
          {f.score}
        </T>
      ) : null}
    </View>
  );
}

/** The key under the feelings table: each colour with its number and the feeling it stands for. */
export function FeelingScale() {
  return (
    <View style={styles.scale}>
      {FEELINGS.map((f) => (
        <View key={f.score} style={styles.scaleItem} accessible accessibilityLabel={`${f.score}, ${f.name}`}>
          <View style={[styles.scaleCell, { backgroundColor: f.color }]}>
            <T variant="footnote" weight="700" chrome style={{ color: f.on }}>
              {f.score}
            </T>
          </View>
          <T variant="footnote" tone="ink2" numberOfLines={1} style={styles.scaleName}>
            {f.name}
          </T>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { flexDirection: 'row', alignItems: 'center', gap: space.s, marginTop: space.xs },
  swatch: { borderRadius: 5, borderWidth: 1, borderColor: colors.edge },
  box: { borderRadius: radius.s, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  boxEmpty: { borderStyle: 'dashed', borderColor: colors.boxBorder, backgroundColor: 'transparent' },
  boxDim: { opacity: 0.3 },
  boxSelected: { borderWidth: 2.5, borderColor: colors.ink },
  boxCorner: { position: 'absolute', top: 3, left: 5, fontSize: 11, lineHeight: 13 },
  scale: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6, columnGap: space.m },
  scaleItem: { flexDirection: 'row', alignItems: 'center', gap: space.s, width: '47%' },
  scaleName: { flexShrink: 1 },
  scaleCell: {
    width: 44,
    height: 32,
    borderRadius: radius.s,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.edge,
  },
});
