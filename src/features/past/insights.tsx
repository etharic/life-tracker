import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { isActive } from '@/domain/progress';
import { useStreaks, useToday } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { T } from '@/ui/text';
import { space } from '@/ui/theme';

const days_ = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/**
 * The top of Look back, written as a line in the journal rather than a row of counters:
 * the current run in the serif, then the longest run and the year in one quiet sentence.
 */
export function Insights() {
  const today = useToday();
  const days = useJournal((s) => s.days);
  const { current, longest } = useStreaks();
  const year = today.slice(0, 4);
  const thisYear = useMemo(
    () => Object.values(days).filter((d) => d.date.startsWith(year) && isActive(d)).length,
    [days, year],
  );

  const headline = current > 0 ? `${days_(current)} in a row` : 'Start a new run today';
  const record =
    current > 0 && current >= longest
      ? 'Your longest run yet.'
      : longest > 0
        ? `Your longest run is ${days_(longest)}.`
        : '';
  const written = `${days_(thisYear)} written in ${year}.`;

  return (
    <View style={styles.wrap} accessible accessibilityLabel={`${headline}. ${record} ${written}`}>
      <T variant="display" style={styles.headline}>
        {headline}
      </T>
      <T variant="subhead" tone="ink2">
        {[record, written].filter(Boolean).join(' ')}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs, paddingHorizontal: space.xs, paddingTop: space.xs },
  // A step below the screen title above it, so the two serif lines don't compete.
  headline: { fontSize: 26, lineHeight: 32, fontVariant: ['lining-nums'] },
});
