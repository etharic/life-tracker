import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActionSheetIOS, StyleSheet, View } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';

import type { ISODate, MediaRef } from '@/domain/types';
import { mediaUri, removeMedia } from '@/state/media';
import { Icon } from '@/ui/icon';
import { enterPop, exitSoft, layoutMove } from '@/ui/motion';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, radius, space } from '@/ui/theme';

function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

let audioModeSet = false;

export function AudioChip({ date, media, onRemove }: { date: ISODate; media: MediaRef; onRemove?: () => void }) {
  const player = useAudioPlayer(mediaUri(date, media));
  const status = useAudioPlayerStatus(player);
  useEffect(() => {
    if (!audioModeSet) {
      audioModeSet = true;
      void setAudioModeAsync({ playsInSilentMode: true });
    }
  }, []);
  const playing = status.playing;
  const toggle = () => {
    if (playing) player.pause();
    else {
      if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.1))
        void player.seekTo(0);
      player.play();
    }
  };
  const time = playing || status.currentTime > 0 ? status.currentTime : status.duration;
  return (
    <Press
      onPress={toggle}
      onLongPress={onRemove}
      accessibilityLabel={`${playing ? 'Pause' : 'Play'} recording, ${clock(status.duration)}`}
      style={styles.audio}
    >
      <Icon name={playing ? 'pause.fill' : 'play.fill'} size={15} color={colors.accent} />
      <T variant="subhead" weight="600" tone="accent" style={styles.tabular} chrome>
        {clock(time)}
      </T>
    </Press>
  );
}

export function PhotoThumb({
  date,
  media,
  size = 64,
  onRemove,
}: {
  date: ISODate;
  media: MediaRef;
  size?: number;
  onRemove?: () => void;
}) {
  return (
    <Press
      onLongPress={onRemove}
      accessibilityLabel="Photo"
      accessibilityHint={onRemove ? 'Long press to remove' : undefined}
    >
      <Image
        source={{ uri: mediaUri(date, media) }}
        style={[styles.photo, { width: size, height: size }]}
        contentFit="cover"
        recyclingKey={media.path}
        transition={120}
      />
    </Press>
  );
}

/** A video: a dark tile with a play mark; tapping plays it full screen. */
export function VideoTile({ date, media, onRemove }: { date: ISODate; media: MediaRef; onRemove?: () => void }) {
  return (
    <Press
      onPress={() => router.push({ pathname: '/video/[owner]', params: { owner: date, path: media.path } })}
      onLongPress={onRemove}
      accessibilityLabel="Play video"
      accessibilityHint={onRemove ? 'Long press to remove' : undefined}
      style={styles.video}
    >
      <Icon name="play.fill" size={20} color={colors.bg} />
    </Press>
  );
}

export function confirmRemove(date: ISODate, media: MediaRef) {
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title: `Remove this ${media.kind === 'photo' ? 'photo' : media.kind === 'video' ? 'video' : 'recording'}?`,
      options: ['Remove', 'Cancel'],
      destructiveButtonIndex: 0,
      cancelButtonIndex: 1,
    },
    (i) => {
      if (i === 0) void removeMedia(date, media);
    },
  );
}

export function MediaStrip({ date, media, editable }: { date: ISODate; media: MediaRef[]; editable?: boolean }) {
  if (!media.length) return null;
  // A new photo or recording pops into place; removed ones fade. Nothing moves when a day opens.
  return (
    <LayoutAnimationConfig skipEntering>
      <View style={styles.strip}>
        {media.map((m) => (
          <Animated.View key={m.path} entering={enterPop} exiting={exitSoft} layout={layoutMove}>
            {m.kind === 'photo' ? (
              <PhotoThumb date={date} media={m} onRemove={editable ? () => confirmRemove(date, m) : undefined} />
            ) : m.kind === 'video' ? (
              <VideoTile date={date} media={m} onRemove={editable ? () => confirmRemove(date, m) : undefined} />
            ) : (
              <AudioChip date={date} media={m} onRemove={editable ? () => confirmRemove(date, m) : undefined} />
            )}
          </Animated.View>
        ))}
      </View>
    </LayoutAnimationConfig>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, alignItems: 'center' },
  photo: { borderRadius: radius.control, backgroundColor: colors.fill },
  audio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    height: 64,
    paddingHorizontal: space.l + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  tabular: { fontVariant: ['tabular-nums'] },
  video: {
    width: 64,
    height: 64,
    borderRadius: radius.control,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
