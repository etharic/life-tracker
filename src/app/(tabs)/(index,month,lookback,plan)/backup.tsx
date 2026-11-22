import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { formatFull } from '@/domain/dates';
import { exportBook, exportBookWithSound, exportZip } from '@/export/run';
import { useJournal } from '@/state/journal';
import { Button } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Explainer, Row, Rows, Screen, Section, SectionLabel } from '@/ui/layout';
import { T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

export default function BackupScreen() {
  const days = useJournal((s) => s.days);
  const lastBackup = useJournal((s) => s.settings.lastBackup);
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

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Export and backup', headerLargeTitleEnabled: true }} />
      <Explainer>Once a year, save the ZIP and that year’s book to a drive you keep somewhere safe.</Explainer>
      <T variant="subhead" tone="ink2">
        {lastBackup ? `Last backup: ${formatFull(lastBackup)}` : 'No backup made yet.'}
      </T>

      <SectionLabel>Everything</SectionLabel>
      <Section>
        <View style={styles.gap}>
          <T variant="body">
            One ZIP of the whole Journal folder: every day, month and year file, the photos and recordings, README.txt
            and viewer.html, which opens the journal in any browser without the app.
          </T>
          {busy === 'The ZIP' ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.accent} />
              <T
                variant="subhead"
                tone="ink2"
              >{`Packing the journal${progress ? `, ${Math.round(progress)}%` : ''}`}</T>
            </View>
          ) : (
            <Button
              title="Export ZIP"
              icon="square.and.arrow.up"
              onPress={() => void run('The ZIP', () => exportZip(setProgress))}
              disabled={!!busy}
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

const styles = StyleSheet.create({
  gap: { gap: space.m },
  busy: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 54 },
  pad: { padding: space.l },
});
