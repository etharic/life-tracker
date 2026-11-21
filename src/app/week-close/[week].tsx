import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatLong, monthOfWeek, weekDates, weekdayShort, weekIndexInMonth, weekSunday } from '@/domain/dates';
import { feeling } from '@/domain/feelings';
import { CHECK_KEYS } from '@/domain/types';
import { useMonth, useWeek } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { Button, CheckRow, Field } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Screen, ScreenHeader, Section } from '@/ui/layout';
import { ModalHeader } from '@/ui/modal';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

/** Sunday: tick the weekly checks and name the week's highlight. */
export default function CloseWeek() {
  const { week } = useLocalSearchParams<{ week: string }>();
  const valid = typeof week === 'string' && /^\d{4}-W\d{2}$/.test(week);
  const w = valid ? week : '2000-W01';
  const month = useMonth(monthOfWeek(w));
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
        {month.setup ? (
          <Section title="Other commitments" tone="accent" flush>
            {CHECK_KEYS.map((k) => (
              <CheckRow
                key={k}
                checked={rec.checks[k]}
                label={month.setup!.weeklyChecks[k]}
                onToggle={() => useJournal.getState().updateWeek(w, (x) => void (x.checks[k] = !x.checks[k]))}
              />
            ))}
            <T variant="footnote" tone="ink2" style={styles.note}>
              Tick anything you did this week.
            </T>
          </Section>
        ) : null}
        <Section>
          <Field
            label="Highlight of the week"
            value={highlight}
            onChangeText={setHighlight}
            placeholder="Got the interview invite"
            maxLength={100}
            returnKeyType="done"
          />
        </Section>
        <Section
          title="This week's days"
          action={
            <T variant="footnote" tone="ink2">
              to jog your memory
            </T>
          }
          flush
        >
          {weekDates(w).map((d) => {
            const day = days[d];
            const f = feeling(day?.feeling);
            return (
              <Press
                key={d}
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
            );
          })}
        </Section>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  footer: { gap: space.xs },
  note: { paddingHorizontal: space.l, paddingBottom: space.m },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.l, minHeight: 44 },
  bar: { width: 4, height: 26, borderRadius: 2 },
  barEmpty: { backgroundColor: colors.track },
  dayName: { width: 34 },
});
