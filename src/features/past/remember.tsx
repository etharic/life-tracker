import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatFull } from '@/domain/dates';
import { feeling } from '@/domain/feelings';
import { goodDayPatterns, onThisDay } from '@/domain/patterns';
import { useToday } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { Group } from '@/ui/group';
import { Icon } from '@/ui/icon';
import { Divider, Section } from '@/ui/layout';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, space, TARGET } from '@/ui/theme';

/**
 * On this day: one row per earlier year with an entry on today's journal date. Absent when there
 * is none, so the first year looks exactly as before.
 */
export function OnThisDay() {
  const today = useToday();
  const days = useJournal((s) => s.days);
  const list = useMemo(() => onThisDay(days, today), [days, today]);
  if (!list.length) return null;
  return (
    <Group title="On this day">
      <Section flush>
        {list.map((d, i) => {
          const f = feeling(d.feeling);
          const title = d.title.trim() || 'No title';
          return (
            <View key={d.date}>
              {i > 0 ? <Divider /> : null}
              <Press
                feedback="highlight"
                onPress={() => router.push(`/day/${d.date}`)}
                accessibilityLabel={`${formatFull(d.date)}: ${title}${f ? `, felt ${f.name}` : ''}`}
              >
                <View style={styles.row}>
                  <View style={[styles.bar, { backgroundColor: f?.color ?? colors.track }]} />
                  <T variant="headline" tone="accent" style={styles.year}>
                    {d.date.slice(0, 4)}
                  </T>
                  <T variant="journalBody" tone={d.title.trim() ? 'ink' : 'ink3'} style={styles.flex} numberOfLines={2}>
                    {title}
                  </T>
                  <Icon name="chevron.right" size={13} color={colors.ink3} weight="semibold" />
                </View>
              </Press>
            </View>
          );
        })}
      </Section>
    </Group>
  );
}

/**
 * Your good days: at most two lines on which of your habits come with your better (or lower)
 * days, from your own last 90 days. Absent until there is enough to say anything honest.
 */
export function GoodDays() {
  const today = useToday();
  const days = useJournal((s) => s.days);
  const patterns = useMemo(() => goodDayPatterns(days, today), [days, today]);
  if (!patterns.length) return null;
  return (
    <Group title="Your good days">
      <Section flush>
        {patterns.map((p, i) => (
          <View key={p.signal}>
            {i > 0 ? <Divider /> : null}
            <Press
              feedback="highlight"
              onPress={() => router.push(`/past/pattern/${p.signal}`)}
              accessibilityLabel={p.sentence}
              accessibilityHint="Shows those days"
            >
              <View style={styles.patternRow}>
                <T variant="journalBody" style={styles.flex}>
                  {p.sentence}
                </T>
                <Icon name="chevron.right" size={13} color={colors.ink3} weight="semibold" />
              </View>
            </Press>
          </View>
        ))}
      </Section>
      <T variant="footnote" tone="ink2" style={styles.foot}>
        A pattern in your own days, not a cause.
      </T>
    </Group>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingRight: space.l, minHeight: TARGET + 8 },
  bar: { width: 4, alignSelf: 'stretch', marginVertical: space.s, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  year: { width: 46, fontVariant: ['tabular-nums'] },
  patternRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.l,
    paddingVertical: space.m,
    minHeight: TARGET + 8,
  },
  foot: { paddingHorizontal: space.xs },
});
