import * as Clipboard from 'expo-clipboard';
import { router, type ErrorBoundaryProps } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorText, logError } from '@/storage/error-log';
import { Button } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { T } from '@/ui/text';
import { colors, radius, space } from '@/ui/theme';

// Try again re-renders the same screen; if it fails again, a way back to Today is offered.
let retried = false;

/**
 * Shown when a screen fails to draw. Plain words first, then the buttons (always in view), then the
 * error itself in a small box that scrolls. The error is also in errors.log in the Files app.
 */
export function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  const text = useMemo(() => errorText(error), [error]);
  const [copied, setCopied] = useState(false);
  const [again] = useState(retried);
  useEffect(() => logError(error, 'screen'), [error]);
  return (
    <SafeAreaView style={styles.fill}>
      <View style={styles.body}>
        <T variant="pageTitle" accessibilityRole="header">
          Something went wrong
        </T>
        <T variant="body" tone="ink2">
          This screen stopped. Your journal files are safe.
        </T>
        <View style={styles.buttons}>
          <Button
            title="Try again"
            icon="arrow.clockwise"
            onPress={() => {
              retried = true;
              void retry();
            }}
          />
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
          {again ? (
            <Button
              title="Go to Today"
              icon="sun.max"
              kind="secondary"
              onPress={() => {
                retried = false;
                router.replace('/');
              }}
            />
          ) : null}
        </View>
        <ScrollView style={styles.box} contentContainerStyle={styles.boxContent} accessibilityLabel="Error details">
          <T variant="footnote" tone="ink2" selectable>
            {error.message}
          </T>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  body: { padding: space.xl, gap: space.l },
  buttons: { gap: space.m },
  // About six lines of footnote text; longer errors scroll inside the box.
  box: { maxHeight: 6 * 18 + 2 * space.l, borderRadius: radius.section, backgroundColor: colors.fill },
  boxContent: { padding: space.l },
});
