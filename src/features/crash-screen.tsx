import * as Clipboard from 'expo-clipboard';
import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorText, logError } from '@/storage/error-log';
import { Button } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { T } from '@/ui/text';
import { colors, radius, space } from '@/ui/theme';

/**
 * Shown when a screen fails to draw. It says what happened in plain words, lets the screen be
 * tried again, and copies the error so it can be sent as it is. The error is also in
 * Documents/errors.log, visible in the Files app.
 */
export function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  const text = useMemo(() => errorText(error), [error]);
  const [copied, setCopied] = useState(false);
  useEffect(() => logError(error, 'screen'), [error]);
  return (
    <SafeAreaView style={styles.fill}>
      <ScrollView contentContainerStyle={styles.body}>
        <T variant="pageTitle">Something went wrong</T>
        <T variant="body" tone="ink2">
          This screen stopped. Your journal files are safe. Try again, and if it happens again, copy the error and send
          it on. It is also saved in errors.log in the Files app.
        </T>
        <View style={styles.box}>
          <T variant="footnote" tone="ink2" selectable>
            {error.message}
          </T>
        </View>
        <View style={styles.buttons}>
          <Button title="Try again" icon="arrow.clockwise" onPress={() => void retry()} />
          <Button
            title={copied ? 'Copied' : 'Copy error'}
            icon="doc.on.doc"
            kind="secondary"
            onPress={() => {
              void Clipboard.setStringAsync(text).then(() => {
                setCopied(true);
                haptic.success();
              });
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  body: { padding: space.xl, gap: space.l },
  box: { padding: space.l, borderRadius: radius.section, backgroundColor: colors.fill },
  buttons: { gap: space.m },
});
