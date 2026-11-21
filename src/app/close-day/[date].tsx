import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatLong, isISODate } from '@/domain/dates';
import { MediaEditor } from '@/features/day/media-editor';
import { useDay, useToday } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { Button, Field } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { FeelingRow } from '@/ui/feelings';
import { Screen, Section } from '@/ui/layout';
import { ModalHeader } from '@/ui/modal';
import { colors, space } from '@/ui/theme';

const TITLE_LIMIT = 80;

export default function CloseDaySheet() {
  const params = useLocalSearchParams<{ date: string }>();
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
    haptic.success();
    router.back();
  };

  return (
    <View style={styles.fill}>
      <ModalHeader
        title={date === today ? 'Close the day' : 'This day'}
        subtitle={formatLong(date)}
        onClose={() => router.back()}
      />
      <Screen footer={<Button title="Save" onPress={save} />}>
        <Section title={date === today ? 'How did today feel?' : 'How did the day feel?'}>
          <FeelingRow
            value={day.feeling}
            onChange={(v) => useJournal.getState().updateDay(date, (d) => void (d.feeling = v))}
          />
        </Section>
        <Section>
          <Field
            label="One line for the day"
            value={title}
            onChangeText={setTitle}
            limit={TITLE_LIMIT}
            placeholder="Finished the valuation chapter"
            returnKeyType="next"
            autoCapitalize="sentences"
          />
        </Section>
        <Section>
          <View style={styles.gap}>
            <Field
              label="Anything else about the day"
              value={writing}
              onChangeText={setWriting}
              multiline
              minHeight={160}
              placeholder="Write as much or as little as you like."
              autoCapitalize="sentences"
            />
            <MediaEditor owner={date} media={day.media} />
          </View>
        </Section>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  gap: { gap: space.m },
});
