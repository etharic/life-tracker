import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { chainSource, weekSuggestions } from '@/domain/chain';
import { formatLong, monthOfWeek, weekIndexInMonth, weekSunday } from '@/domain/dates';
import { WeekItems } from '@/features/day/week-items';
import { useWeek } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { Button } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Divider, Screen, ScreenHeader } from '@/ui/layout';
import { ModalHeader } from '@/ui/modal';
import { SuggestPicker } from '@/ui/suggest-picker';
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
  const month = useJournal((s) => s.months[monthOfWeek(w)]);
  const [fromDay, setFromDay] = useState<string | null>(month?.weekHighlightFrom[w] ?? null);
  const items = useMemo(() => weekSuggestions(w, days), [w, days]);

  if (!valid) return null;

  const done = () => {
    useJournal.getState().updateWeek(w, (x) => {
      x.highlight = highlight.trim();
      x.closed = true;
    });
    // The day it came from, kept only while the text still equals that day's title.
    useJournal.getState().updateMonth(monthOfWeek(w), (m) => {
      if (fromDay && days[fromDay]?.title.trim() === highlight.trim()) m.weekHighlightFrom[w] = fromDay;
      else delete m.weekHighlightFrom[w];
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
        <SuggestPicker
          label="Highlight of the week"
          items={items}
          value={highlight}
          onChange={(t, from) => {
            setHighlight(t);
            setFromDay(chainSource(from?.key)?.ref ?? null);
          }}
          placeholder="Got the interview invite"
          heading="Or use one of this week’s days"
        />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  footer: { gap: space.xs },
  hint: { marginTop: -space.s },
});
