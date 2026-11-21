import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { journalStore } from '@/state/journal';
import { conflictCopy } from '@/sync/drive';
import { resolve } from '@/sync/scheduler';
import { Button } from '@/ui/controls';
import { Explainer, Screen, Section } from '@/ui/layout';
import { ModalHeader } from '@/ui/modal';
import { T } from '@/ui/text';
import { colors, radius, space } from '@/ui/theme';

const TEXT = /\.(md|txt|html)$/i;

function Version({
  title,
  text,
  uri,
  missing,
}: {
  title: string;
  text: string | null;
  uri: string | null;
  missing: boolean;
}) {
  return (
    <Section title={title}>
      {missing ? (
        <T variant="subhead" tone="ink2">
          Deleted here.
        </T>
      ) : text != null ? (
        <ScrollView style={styles.text} nestedScrollEnabled>
          <T variant="footnote" style={styles.mono}>
            {text}
          </T>
        </ScrollView>
      ) : uri ? (
        <Image source={{ uri }} style={styles.photo} contentFit="contain" />
      ) : null}
    </Section>
  );
}

/** A file changed on two devices: both versions side by side; you choose. Nothing is lost silently. */
export default function ConflictScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const path = decodeURIComponent(String(id));
  const isText = TEXT.test(path);
  const [local, setLocal] = useState<{ text: string | null; uri: string | null; missing: boolean } | null>(null);
  const [remote, setRemote] = useState<{ text: string | null; uri: string | null; missing: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const store = journalStore();
      const lf = store.fileRef(path);
      const rf = conflictCopy(path);
      setLocal({
        missing: !lf.exists,
        text: lf.exists && isText ? await lf.text() : null,
        uri: lf.exists ? lf.uri : null,
      });
      setRemote({
        missing: !rf.exists,
        text: rf.exists && isText ? await rf.text() : null,
        uri: rf.exists ? rf.uri : null,
      });
    })();
  }, [path, isText]);

  const choose = async (keep: 'local' | 'remote') => {
    setBusy(true);
    await resolve(path, keep);
    router.back();
  };

  return (
    <View style={styles.fill}>
      <ModalHeader title="Choose a version" subtitle={path} onClose={() => router.back()} />
      <Screen
        footer={
          <View style={styles.footer}>
            <Button title="Keep this iPhone's" onPress={() => void choose('local')} disabled={busy} />
            <Button title="Keep Drive's" kind="secondary" onPress={() => void choose('remote')} disabled={busy} />
          </View>
        }
      >
        <Explainer>
          This file changed on this iPhone and somewhere else since the last sync. Both versions are kept until you
          choose.
        </Explainer>
        {local ? <Version title="On this iPhone" {...local} /> : null}
        {remote ? <Version title="On Google Drive" {...remote} /> : null}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  footer: { gap: space.s },
  text: { maxHeight: 260, backgroundColor: colors.fill, borderRadius: radius.control, padding: space.m },
  mono: { fontFamily: 'Menlo' },
  photo: { width: '100%', height: 220, borderRadius: radius.control },
});
