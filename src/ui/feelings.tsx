import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, type CSSTransitionProperties } from 'react-native-reanimated';

import { feeling, FEELINGS, type Feeling } from '../domain/feelings';
import { haptic } from './haptics';
import { enterSoft } from './motion';
import { T } from './text';
import { colors, radius, space } from './theme';
import { usePop } from './use-pop';

const cellAnim: CSSTransitionProperties = {
  transitionProperty: ['transform', 'opacity'],
  transitionDuration: '160ms',
  transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
};

/** Today's row of 11 boxes: tap to log, tap another to change, tap the same to clear. */
export function FeelingRow({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const f = feeling(value);
  return (
    <View style={styles.wrap}>
      <View style={styles.row} accessibilityRole="adjustable" accessibilityLabel="How did today feel">
        {FEELINGS.map((x) => (
          <FeelingCell key={x.score} feeling={x} value={value} onChange={onChange} />
        ))}
      </View>
      <View style={styles.ends}>
        <T variant="caption" tone="ink2">
          0 worst day ever
        </T>
        <T variant="caption" tone="ink2">
          10 best day ever
        </T>
      </View>
      {f ? (
        <Animated.View key={f.score} entering={enterSoft}>
          <FeelingLabel score={f.score} />
        </Animated.View>
      ) : null}
    </View>
  );
}

function FeelingCell({
  feeling: x,
  value,
  onChange,
}: {
  feeling: Feeling;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const selected = x.score === value;
  const pop = usePop(selected, 0.2);
  return (
    <Pressable
      hitSlop={{ top: 8, bottom: 8 }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${x.score}, ${x.name}`}
      onPress={() => {
        haptic.select();
        onChange(selected ? null : x.score);
      }}
      style={styles.cellHit}
    >
      <Animated.View style={pop}>
        <Animated.View
          style={[
            styles.cell,
            cellAnim,
            { backgroundColor: x.color },
            selected ? styles.cellSelected : value != null ? styles.cellDim : null,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

/** "7 · Good" with its swatch: colour is never the only signal. */
export function FeelingLabel({ score, size = 'large' }: { score: number; size?: 'large' | 'small' }) {
  const f = feeling(score);
  if (!f) return null;
  const sw = size === 'large' ? 22 : 14;
  return (
    <View style={styles.label}>
      <View style={[styles.swatch, { width: sw, height: sw, backgroundColor: f.color }]} />
      <T variant={size === 'large' ? 'title3' : 'subhead'} weight="600">{`${f.score} · ${f.name}`}</T>
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
  wrap: { gap: space.s },
  row: { flexDirection: 'row', gap: 4 },
  cellHit: { flex: 1 },
  cell: {
    height: 40,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.edge,
    transform: [{ scale: 1 }],
    opacity: 1,
  },
  cellSelected: { borderWidth: 2.5, borderColor: colors.ink, transform: [{ scale: 1.08 }] },
  cellDim: { opacity: 0.55 },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { flexDirection: 'row', alignItems: 'center', gap: space.s, marginTop: space.xs },
  swatch: { borderRadius: 5, borderWidth: 1, borderColor: colors.edge },
  box: { borderRadius: radius.s, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  boxEmpty: { borderStyle: 'dashed', borderColor: colors.boxBorder, backgroundColor: 'transparent' },
  boxDim: { opacity: 0.3 },
  boxSelected: { borderWidth: 2.5, borderColor: colors.ink },
  boxCorner: { position: 'absolute', top: 3, left: 5, fontSize: 10, lineHeight: 12 },
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

function FeelingDot({ feeling: x, selected, onPress }: { feeling: Feeling; selected: boolean; onPress: () => void }) {
  const pop = usePop(selected, 0.25);
  return (
    <Pressable
      hitSlop={{ top: 10, bottom: 10, left: 1, right: 1 }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${x.score}, ${x.name}`}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={dotStyles.hit}
    >
      <Animated.View style={[dotStyles.dot, { backgroundColor: x.color }, selected && dotStyles.selected, pop]} />
    </Pressable>
  );
}

/**
 * The compact scale: eleven colour dots on one line. The chosen one grows a ring; its number and
 * name are said beside it by the caller and by VoiceOver.
 */
export function FeelingDots({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <View style={dotStyles.row} accessibilityRole="adjustable" accessibilityLabel="How the day felt, 0 to 10">
      {FEELINGS.map((x) => (
        <FeelingDot
          key={x.score}
          feeling={x}
          selected={x.score === value}
          onPress={() => onChange(x.score === value ? null : x.score)}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hit: { flex: 1, alignItems: 'center' },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.edge },
  selected: { width: 28, height: 28, borderRadius: 14, borderWidth: 3, borderColor: colors.ink },
});
