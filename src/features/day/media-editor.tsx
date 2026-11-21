import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, StyleSheet, View } from 'react-native';

import type { MediaRef } from '@/domain/types';
import { addAudio, addPhoto, type MediaOwner } from '@/state/media';
import { Icon } from '@/ui/icon';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, radius, space } from '@/ui/theme';

import { MediaStrip } from './media';

/**
 * The photos and voice notes of a day (or of a year's Misogi Ritual), with Record and
 * "Photo or file" at the end of the row. Long press an item to remove it.
 */
export function MediaEditor({ owner, media }: { owner: MediaOwner; media: MediaRef[] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(`The ${what} could not be added. ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const pickPhotos = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 1,
    });
    if (res.canceled) return;
    await run('photo', async () => {
      for (const a of res.assets) await addPhoto(owner, { uri: a.uri, width: a.width, height: a.height });
    });
  };

  const pickAudio = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['audio/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled) return;
    await run('recording', async () => {
      for (const a of res.assets) await addAudio(owner, { uri: a.uri, name: a.name });
    });
  };

  const addMedia = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Record audio', 'Photo from library', 'Audio file from Files', 'Cancel'], cancelButtonIndex: 3 },
      (i) => {
        if (i === 0) router.push(`/record/${owner}`);
        if (i === 1) void pickPhotos();
        if (i === 2) void pickAudio();
      },
    );

  return (
    <>
      <View style={styles.mediaRow}>
        <MediaStrip date={owner} media={media} editable />
        <Press
          onPress={() => router.push(`/record/${owner}`)}
          disabled={busy}
          style={[styles.add, styles.record]}
          accessibilityLabel="Record a voice note"
        >
          <Icon name="mic.fill" size={15} color={colors.accent} weight="semibold" />
          <T variant="subhead" weight="600" tone="accent" chrome>
            Record
          </T>
        </Press>
        <Press onPress={addMedia} disabled={busy} style={styles.add} accessibilityLabel="Add a photo or an audio file">
          {busy ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Icon name="plus" size={15} color={colors.ink2} weight="semibold" />
          )}
          <T variant="subhead" weight="600" tone="ink2" chrome>
            Photo or file
          </T>
        </Press>
      </View>
      {media.length ? (
        <T variant="footnote" tone="ink2">
          Long press a photo or recording to remove it.
        </T>
      ) : null}
      {error ? (
        <T variant="footnote" tone="ink2">
          {error}
        </T>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    height: 64,
    paddingHorizontal: space.l + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  record: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
});
