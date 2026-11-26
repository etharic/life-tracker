import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Settings, StyleSheet, View } from 'react-native';

import { formatLong, isISODate } from '@/domain/dates';
import { isActive, runEndingToday } from '@/domain/progress';
import type { ISODate } from '@/domain/types';
import { MediaEditor } from '@/features/day/media-editor';
import { useDay, useToday } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { Button, Field } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { FeelingDial } from '@/ui/feeling-dial';
import { Divider, Screen } from '@/ui/layout';
import { T } from '@/ui/text';
import { ModalHeader } from '@/ui/modal';
import { colors, space } from '@/ui/theme';

const TITLE_LIMIT = 80;

/**
 * The run that today's entry makes, when it deserves the streak moment: today counts with what is
 * being saved, the run is at least two days, and the moment has not been shown today. Remembered
 * on the phone only (it is not part of the journal).
 */
function streakMoment(today: ISODate, title: string, writing: string): number {
  if (Settings.get('LTStreakShown') === today) return 0;
  const days = useJournal.getState().days;
  const cur = days[today];
  const counts = isActive(cur) || title.trim() !== '' || writing.trim() !== '';
  if (!counts) return 0;
  const n = runEndingToday(today, (d) => (d === today ? true : isActive(days[d])));
  if (n < 2) return 0;
  Settings.set({ LTStreakShown: today });
  return n;
}

export default function CloseDaySheet() {
  const params = useLocalSearchParams<{ date: string; focus?: string }>();
  const today = useToday();
  const date = isISODate(params.date) ? params.date : today;
  const day = useDay(date);
  const [title, setTitle] = useState(day.title);
  const [writing, setWriting] = useState(day.writing);

  // Whatever was typed is kept, however the sheet is closed (Save, X or a swipe down).
  const draft = useRef({ title, writing });
  useEffect(() => {
    draft.current = { title, writing };
  }, [title, writing]);
  useEffect(
    () => () => {
      const { title: t, writing: w } = draft.current;
      const cur = useJournal.getState().days[date];
      if ((cur?.title ?? '') !== t.trim() || (cur?.writing ?? '') !== w.trim()) {
        useJournal.getState().updateDay(date, (d) => {
          d.title = t.trim();
          d.writing = w.trim();
        });
      }
    },
    [date],
  );

  const save = () => {
    // Closing today in a way that keeps a run going earns the streak moment, once a day.
    const run = date === today ? streakMoment(today, title, writing) : 0;
    if (run) {
      haptic.commit();
      router.replace(`/streak?n=${run}`);
      return;
    }
    haptic.success();
    router.back();
  };

  return (
    <View style={styles.fill}>
      <ModalHeader
        title={date === today ? 'Journal' : 'This day'}
        subtitle={formatLong(date)}
        onClose={() => router.back()}
      />
      <Screen footer={<Button title="Save" onPress={save} />}>
        {/* The one place the day's feeling is chosen; Today shows the answer. All on the page, no boxes. */}
        <View style={styles.gap}>
          <T variant="subhead" weight="600" tone="ink2" accessibilityRole="header">
            {date === today ? 'How did today feel?' : 'How did the day feel?'}
          </T>
          <FeelingDial
            value={day.feeling}
            onChange={(v) => useJournal.getState().updateDay(date, (d) => void (d.feeling = v))}
          />
        </View>
        <Divider inset={0} />
        <Field
          label="One line for the day"
          value={title}
          onChangeText={setTitle}
          limit={TITLE_LIMIT}
          placeholder="Finished the valuation chapter"
          returnKeyType="next"
          autoCapitalize="sentences"
        />
        <Divider inset={0} />
        <View style={styles.gap}>
          <Field
            label="Anything else about the day"
            value={writing}
            onChangeText={setWriting}
            multiline
            minHeight={160}
            placeholder="Write as much or as little as you like."
            autoCapitalize="sentences"
            // Opened from a reminder: straight into writing.
            autoFocus={params.focus === 'writing'}
          />
          <MediaEditor owner={date} media={day.media} />
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  gap: { gap: space.m },
});
