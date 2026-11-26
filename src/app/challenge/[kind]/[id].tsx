import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActionSheetIOS, StyleSheet, useColorScheme, View } from 'react-native';

import { formatFull, toISO } from '@/domain/dates';
import type { ChallengeKind, ISODate } from '@/domain/types';
import { CHALLENGE_COPY } from '@/features/past/challenges';
import { useToday } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { Button, Field, Segmented, TextAction } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Row, Screen, ScreenHeader, Section } from '@/ui/layout';
import { ModalHeader } from '@/ui/modal';
import { T } from '@/ui/text';
import { colors, palette, space, TARGET } from '@/ui/theme';

type Status = 'todo' | 'active' | 'failed' | 'succeeded';

const NOTES_HINT: Record<ChallengeKind, string> = {
  rejections: 'Who you asked, what you said, what you learned.',
  bucket: 'Why it matters, what it takes, how it went.',
  experiments: 'What you are testing, and what you notice day by day.',
};

const toDate = (iso: ISODate) =>
  new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const fromDate = (d: Date) => toISO(d.getFullYear(), d.getMonth() + 1, d.getDate());

/** One item on a challenge list: what it is, when (optional), where it stands, and notes (optional). */
export default function ChallengeEditor() {
  const params = useLocalSearchParams<{ kind: string; id: string; start?: string }>();
  const kind: ChallengeKind = params.kind === 'bucket' || params.kind === 'experiments' ? params.kind : 'rejections';
  const copy = CHALLENGE_COPY[kind];
  const today = useToday();
  const scheme = useColorScheme();
  const existing = useJournal((s) => s.challenges[kind].find((r) => r.id === params.id));
  const [title, setTitle] = useState(existing?.title ?? '');
  const [date, setDate] = useState<ISODate | null>(existing?.date ?? null);
  const [status, setStatus] = useState<Status>(
    !existing
      ? params.start
        ? 'active'
        : 'todo'
      : existing.outcome !== 'open'
        ? existing.outcome
        : existing.started
          ? 'active'
          : 'todo',
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const save = () => {
    if (!title.trim()) return;
    useJournal.getState().saveChallenge(kind, {
      id: existing?.id,
      title: title.trim(),
      date,
      started: status !== 'todo',
      outcome: status === 'failed' || status === 'succeeded' ? status : 'open',
      notes: notes.replace(/\s+$/, ''),
    });
    haptic.success();
    router.back();
  };

  const remove = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: `Delete this ${copy.noun}?`,
        message: 'It is removed from the list and from the totals.',
        options: ['Delete', 'Cancel'],
        destructiveButtonIndex: 0,
        cancelButtonIndex: 1,
      },
      (i) => {
        if (i !== 0 || !existing) return;
        useJournal.getState().removeChallenge(kind, existing.id);
        router.back();
      },
    );

  return (
    <View style={styles.fill}>
      <ModalHeader title="" onClose={() => router.back()} />
      <Screen footer={<Button title="Save" onPress={save} disabled={!title.trim()} />}>
        <ScreenHeader overline={copy.title} title={existing ? `Edit ${copy.noun}` : `New ${copy.noun}`} />
        <Field
          label={copy.question}
          value={title}
          onChangeText={setTitle}
          placeholder={copy.placeholder}
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
            Where it stands
          </T>
          <Segmented
            options={[
              { value: 'todo', label: 'Not started' },
              { value: 'active', label: 'Active' },
              { value: 'failed', label: copy.failed },
              { value: 'succeeded', label: copy.succeeded },
            ]}
            value={status}
            onChange={setStatus}
          />
        </View>
        {kind === 'experiments' ? (
          <View style={styles.labelRow}>
            <T variant="subhead" weight="600" tone="ink2" style={styles.flex}>
              Observations
            </T>
            {/* Each observation starts with its day, so the notes read as a log of the experiment. */}
            <TextAction
              title="Add today’s"
              onPress={() => {
                haptic.select();
                const stamp = `${formatFull(today)}: `;
                setNotes((n) => (n.trim() ? `${n.replace(/\s+$/, '')}\n\n${stamp}` : stamp));
              }}
            />
          </View>
        ) : null}
        <Field
          label={kind === 'experiments' ? undefined : 'Notes'}
          value={notes}
          onChangeText={setNotes}
          multiline
          minHeight={160}
          placeholder={NOTES_HINT[kind]}
          autoCapitalize="sentences"
        />
        {existing ? (
          <Section flush>
            <Row title={`Delete ${copy.noun}`} onPress={remove} chevron={false} />
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
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: TARGET },
});
