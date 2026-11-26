import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { feeling } from '@/domain/feelings';
import { bestWeekdaySentence, weekdayFeelings } from '@/domain/stats';
import { useToday } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { Ribbon } from '@/ui/ribbon';
import { T } from '@/ui/text';
import { colors, radius, space } from '@/ui/theme';

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
    <Ribbon label="Weekdays" tint={colors.ink2} soft={colors.fill}>
      {sentence ? (
        <T variant="journalBody" style={styles.sentence}>
          {sentence}
        </T>
      ) : null}
      {/* One glance, as Apple Health shows a week: seven columns in the feeling colours. */}
      <View style={styles.chartPad}>
        <View style={styles.chart}>
          {rows.map((r) => {
            const f = r.avg != null ? feeling(Math.round(r.avg)) : null;
            return (
              <View
                key={r.weekday}
                style={styles.col}
                accessible
                accessibilityLabel={
                  r.avg != null
                    ? `${r.name}, average ${r.avg.toFixed(1)} over ${r.days} days`
                    : `${r.name}, not enough days yet`
                }
              >
                <T variant="caption" weight="600" tone="ink2" style={styles.tabular}>
                  {r.avg != null ? r.avg.toFixed(1) : ''}
                </T>
                <View style={styles.track}>
                  <View
                    style={[
                      styles.fill,
                      {
                        height: `${Math.max(4, ((r.avg ?? 0) / 10) * 100)}%`,
                        backgroundColor: f?.color ?? 'transparent',
                        borderColor: f ? colors.edge : 'transparent',
                      },
                    ]}
                  />
                </View>
                <T variant="caption" weight="600" tone={r.avg != null ? 'ink' : 'ink3'}>
                  {r.name.slice(0, 3)}
                </T>
              </View>
            );
          })}
        </View>
      </View>
    </Ribbon>
  );
}

const styles = StyleSheet.create({
  sentence: { paddingHorizontal: space.s, paddingTop: space.s },
  chartPad: { padding: space.s },
  chart: { flexDirection: 'row', gap: space.s, height: 150, alignItems: 'stretch' },
  col: { flex: 1, alignItems: 'center', gap: space.xs },
  // On the ribbon's fill, the empty part of a column is paper.
  track: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    borderRadius: radius.s,
    backgroundColor: colors.surface,
  },
  fill: { width: '100%', borderRadius: radius.s, borderWidth: StyleSheet.hairlineWidth },
  tabular: { fontVariant: ['tabular-nums'] },
});
