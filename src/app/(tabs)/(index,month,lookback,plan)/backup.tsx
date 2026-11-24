import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, StyleSheet, View } from 'react-native';

import { formatFull } from '@/domain/dates';
import { confirmBackup, exportBook, exportBookWithSound, exportZip, type BackupKind } from '@/export/run';
import { useJournal } from '@/state/journal';
import { Button } from '@/ui/controls';
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

export default function BackupScreen() {
  const days = useJournal((s) => s.days);
  const lastBackup = useJournal((s) => s.settings.lastBackup);
  const lastFull = useJournal((s) => s.settings.lastFullBackup);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const years = useMemo(() => [...new Set(Object.keys(days).map((d) => d.slice(0, 4)))].sort().reverse(), [days]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    setProgress(0);
    try {
      await fn();
      haptic.success();
    } catch (e) {
      setError(`${label} did not finish. ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const zip = (kind: BackupKind) =>
    run(kind === 'text' ? 'The writing ZIP' : 'The full ZIP', async () => {
      await exportZip(kind, setProgress);
      if (await askSaved()) confirmBackup(kind);
    });
  const packing = busy === 'The writing ZIP' || busy === 'The full ZIP';

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Export and backup', headerLargeTitleEnabled: true }} />
      <Explainer>
        Once a month, save the writing ZIP somewhere off this phone, such as iCloud Drive or Google Drive. Once a year,
        save the full ZIP and that year’s book too.
      </Explainer>
      <T variant="subhead" tone="ink2">
        {lastBackup ? `Last backup: ${formatFull(lastBackup)}` : 'No backup made yet.'}
        {lastFull && lastFull !== lastBackup
          ? `
Last full backup: ${formatFull(lastFull)}`
          : ''}
      </T>

      <SectionLabel>Your writing</SectionLabel>
      <Section>
        <View style={styles.gap}>
          <T variant="body">
            Every day, week, month and year file, the lists, README.txt and viewer.html, which opens the journal in any
            browser without the app. Small and quick: no photos, recordings or videos.
          </T>
          {busy === 'The writing ZIP' ? (
            <Packing progress={progress} />
          ) : (
            <Button
              title="Export writing ZIP"
              icon="square.and.arrow.up"
              onPress={() => void zip('text')}
              disabled={!!busy}
            />
          )}
        </View>
      </Section>

      <SectionLabel>Everything</SectionLabel>
      <Section>
        <View style={styles.gap}>
          <T variant="body">
            The whole Journal folder, with every photo, recording and video as well. It takes longer and can be large.
          </T>
          {busy === 'The full ZIP' ? (
            <Packing progress={progress} />
          ) : (
            <Button
              title="Export full ZIP"
              icon="square.and.arrow.up"
              onPress={() => void zip('full')}
              disabled={!!busy || packing}
            />
          )}
        </View>
      </Section>

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
                onPress={busy ? undefined : () => void run(`The ${y} book`, () => exportBook(y))}
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
                onPress={busy ? undefined : () => void run(`The ${y} book with sound`, () => exportBookWithSound(y))}
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
      {error ? (
        <T variant="subhead" tone="ink2">
          {error}
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
  busy: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 54 },
  pad: { padding: space.l },
});
