import * as DocumentPicker from 'expo-document-picker';
import { Paths } from 'expo-file-system';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { restoreZip } from '@/export/run';
import { clearCache } from '@/storage/load';
import { useJournal } from '@/state/journal';
import { Button } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Explainer, Screen, Section, SectionLabel } from '@/ui/layout';
import { T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

export default function FilesScreen() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const openFiles = async () => {
    // The Files app opens this app's folder through its shareddocuments:// scheme.
    const url = Paths.document.uri.replace(/^file:\/\//, 'shareddocuments://');
    try {
      await Linking.openURL(url);
    } catch {
      setMessage('Open the Files app, then On My iPhone, then Life-Tracker.');
    }
  };

  const reload = async () => {
    setBusy(true);
    await clearCache();
    await useJournal.getState().reload();
    setBusy(false);
    haptic.success();
    setMessage('Everything was read again from the files.');
  };

  const restore = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/zip', 'public.zip-archive'],
      copyToCacheDirectory: true,
    });
    if (res.canceled) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await restoreZip(res.assets[0].uri);
      haptic.success();
      setMessage(
        `${r.added} ${r.added === 1 ? 'file' : 'files'} restored.${r.skipped ? ` ${r.skipped} already here were left as they are.` : ''}`,
      );
    } catch (e) {
      setMessage(`The ZIP could not be read. ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Your files', headerLargeTitleEnabled: true }} />
      <Explainer>
        Everything you write is a plain text file in a folder called Journal. Any text editor can open it, with or
        without this app.
      </Explainer>
      <Section>
        <View style={styles.gap}>
          <T variant="body">Files app, On My iPhone, Life-Tracker, Journal</T>
          <Button title="Open in Files" kind="secondary" icon="folder" onPress={() => void openFiles()} />
        </View>
      </Section>

      <SectionLabel>Restore</SectionLabel>
      <Section>
        <View style={styles.gap}>
          <T variant="subhead" tone="ink2">
            Bring back a journal from a ZIP made with Export, for example from Google Drive or a USB drive. Files
            already here are never overwritten.
          </T>
          <Button
            title="Restore from a ZIP"
            kind="secondary"
            icon="arrow.down.doc"
            onPress={() => void restore()}
            disabled={busy}
          />
        </View>
      </Section>

      <SectionLabel>If something looks wrong</SectionLabel>
      <Section>
        <View style={styles.gap}>
          <T variant="subhead" tone="ink2">
            The app keeps a quick index of your files. Reading everything again rebuilds it from the files themselves.
          </T>
          <Button title="Read everything again" kind="secondary" onPress={() => void reload()} disabled={busy} />
        </View>
      </Section>
      {busy ? <ActivityIndicator color={colors.accent} /> : null}
      {message ? (
        <T variant="subhead" tone="ink2">
          {message}
        </T>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.m },
});
