import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, StyleSheet, View } from 'react-native';

import { addDays, formatLong } from '@/domain/dates';
import { backupLine } from '@/domain/prompts';
import { usePromptInput, useToday } from '@/features/hooks';
import { logError } from '@/storage/error-log';
import { confirmBackup, exportBook, exportBookWithSound, exportZip, type BackupKind } from '@/export/run';
import { useJournal } from '@/state/journal';
import { Button, TextAction } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Explainer, Row, Rows, Screen, Section, SectionLabel } from '@/ui/layout';
import { T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

/** The share sheet cannot tell a saved copy from a cancelled one, so the owner is asked. */
function askSaved(): Promise<boolean> {
  return new Promise((resolve) => {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Saved it somewhere off this phone?', options: ['Yes, it’s saved', 'Not yet'], cancelButtonIndex: 1 },
      (i) => resolve(i === 0),
    );
  });
}

type Outcome = 'saved' | 'later' | 'failed' | null;

const BACKUPS: Record<BackupKind, { label: string; button: string; body: string }> = {
  text: {
    label: 'Writing backup',
    button: 'Save writing backup',
    body: 'Every day, week, month and year file, the lists, README.txt and viewer.html, which opens the journal in any browser without the app. Small and quick: no photos, recordings or videos.',
  },
  full: {
    label: 'Full backup',
    button: 'Save full backup',
    body: 'The whole Journal folder, with every photo, recording and video as well. It takes longer and can be large.',
  },
};

export default function BackupScreen() {
  const { due } = useLocalSearchParams<{ due?: string }>();
  const days = useJournal((s) => s.days);
  const settings = useJournal((s) => s.settings);
  const today = useToday();
  const { driveSync } = usePromptInput();
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [failedKind, setFailedKind] = useState<BackupKind | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);
  const years = useMemo(() => [...new Set(Object.keys(days).map((d) => d.slice(0, 4)))].sort().reverse(), [days]);
  // The backup the Today card asked for comes first; on its own, the writing backup leads.
  const order: BackupKind[] = due === 'full' ? ['full', 'text'] : ['text', 'full'];

  const zip = async (kind: BackupKind) => {
    setBusy(kind);
    setOutcome(null);
    setProgress(0);
    try {
      await exportZip(kind, setProgress);
      if (await askSaved()) {
        confirmBackup(kind);
        haptic.success();
        setOutcome('saved');
      } else {
        setOutcome('later');
      }
    } catch (e) {
      logError(e, 'background');
      setFailedKind(kind);
      setOutcome('failed');
    } finally {
      setBusy(null);
    }
  };

  const book = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setBookError(null);
    try {
      await fn();
    } catch (e) {
      logError(e, 'background');
      setBookError(`${label} did not finish. Try again.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Export and backup', headerLargeTitleEnabled: true }} />
      <T variant="headline">{backupLine(settings, driveSync ?? null, today)}</T>
      {outcome === 'saved' ? (
        <T variant="body">{`Backed up today. The next one is due on ${formatLong(addDays(today, 30)).replace(/^\S+ /, '')}.`}</T>
      ) : outcome === 'later' ? (
        <T variant="body">Not counted yet. The card stays on Today.</T>
      ) : outcome === 'failed' && failedKind ? (
        <View style={styles.line}>
          <T variant="body">The backup did not finish.</T>
          <TextAction title="Try again" onPress={() => void zip(failedKind)} />
        </View>
      ) : null}
      <Explainer>
        Once a month, save the writing backup somewhere off this phone, such as iCloud Drive or Google Drive. Once a
        year, save the full backup and that year’s book too.
      </Explainer>

      {order.map((kind, i) => (
        <View key={kind} style={styles.gap}>
          <SectionLabel>{BACKUPS[kind].label}</SectionLabel>
          <Section>
            <View style={styles.gap}>
              <T variant="body">{BACKUPS[kind].body}</T>
              {busy === kind ? (
                <Packing progress={progress} />
              ) : (
                <Button
                  title={BACKUPS[kind].button}
                  icon="square.and.arrow.up"
                  kind={i === 0 ? 'primary' : 'secondary'}
                  onPress={() => void zip(kind)}
                  disabled={!!busy}
                />
              )}
            </View>
          </Section>
        </View>
      ))}

      <SectionLabel>Yearly book</SectionLabel>
      <Section flush>
        {years.length ? (
          <Rows>
            {years.flatMap((y) => [
              <Row
                key={y}
                title={`The ${y} book`}
                detail={
                  busy === `The ${y} book`
                    ? 'Making the PDF'
                    : 'Day titles, months, feelings, writing and photos. Printable.'
                }
                trailing={busy === `The ${y} book` ? <ActivityIndicator color={colors.accent} /> : undefined}
                onPress={busy ? undefined : () => void book(`The ${y} book`, () => exportBook(y))}
              />,
              <Row
                key={`${y}-sound`}
                title={`The ${y} book with sound and video`}
                detail={
                  busy === `The ${y} book with sound`
                    ? 'Gathering the voice notes and videos'
                    : 'The same book as one page for any browser, playing every voice note and video.'
                }
                trailing={busy === `The ${y} book with sound` ? <ActivityIndicator color={colors.accent} /> : undefined}
                onPress={busy ? undefined : () => void book(`The ${y} book with sound`, () => exportBookWithSound(y))}
              />,
            ])}
          </Rows>
        ) : (
          <View style={styles.pad}>
            <T variant="subhead" tone="ink2">
              The first book appears once you have written a day.
            </T>
          </View>
        )}
      </Section>
      {bookError ? (
        <T variant="subhead" tone="ink2">
          {bookError}
        </T>
      ) : null}
    </Screen>
  );
}

function Packing({ progress }: { progress: number }) {
  return (
    <View style={styles.busy}>
      <ActivityIndicator color={colors.accent} />
      <T variant="subhead" tone="ink2">{`Packing the journal${progress ? `, ${Math.round(progress)}%` : ''}`}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.m },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.m, flexWrap: 'wrap' },
  busy: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 54 },
  pad: { padding: space.l },
});
