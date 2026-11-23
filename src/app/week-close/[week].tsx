import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatLong, weekDates, weekdayShort, weekIndexInMonth, weekSunday } from '@/domain/dates';
import { feeling } from '@/domain/feelings';
import { WeekItems } from '@/features/day/week-items';
import { useWeek } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { Button, Field } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Divider, Screen, ScreenHeader } from '@/ui/layout';
import { ModalHeader } from '@/ui/modal';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

/** Sunday: tick the weekly checks and name the week's highlight. */
export default function CloseWeek() {
  const { week } = useLocalSearchParams<{ week: string }>();
  const valid = typeof week === 'string' && /^\d{4}-W\d{2}$/.test(week);
  const w = valid ? week : '2000-W01';
  const rec = useWeek(w);
  const days = useJournal((s) => s.days);
  const [highlight, setHighlight] = useState(rec.highlight);

  if (!valid) return null;

  const done = () => {
    useJournal.getState().updateWeek(w, (x) => {
      x.highlight = highlight.trim();
      x.closed = true;
    });
    haptic.success();
    router.back();
  };

  return (
    <View style={styles.fill}>
      <ModalHeader title="" onClose={() => router.back()} />
      <Screen
        footer={
          <View style={styles.footer}>
            <Button title="Done" onPress={done} />
            <Button title="Not now" kind="plain" onPress={() => router.back()} />
          </View>
        }
      >
        <ScreenHeader overline={formatLong(weekSunday(w))} title={`Close week ${weekIndexInMonth(w)}`} />
        {/* The week's commitments, the same capsules as on Today: tick what got done. */}
        <WeekItems week={w} date={weekSunday(w)} interactive />
        <T variant="footnote" tone="ink2" style={styles.hint}>
          Tick anything you did this week.
        </T>
        <Divider inset={0} />
        <Field
          label="Highlight of the week"
          value={highlight}
          onChangeText={setHighlight}
          placeholder="Got the interview invite"
          maxLength={100}
          returnKeyType="done"
        />
        <Divider inset={0} />
        <View style={styles.labelRow}>
          <T variant="subhead" weight="600" tone="ink2" style={styles.flex} accessibilityRole="header">
            {"This week's days"}
          </T>
          <T variant="footnote" tone="ink2">
            to jog your memory
          </T>
        </View>
        <View style={styles.bare}>
          {weekDates(w).map((d, i) => {
            const day = days[d];
            const f = feeling(day?.feeling);
            return (
              <View key={d}>
                {i > 0 ? <Divider /> : null}
                <Press
                  feedback="highlight"
                  onPress={() => router.push(`/day/${d}`)}
                  accessibilityLabel={`${weekdayShort(d)}: ${day?.title || 'no title'}`}
                >
                  <View style={styles.dayRow}>
                    <View style={[styles.bar, f ? { backgroundColor: f.color } : styles.barEmpty]} />
                    <T variant="subhead" tone="ink2" style={styles.dayName}>
                      {weekdayShort(d)}
                    </T>
                    <T variant="body" tone={day?.title ? 'ink' : 'ink3'} numberOfLines={1} style={styles.flex}>
                      {day?.title || 'No title'}
                    </T>
                  </View>
                </Press>
              </View>
            );
          })}
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  footer: { gap: space.xs },
  hint: { marginTop: -space.s },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  // Rows reach out to the gutter so their text lines up with the labels above.
  bare: { marginHorizontal: -space.l },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.l, minHeight: 44 },
  bar: { width: 4, height: 26, borderRadius: 2 },
  barEmpty: { backgroundColor: colors.track },
  dayName: { width: 34 },
});
