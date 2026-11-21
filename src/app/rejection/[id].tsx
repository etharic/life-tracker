import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActionSheetIOS, StyleSheet, useColorScheme, View } from 'react-native';

import { toISO } from '@/domain/dates';
import type { ISODate, RejectionOutcome } from '@/domain/types';
import { useToday } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { Button, Field, Segmented, TextAction } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Row, Screen, ScreenHeader, Section } from '@/ui/layout';
import { ModalHeader } from '@/ui/modal';
import { T } from '@/ui/text';
import { colors, palette, space, TARGET } from '@/ui/theme';

const toDate = (iso: ISODate) =>
  new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const fromDate = (d: Date) => toISO(d.getFullYear(), d.getMonth() + 1, d.getDate());

/** One attempt on the Rejection list: what it was, when (optional), how it went, and notes (optional). */
export default function RejectionEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const today = useToday();
  const scheme = useColorScheme();
  const existing = useJournal((s) => s.rejections.find((r) => r.id === id));
  const [title, setTitle] = useState(existing?.title ?? '');
  const [date, setDate] = useState<ISODate | null>(existing?.date ?? null);
  const [outcome, setOutcome] = useState<RejectionOutcome>(existing?.outcome ?? 'waiting');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const save = () => {
    if (!title.trim()) return;
    useJournal
      .getState()
      .saveRejection({ id: existing?.id, title: title.trim(), date, outcome, notes: notes.replace(/\s+$/, '') });
    haptic.success();
    router.back();
  };

  const remove = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Delete this attempt?',
        message: 'It is removed from the list and from the totals.',
        options: ['Delete', 'Cancel'],
        destructiveButtonIndex: 0,
        cancelButtonIndex: 1,
      },
      (i) => {
        if (i !== 0 || !existing) return;
        useJournal.getState().removeRejection(existing.id);
        router.back();
      },
    );

  return (
    <View style={styles.fill}>
      <ModalHeader title="" onClose={() => router.back()} />
      <Screen footer={<Button title="Save" onPress={save} disabled={!title.trim()} />}>
        <ScreenHeader overline="Rejection list" title={existing ? 'Attempt' : 'New attempt'} />
        <Field
          label="What did you go for?"
          value={title}
          onChangeText={setTitle}
          placeholder="Applied to the summer internship at…"
          autoCapitalize="sentences"
          autoFocus={!existing}
          returnKeyType="done"
        />
        <Section>
          <View style={styles.dateRow}>
            <T variant="body" style={styles.flex}>
              Date
            </T>
            {date ? (
              <>
                <DateTimePicker
                  value={toDate(date)}
                  mode="date"
                  display="compact"
                  accentColor={palette[scheme === 'dark' ? 'dark' : 'light'].accent}
                  onValueChange={(_, d) => setDate(fromDate(d))}
                />
                <TextAction title="Remove" tone="ink2" onPress={() => setDate(null)} />
              </>
            ) : (
              <TextAction title="Add a date" onPress={() => setDate(today)} />
            )}
          </View>
        </Section>
        <View style={styles.gap}>
          <T variant="subhead" weight="600" tone="ink2">
            How did it go?
          </T>
          <Segmented
            options={[
              { value: 'waiting', label: 'Waiting' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'accepted', label: 'Successful' },
            ]}
            value={outcome}
            onChange={setOutcome}
          />
        </View>
        <Field
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          minHeight={160}
          placeholder="Who you asked, what you said, what you learned."
          autoCapitalize="sentences"
        />
        {existing ? (
          <Section flush>
            <Row title="Delete attempt" onPress={remove} chevron={false} />
          </Section>
        ) : null}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  gap: { gap: space.s },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: TARGET },
});
