import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { isActive } from '@/domain/progress';
import { useStreaks, useToday } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <T variant="title" style={styles.number}>
        {String(value)}
      </T>
      <T variant="footnote" tone="ink2" center numberOfLines={2}>
        {label}
      </T>
    </View>
  );
}

/** Three numbers at the top of Look back, said once: no charts, no judgement. */
export function Insights() {
  const today = useToday();
  const days = useJournal((s) => s.days);
  const { current, longest } = useStreaks();
  const thisYear = useMemo(
    () => Object.values(days).filter((d) => d.date.startsWith(today.slice(0, 4)) && isActive(d)).length,
    [days, today],
  );
  return (
    <View style={styles.row}>
      <Stat value={current} label="Day streak" />
      <View style={styles.rule} />
      <Stat value={longest} label="Longest streak" />
      <View style={styles.rule} />
      <Stat value={thisYear} label={`Days in ${today.slice(0, 4)}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', paddingVertical: space.s },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: space.xs },
  number: { color: colors.accent, fontVariant: ['tabular-nums'] },
  rule: { width: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginVertical: space.xs },
});
