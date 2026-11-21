import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, StyleSheet, View } from 'react-native';

import { isValidClientId } from '@/sync/auth';
import { connectDrive, disconnectDrive, syncNow, useSync } from '@/sync/scheduler';
import { Button, Field } from '@/ui/controls';
import { Explainer, Row, Rows, Screen, Section, SectionLabel } from '@/ui/layout';
import { T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

const STEPS = [
  'Open console.cloud.google.com and sign in with the Google account that should hold the journal.',
  'Create a project named Life-Tracker.',
  'APIs and Services, Library: turn on the Google Drive API.',
  'Google Auth Platform, Branding: app name Life-Tracker, your email as support and contact address.',
  'Audience: User type External, then press Publish app so it is In production (otherwise Google signs you out every 7 days).',
  'Data access: add the scope .../auth/drive.file.',
  'Clients, Create client: type iOS, bundle ID com.etharic.lifetracker. Copy the Client ID it shows.',
  'Paste it below and press Connect.',
];

export default function DriveScreen() {
  const sync = useSync();
  const [clientId, setClientId] = useState(sync.clientId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      await connectDrive(clientId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Disconnect Google Drive?',
        message:
          'Nothing is deleted: your files stay on this iPhone and in Drive. Syncing stops until you connect again.',
        options: ['Disconnect', 'Cancel'],
        destructiveButtonIndex: 0,
        cancelButtonIndex: 1,
      },
      (i) => {
        if (i === 0) void disconnectDrive();
      },
    );

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Google Drive', headerLargeTitleEnabled: true }} />
      <Explainer>
        Your journal lives on this iPhone. Drive keeps a second copy, and your PC gets a third through Drive for
        Desktop. The app can only see the files it created.
      </Explainer>

      {sync.connected ? (
        <>
          <Section>
            <View style={styles.gap}>
              <View style={styles.status}>
                <View style={[styles.dot, { backgroundColor: sync.error ? colors.ink3 : colors.accent }]} />
                <T variant="headline" style={styles.flex}>
                  {sync.syncing ? 'Syncing' : sync.error ? 'Waiting to sync' : 'Up to date'}
                </T>
                {sync.syncing ? <ActivityIndicator color={colors.accent} /> : null}
              </View>
              {sync.account ? (
                <T variant="subhead" tone="ink2">
                  {sync.account}
                </T>
              ) : null}
              <T variant="subhead" tone="ink2">
                {sync.lastSync
                  ? `Last synced ${sync.lastSyncLabel}. Syncs when you open the app and after every save.`
                  : 'Not synced yet.'}
              </T>
              {sync.error ? (
                <T variant="subhead" tone="ink2">
                  {sync.error}
                </T>
              ) : null}
              <Button
                title="Sync now"
                kind="secondary"
                compact
                onPress={() => void syncNow()}
                disabled={sync.syncing}
              />
            </View>
          </Section>
          {sync.conflicts ? (
            <>
              <SectionLabel>Changed on two devices</SectionLabel>
              <Section flush>
                <Rows>
                  {sync.conflictPaths.map((p) => (
                    <Row
                      key={p}
                      title={p.split('/').pop() ?? p}
                      detail="Both versions are kept. Choose one."
                      onPress={() => router.push(`/conflict/${encodeURIComponent(p)}`)}
                    />
                  ))}
                </Rows>
              </Section>
            </>
          ) : null}
          <Section flush>
            <Row title="Disconnect" onPress={disconnect} chevron={false} />
          </Section>
        </>
      ) : (
        <>
          <SectionLabel>Connect, once per device</SectionLabel>
          <Section>
            <View style={styles.gap}>
              <Field
                label="Google client ID"
                value={clientId}
                onChangeText={setClientId}
                placeholder="1234567890-abc123.apps.googleusercontent.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                textContentType="none"
              />
              {sync.error || error ? (
                <T variant="subhead" tone="ink2">
                  {error ?? sync.error}
                </T>
              ) : null}
              <Button
                title={busy ? 'Connecting' : 'Connect Google Drive'}
                onPress={() => void connect()}
                disabled={busy || !isValidClientId(clientId)}
              />
            </View>
          </Section>
          <SectionLabel>Setting up Google, once</SectionLabel>
          <Section>
            <View style={styles.gap}>
              {STEPS.map((s, i) => (
                <View key={i} style={styles.step}>
                  <T variant="subhead" weight="600" tone="accent" style={styles.num}>{`${i + 1}`}</T>
                  <T variant="subhead" style={styles.flex}>
                    {s}
                  </T>
                </View>
              ))}
              <Button
                title="Open Google Cloud console"
                kind="secondary"
                compact
                onPress={() => void WebBrowser.openBrowserAsync('https://console.cloud.google.com/')}
              />
            </View>
          </Section>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.m },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  dot: { width: 10, height: 10, borderRadius: 5 },
  step: { flexDirection: 'row', gap: space.m },
  num: { width: 16 },
});
