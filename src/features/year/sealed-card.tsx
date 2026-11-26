import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActionSheetIOS, StyleSheet, View } from 'react-native';

import { daysBetween, formatFull } from '@/domain/dates';
import { isSealed } from '@/domain/misogi';
import type { ISODate, SealedNote } from '@/domain/types';
import { removeSealedNote, sealedNoteUri } from '@/state/recordings';
import { TextAction } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, radius, space } from '@/ui/theme';

function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/**
 * The voice note sealed at a year's review (`year`). Its own card, in the ember wash:
 *   locked     a lock, when it was made and when it opens; only its length is read
 *   editable   during the edit window after the sitting: play back, record again or remove
 *   open       from its date: tap to play, never on its own
 *   missing    the file is gone: said plainly, nothing breaks
 */
export function SealedCard({
  year,
  note,
  today,
  editable,
}: {
  year: string;
  note: SealedNote;
  today: ISODate;
  editable?: boolean;
}) {
  const uri = sealedNoteUri(year, note.path);
  const locked = isSealed(note, today) && !editable;
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);
  useEffect(
    () => () => {
      try {
        player.pause();
      } catch {
        // Already released with the screen.
      }
    },
    [player],
  );

  const made = `A note from 25 December ${year}`;
  const opens = formatFull(note.sealedUntil);

  if (!uri) {
    return (
      <View style={styles.card} accessible accessibilityLabel={`Voice note missing. ${made}.`}>
        <Icon name="waveform.slash" size={20} color={colors.ink2} />
        <View style={styles.flex}>
          <T variant="journalTitle">Voice note missing</T>
          <T variant="footnote" tone="ink2">
            {`${made}. Its file is no longer in the Journal folder.`}
          </T>
        </View>
      </View>
    );
  }

  if (locked) {
    const left = Math.max(0, daysBetween(today, note.sealedUntil));
    return (
      <Press
        feedback="highlight"
        onPress={() => {
          haptic.select();
          ActionSheetIOS.showActionSheetWithOptions(
            { title: 'Sealed', message: `This note opens on ${opens}.`, options: ['OK'], cancelButtonIndex: 0 },
            () => undefined,
          );
        }}
        accessibilityLabel={`Sealed voice note, ${clock(status.duration)}, opens ${opens}`}
        style={styles.card}
      >
        <Icon name="lock.fill" size={18} color={colors.accent} />
        <View style={styles.flex}>
          <T variant="journalTitle">{made}</T>
          <T variant="footnote" tone="ink2">
            {`${status.duration > 0 ? `${clock(status.duration)}, opens` : 'Opens'} in ${days(left)}`}
          </T>
        </View>
      </Press>
    );
  }

  const playing = status.playing;
  const toggle = () => {
    if (playing) player.pause();
    else {
      if (status.duration > 0 && status.currentTime >= status.duration - 0.1) void player.seekTo(0);
      player.play();
    }
  };
  const time = playing || status.currentTime > 0 ? status.currentTime : status.duration;

  return (
    <View style={styles.cardCol}>
      <View style={styles.rowTop}>
        <Press
          onPress={toggle}
          accessibilityLabel={`${playing ? 'Pause' : 'Play'} the note from 25 December ${year}, ${clock(status.duration)}`}
          style={styles.play}
        >
          <Icon name={playing ? 'pause.fill' : 'play.fill'} size={22} color={colors.onAccent} />
        </Press>
        <View style={styles.flex}>
          <T variant="journalTitle">{editable ? 'Your sealed note' : `From you, 25 December ${year}`}</T>
          <T variant="footnote" tone="ink2" style={styles.tabular}>
            {editable ? `${clock(time)}, sealed until ${opens}` : clock(time)}
          </T>
        </View>
      </View>
      {editable ? (
        <View style={styles.actions}>
          <TextAction
            title="Record again"
            onPress={() => {
              player.pause();
              router.push(`/record/sealed-${year}`);
            }}
          />
          <TextAction
            title="Remove"
            tone="ink2"
            onPress={() =>
              ActionSheetIOS.showActionSheetWithOptions(
                {
                  title: 'Remove the sealed note?',
                  options: ['Remove', 'Cancel'],
                  destructiveButtonIndex: 0,
                  cancelButtonIndex: 1,
                },
                (i) => {
                  if (i === 0) void removeSealedNote(year);
                },
              )
            }
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    padding: space.l,
    borderRadius: radius.section,
    backgroundColor: colors.accentSoft,
  },
  cardCol: { gap: space.m, padding: space.l, borderRadius: radius.section, backgroundColor: colors.accentSoft },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  play: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  actions: { flexDirection: 'row', gap: space.xl },
  tabular: { fontVariant: ['tabular-nums'] },
});
