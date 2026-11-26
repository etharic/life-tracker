import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { RingStat } from '@/domain/progress';
import { CATEGORY_LABEL, formatHours, type Choice, type MonthSetup } from '@/domain/types';
import { useItemStreak } from '@/features/hooks';
import { Bar, DayStrip, Ring } from '@/ui/charts';
import { StarBadge } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Section } from '@/ui/layout';
import { Ribbon } from '@/ui/ribbon';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { enterRow, exitSoft, layoutMove } from '@/ui/motion';
import { colors, radius, space } from '@/ui/theme';

function choiceOf(setup: MonthSetup, stat: RingStat): Choice {
  return stat.category in setup.goals
    ? setup.goals[stat.category as keyof MonthSetup['goals']]
    : setup.hobbies[stat.category as keyof MonthSetup['hobbies']];
}

/** Tap anywhere on the strip: the day under the finger opens. */
export function TappableStrip({ stat, height = 18 }: { stat: RingStat; height?: number }) {
  const [width, setWidth] = useState(0);
  return (
    <Pressable
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onPress={(e) => {
        if (!width) return;
        const i = Math.min(
          stat.strip.length - 1,
          Math.max(0, Math.floor((e.nativeEvent.locationX / width) * stat.strip.length)),
        );
        const cell = stat.strip[i];
        if (cell.state !== 'future') router.push(`/day/${cell.date}`);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${stat.ticked} of ${stat.passed} days. Opens a day`}
      hitSlop={{ top: 10, bottom: 10 }}
    >
      <DayStrip cells={stat.strip} height={height} />
    </Pressable>
  );
}

function RingDetail({ setup, stat }: { setup: MonthSetup; stat: RingStat }) {
  const choice = choiceOf(setup, stat);
  const isPriority = stat.category === setup.priority;
  const isSkill = stat.category === setup.skill;
  const starred = isPriority || isSkill;
  const streak = useItemStreak(stat.category, starred ? choice.bankId : undefined);
  // The star and the accent colour say priority or skill; the tag is just the category.
  const tag = CATEGORY_LABEL[stat.category];
  return (
    <Section>
      <View style={styles.detail}>
        <View style={styles.detailTop}>
          <View style={styles.flex}>
            <T variant="overline" tone={starred ? 'accent' : 'ink2'}>
              {tag}
            </T>
            <T variant="headline" numberOfLines={2}>
              {choice.text}
            </T>
          </View>
          <T variant="largeTitle" style={styles.tabular}>
            {stat.hours != null ? formatHours(stat.hours) : `${stat.percent}%`}
          </T>
        </View>
        <Bar percent={stat.percent} />
        <TappableStrip stat={stat} />
        <View style={styles.detailFoot}>
          <T variant="subhead" style={styles.tabular}>{`${stat.ticked} of ${stat.passed} days`}</T>
          {starred && streak > 1 ? <T variant="subhead" weight="600" tone="accent">{`${streak}-day streak`}</T> : null}
        </View>
        <T variant="footnote" tone="ink2">
          Tap a day to open it
        </T>
      </View>
    </Section>
  );
}

/**
 * The four goals or the four hobbies of a month on one ribbon (ember for goals, sage for hobbies).
 * Tap a ring for its days.
 */
export function RingGroup({
  label,
  kind,
  setup,
  stats,
}: {
  label: string;
  kind: 'goal' | 'hobby';
  setup: MonthSetup;
  stats: RingStat[];
}) {
  const tint = kind === 'goal' ? colors.accent : colors.hobby;
  const soft = kind === 'goal' ? colors.accentSoft : colors.hobbySoft;
  const [open, setOpen] = useState<string | null>(null);
  const [rowWidth, setRowWidth] = useState(0);
  const selected = stats.find((s) => s.category === open);
  // Four equal columns; the ring fits its column (at most 66 pt) on every iPhone width.
  const column = rowWidth ? (rowWidth - RING_GAP * 3) / 4 : 0;
  const ringSize = column ? Math.max(48, Math.min(66, Math.floor(column - 14))) : 66;
  return (
    <View style={styles.group}>
      <Ribbon label={label} tint={tint} soft={soft}>
        <View style={styles.rings} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
          {stats.map((s) => {
            const choice = choiceOf(setup, s);
            const starred = s.category === setup.priority || s.category === setup.skill;
            const isOpen = s.category === open;
            return (
              <Press
                key={s.category}
                onPress={() => {
                  haptic.select();
                  setOpen(isOpen ? null : s.category);
                }}
                accessibilityState={{ expanded: isOpen }}
                accessibilityHint="Shows its days"
                accessibilityLabel={`${choice.text}, ${CATEGORY_LABEL[s.category]}${starred ? ', starred' : ''}, ${s.hours != null ? `${s.hours} hours` : `${s.percent} percent`}, ${s.ticked} of ${s.passed} days`}
                containerStyle={styles.ringColumn}
                style={[styles.ringCell, isOpen && styles.ringOpen]}
              >
                <View>
                  <Ring
                    color={kind === 'goal' ? 'accent' : 'hobby'}
                    percent={s.percent}
                    size={ringSize}
                    stroke={ringSize > 58 ? 6.5 : 5.5}
                    label={s.hours != null ? `${Number.isInteger(s.hours) ? s.hours : s.hours.toFixed(1)}h` : undefined}
                  />
                  {/* The priority goal and the skill hobby: a star on the ring's corner. */}
                  {starred ? <StarBadge color={tint} top={-2} right={-2} /> : null}
                </View>
                <View style={styles.ringLabel}>
                  <T
                    variant="footnote"
                    weight={starred ? '600' : '400'}
                    tone={starred ? 'ink' : 'ink2'}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    chrome
                    style={styles.shrink}
                  >
                    {s.category in setup.goals ? CATEGORY_LABEL[s.category] : choice.text}
                  </T>
                </View>
              </Press>
            );
          })}
        </View>
      </Ribbon>
      {selected ? (
        <Animated.View key={selected.category} entering={enterRow} exiting={exitSoft} layout={layoutMove}>
          <RingDetail setup={setup} stat={selected} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const RING_GAP = space.xs;

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  shrink: { flexShrink: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  group: { gap: space.m },
  rings: { flex: 1, flexDirection: 'row', gap: RING_GAP },
  // The touch area is the column: equal width, never stretched by its title.
  ringColumn: { flex: 1, flexBasis: 0, minWidth: 0 },
  ringCell: {
    alignItems: 'center',
    gap: space.s,
    paddingVertical: space.s + 2,
    paddingHorizontal: 4,
    borderRadius: radius.section,
  },
  ringOpen: { backgroundColor: colors.surface },
  ringLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, alignSelf: 'stretch' },
  detail: { gap: space.m },
  detailTop: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  detailFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
