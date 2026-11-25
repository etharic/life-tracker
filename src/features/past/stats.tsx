import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatFull, monthShort } from '@/domain/dates';
import { feeling } from '@/domain/feelings';
import { bestWeekdaySentence, weekdayFeelings, writingStats } from '@/domain/stats';
import { useToday } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { Group } from '@/ui/group';
import { BarRow } from '@/ui/bar';
import { Divider, Row, Rows, Section } from '@/ui/layout';
import { T } from '@/ui/text';
import { space } from '@/ui/theme';

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
        {shown.map((r, i) => (
          <View key={r.weekday}>
            {i > 0 ? <Divider /> : null}
            <BarRow
              name={r.name}
              value={r.avg!.toFixed(1)}
              share={r.avg! / 10}
              // The colour of the average feeling: the scale's own colours, the only rainbow.
              color={feeling(Math.round(r.avg!))?.color}
              label={`${r.name}, average ${r.avg!.toFixed(1)} over ${r.days} days`}
            />
          </View>
        ))}
      </Section>
    </Group>
  );
}

/**
 * Your writing on Look back: three rows that keep the page the same length over the years. The
 * months and every year's total are on their own screen.
 */
export function Writing() {
  const days = useJournal((s) => s.days);
  const today = useToday();
  const year = today.slice(0, 4);
  const st = useMemo(() => writingStats(days, year), [days, year]);
  if (!st.total) return null;
  const thisYear = st.years.find((y) => y.year === year)?.words ?? 0;
  return (
    <Group title="Your writing">
      <Section flush>
        <Rows>
          <Row title="Words this year" value={n(thisYear)} />
          {st.longest ? (
            <Row
              title="Longest entry"
              detail={formatFull(st.longest.date)}
              value={`${n(st.longest.words)} words`}
              onPress={() => router.push(`/day/${st.longest!.date}`)}
            />
          ) : null}
          <Row title="Every month and year" onPress={() => router.push('/past/writing')} />
        </Rows>
      </Section>
    </Group>
  );
}

/** The writing screen: this year by month, and every year. */
export function WritingDetail() {
  const days = useJournal((s) => s.days);
  const today = useToday();
  const year = today.slice(0, 4);
  const st = useMemo(() => writingStats(days, year), [days, year]);
  const months = st.months.filter((m) => m.words > 0);
  const top = Math.max(...months.map((m) => m.words), 1);
  const topYear = Math.max(...st.years.map((y) => y.words), 1);
  return (
    <View style={styles.groups}>
      {months.length ? (
        <Group title={`Words in ${year}`}>
          <Section flush>
            {months.map((m, i) => (
              <View key={m.month}>
                {i > 0 ? <Divider /> : null}
                <BarRow
                  name={monthShort(m.month)}
                  value={n(m.words)}
                  share={m.words / top}
                  label={`${monthShort(m.month)}: ${n(m.words)} words`}
                />
              </View>
            ))}
          </Section>
        </Group>
      ) : null}
      {st.years.length ? (
        <Group title="Every year">
          <Section flush>
            {[...st.years].reverse().map((y, i) => (
              <View key={y.year}>
                {i > 0 ? <Divider /> : null}
                <BarRow
                  name={y.year}
                  value={n(y.words)}
                  share={y.words / topYear}
                  label={`${y.year}: ${n(y.words)} words`}
                />
              </View>
            ))}
          </Section>
        </Group>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sentence: { paddingHorizontal: space.xs },
  groups: { gap: space.xxl },
});
