import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatFull, monthShort } from '@/domain/dates';
import { feeling } from '@/domain/feelings';
import { bestWeekdaySentence, weekdayFeelings, writingStats } from '@/domain/stats';
import { useToday } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { Group } from '@/ui/group';
import { Divider, Row, Section } from '@/ui/layout';
import { T } from '@/ui/text';
import { colors, radius, space } from '@/ui/theme';

const n = (x: number) => x.toLocaleString('en-GB');

/**
 * How each weekday tends to feel, over the last 180 days. A weekday shows from 8 rated days; the
 * whole group is left out until at least two weekdays have that many.
 */
export function Weekdays() {
  const days = useJournal((s) => s.days);
  const today = useToday();
  const rows = useMemo(() => weekdayFeelings(days, today), [days, today]);
  const shown = rows.filter((r) => r.avg != null);
  if (shown.length < 2) return null;
  const sentence = bestWeekdaySentence(rows);
  return (
    <Group title="Your weekdays">
      {sentence ? (
        <T variant="journalBody" style={styles.sentence}>
          {sentence}
        </T>
      ) : null}
      <Section flush>
        {shown.map((r, i) => {
          // The colour of the average feeling, the scale's own colours (the only rainbow).
          const f = feeling(Math.round(r.avg!));
          return (
            <View key={r.weekday}>
              {i > 0 ? <Divider /> : null}
              <View
                style={styles.row}
                accessible
                accessibilityLabel={`${r.name}, average ${r.avg!.toFixed(1)} over ${r.days} days`}
              >
                <T variant="body" style={styles.day}>
                  {r.name}
                </T>
                <View style={styles.track}>
                  <View
                    style={[
                      styles.fill,
                      { width: `${(r.avg! / 10) * 100}%`, backgroundColor: f?.color ?? colors.accent },
                    ]}
                  />
                </View>
                <T variant="body" tone="ink2" style={styles.value}>
                  {r.avg!.toFixed(1)}
                </T>
              </View>
            </View>
          );
        })}
      </Section>
    </Group>
  );
}

/** Words written: this year by month, every year, and the longest entry. Left out until there is writing. */
export function Writing() {
  const days = useJournal((s) => s.days);
  const today = useToday();
  const year = today.slice(0, 4);
  const st = useMemo(() => writingStats(days, year), [days, year]);
  if (!st.total) return null;
  const months = st.months.filter((m) => m.words > 0);
  const top = Math.max(...months.map((m) => m.words), 1);
  return (
    <Group title="Your writing">
      <Section flush>
        {months.map((m, i) => (
          <View key={m.month}>
            {i > 0 ? <Divider /> : null}
            <View style={styles.row} accessible accessibilityLabel={`${monthShort(m.month)}: ${n(m.words)} words`}>
              <T variant="body" style={styles.day}>
                {monthShort(m.month)}
              </T>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${(m.words / top) * 100}%` }]} />
              </View>
              <T variant="body" tone="ink2" style={styles.value}>
                {n(m.words)}
              </T>
            </View>
          </View>
        ))}
        {st.years.map((y) => (
          <View key={y.year}>
            <Divider />
            <Row title={`Words in ${y.year}`} value={n(y.words)} />
          </View>
        ))}
        {st.longest ? (
          <View>
            <Divider />
            <Row
              title="Longest entry"
              detail={formatFull(st.longest.date)}
              value={`${n(st.longest.words)} words`}
              onPress={() => router.push(`/day/${st.longest!.date}`)}
            />
          </View>
        ) : null}
      </Section>
    </Group>
  );
}

const styles = StyleSheet.create({
  sentence: { paddingHorizontal: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 44, paddingHorizontal: space.l },
  day: { width: 104 },
  track: { flex: 1, height: 6, borderRadius: radius.s, backgroundColor: colors.fill, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.s, backgroundColor: colors.accent },
  value: { minWidth: 52, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
