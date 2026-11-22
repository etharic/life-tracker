import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { monthName, monthShort } from '@/domain/dates';
import { hobbyTotals } from '@/domain/achievements';
import { CATEGORY_LABEL, formatHours, isGoalCategory } from '@/domain/types';
import { AchievementBanner } from '@/features/achievements';
import { useDayLookup, useToday } from '@/features/hooks';
import { TappableStrip } from '@/features/month/rings';
import { usesOf } from '@/features/past/archive';
import { useJournal } from '@/state/journal';
import { Bar } from '@/ui/charts';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { Empty, Screen, Section } from '@/ui/layout';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, radius, space, TARGET } from '@/ui/theme';

/** One goal's or hobby's history: every month it was used, priority/skill months marked. */
export default function ItemHistory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const months = useJournal((s) => s.months);
  const bank = useJournal((s) => s.bank);
  const achievements = useJournal((s) => s.achievements);
  const lookup = useDayLookup();
  const today = useToday();
  const uses = useMemo(() => usesOf(String(id), months, lookup, today), [id, months, lookup, today]);
  const [selected, setSelected] = useState<string | null>(null);

  const entry = useMemo(() => {
    for (const list of [...Object.values(bank.goals), ...Object.values(bank.hobbies)]) {
      const e = list.find((x) => x.id === id);
      if (e) return e;
    }
    return null;
  }, [bank, id]);

  const name = entry?.text ?? uses[uses.length - 1]?.text ?? '';
  const cat = uses[uses.length - 1]?.category;
  const earned = achievements.filter((a) => a.bankId === id);
  const hours = useMemo(
    () => hobbyTotals(new Map(Object.entries(months)), lookup, today).get(String(id))?.hours,
    [months, lookup, today, id],
  );
  const open = uses.find((u) => u.month === selected) ?? uses[uses.length - 1];

  if (!name) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '' }} />
        <Empty title="This idea could not be found" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: name, headerLargeTitleEnabled: true }} />
      {cat ? (
        <T variant="subhead" tone="ink2">
          {`${CATEGORY_LABEL[cat]} ${isGoalCategory(cat) ? 'goal' : 'hobby'}, on your list for ${uses.length} ${uses.length === 1 ? 'month' : 'months'}${hours != null && !isGoalCategory(cat) ? `, ${formatHours(hours)} in all` : ''}`}
        </T>
      ) : null}
      {earned.map((a) => (
        <AchievementBanner key={`${a.kind}-${a.earned}`} a={a} showText={false} />
      ))}
      {uses.length ? (
        <Section title="Every month it was on your list">
          <View style={styles.list}>
            {uses.map((u) => {
              const isOpen = open?.month === u.month;
              return (
                <Press
                  key={u.month}
                  feedback="highlight"
                  onPress={() => {
                    haptic.select();
                    setSelected(u.month);
                  }}
                  accessibilityLabel={`${monthName(u.month)} ${u.month.slice(0, 4)}, ${u.stat.percent} percent${u.priority ? ', priority' : ''}${u.skill ? ', skill' : ''}`}
                  style={[styles.row, isOpen && styles.rowOpen]}
                >
                  <T variant="headline" style={styles.month}>
                    {monthShort(u.month)}
                  </T>
                  <Bar percent={u.stat.percent} />
                  <T variant="headline" style={styles.pct}>{`${u.stat.percent}%`}</T>
                  <View style={styles.tag}>
                    {u.priority || u.skill ? (
                      <>
                        <Icon name="star.fill" size={11} color={colors.accent} />
                        <T variant="caption" weight="600" tone="accent">
                          {u.priority ? 'priority' : 'skill'}
                        </T>
                      </>
                    ) : null}
                  </View>
                </Press>
              );
            })}
          </View>
          {open ? (
            <View style={styles.strip}>
              <T
                variant="subhead"
                weight="600"
                tone="ink2"
              >{`${monthName(open.month)} ${open.month.slice(0, 4)}, day by day`}</T>
              <TappableStrip stat={open.stat} height={16} />
              <T variant="footnote" tone="ink2">{`${open.stat.ticked} of ${open.stat.passed} days`}</T>
            </View>
          ) : null}
        </Section>
      ) : null}
      <T variant="footnote" tone="ink2">
        Tap a month to see its days.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 2, marginHorizontal: -space.s },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    minHeight: TARGET,
    paddingHorizontal: space.s,
    borderRadius: radius.control,
  },
  rowOpen: { backgroundColor: colors.accentSoft },
  month: { width: 40 },
  pct: { width: 48, textAlign: 'right', fontVariant: ['tabular-nums'] },
  tag: { width: 62, flexDirection: 'row', alignItems: 'center', gap: 3 },
  strip: { gap: space.s, marginTop: space.l },
});
