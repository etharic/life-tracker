import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from 'expo-audio';
import * as Linking from 'expo-linking';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { formatLong, isISODate } from '@/domain/dates';
import { useToday } from '@/features/hooks';
import { discardRecording, saveRecording, VOICE_NOTE } from '@/state/recordings';
import { Button } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { ModalHeader } from '@/ui/modal';
import { enterSoft, SETTLE } from '@/ui/motion';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, GUTTER, radius, space } from '@/ui/theme';
import { levelFromDb, Waveform } from '@/ui/waveform';

type Phase = 'idle' | 'recording' | 'paused' | 'preview' | 'saving';

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The record control: a dot that becomes a stop square, with a slow breathing ring while recording. */
function RecordButton({ phase, onPress }: { phase: Phase; onPress: () => void }) {
  const reduced = useReducedMotion();
  const active = phase === 'recording' || phase === 'paused';
  const shape = useSharedValue(active ? 1 : 0);
  const breathe = useSharedValue(0);
  useEffect(() => {
    shape.set(withSpring(active ? 1 : 0, SETTLE));
    if (phase === 'recording' && !reduced) {
      breathe.set(withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })), -1));
    } else {
      cancelAnimation(breathe);
      breathe.set(withTiming(0, { duration: 200 }));
    }
  }, [active, phase, reduced, shape, breathe]);
  const inner = useAnimatedStyle(() => {
    const v = shape.get();
    const size = 58 - v * 26;
    return { width: size, height: size, borderRadius: 29 - v * 22 };
  });
  const ring = useAnimatedStyle(() => ({
    opacity: 0.35 * breathe.get(),
    transform: [{ scale: 1 + breathe.get() * 0.12 }],
  }));
  return (
    <Press
      onPress={onPress}
      disabled={phase === 'preview' || phase === 'saving'}
      accessibilityLabel={active ? 'Stop recording' : 'Record'}
      style={styles.recordOuter}
    >
      <Animated.View style={[styles.recordRing, ring]} />
      <View style={styles.recordFrame}>
        <Animated.View style={[styles.recordInner, inner]} />
      </View>
    </Press>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Press onPress={onPress} disabled={disabled} accessibilityLabel={label} style={styles.round}>
      <Icon name={icon} size={20} color={colors.accent} weight="semibold" />
    </Press>
  );
}

/**
 * Records a voice note for a day: record, pause and resume, stop, listen back, delete and
 * record again, or save. Nothing is lost: closing asks first, and a take left behind by a crash
 * is attached to its day at the next launch.
 */
export default function RecordSheet() {
  const params = useLocalSearchParams<{ date: string }>();
  const today = useToday();
  // A day (2026-11-19), or a year (2026) when recording for that year's Misogi Ritual.
  const year = /^[0-9]{4}$/.test(String(params.date)) ? String(params.date) : null;
  const date = year ?? (isISODate(params.date) ? params.date : today);
  const insets = useSafeAreaInsets();

  const recorder = useAudioRecorder(VOICE_NOTE);
  const [phase, setPhase] = useState<Phase>('idle');
  const [levels, setLevels] = useState<number[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [uri, setUri] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [interrupted, setInterrupted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const player = useAudioPlayer(uri);
  const playback = useAudioPlayerStatus(player);

  // While recording: read the time and the level a dozen times a second.
  useEffect(() => {
    if (phase !== 'recording') return;
    const id = setInterval(() => {
      const s = recorder.getStatus();
      setElapsed(s.durationMillis);
      if (!s.isRecording && s.durationMillis > 0) {
        // A call, Siri or another app took the microphone: the take is kept, paused.
        setInterrupted(true);
        setPhase('paused');
        return;
      }
      setLevels((l) => {
        const next = [...l, levelFromDb(s.metering)];
        // Long takes: halve the resolution instead of growing without end.
        if (next.length <= 1200) return next;
        const half: number[] = [];
        for (let i = 0; i < next.length; i += 2) half.push(Math.max(next[i], next[i + 1] ?? 0));
        return half;
      });
    }, 80);
    return () => clearInterval(id);
  }, [phase, recorder]);

  // If the sheet goes away mid-take anyway, stop cleanly; the file is picked up at the next launch.
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(
    () => () => {
      if (phaseRef.current === 'recording' || phaseRef.current === 'paused') {
        recorder.stop().catch(() => undefined);
      }
    },
    [recorder],
  );

  const start = async () => {
    setError(null);
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setDenied(true);
        return;
      }
      setDenied(false);
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      haptic.commit();
      setLevels([]);
      setElapsed(0);
      setInterrupted(false);
      setPhase('recording');
    } catch (e) {
      setError(`Recording could not start. ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const finishTake = async (): Promise<string | null> => {
    try {
      await recorder.stop();
    } catch {
      // Already stopped (for example by an interruption).
    }
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    return recorder.uri ?? null;
  };

  const stop = async () => {
    const u = await finishTake();
    haptic.commit();
    setUri(u);
    setPhase(u ? 'preview' : 'idle');
    if (!u) setError('The recording could not be finished.');
  };

  const pauseOrResume = () => {
    haptic.select();
    if (phase === 'recording') {
      recorder.pause();
      setPhase('paused');
    } else {
      recorder.record();
      setInterrupted(false);
      setPhase('recording');
    }
  };

  const playOrPause = () => {
    if (playback.playing) player.pause();
    else {
      if (playback.duration > 0 && playback.currentTime >= playback.duration - 0.1) void player.seekTo(0);
      player.play();
    }
  };

  const deleteTake = () => {
    player.pause();
    discardRecording(uri);
    setUri(null);
    setLevels([]);
    setElapsed(0);
    setPhase('idle');
  };

  const save = async (take: string | null) => {
    if (!take) return;
    setPhase('saving');
    player.pause();
    try {
      await saveRecording(date, take);
      haptic.success();
      router.back();
    } catch (e) {
      setError(`The recording could not be saved. ${e instanceof Error ? e.message : String(e)}`);
      setPhase('preview');
    }
  };

  const close = () => {
    if (phase === 'idle') return router.back();
    const recording = phase === 'recording' || phase === 'paused';
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: recording ? 'You are still recording' : 'Keep this recording?',
        options: ['Save recording', 'Discard', recording ? 'Keep recording' : 'Cancel'],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
      },
      async (i) => {
        if (i === 2) return;
        const take = recording ? await finishTake() : uri;
        if (i === 0) return save(take);
        discardRecording(take);
        router.back();
      },
    );
  };

  const playing = playback.playing;
  const progress = playback.duration > 0 ? playback.currentTime / playback.duration : 0;
  const time =
    phase === 'preview' || phase === 'saving'
      ? `${clock(playback.currentTime * 1000)} / ${clock(playback.duration * 1000)}`
      : clock(elapsed);
  const status =
    phase === 'idle'
      ? 'Tap to record'
      : phase === 'recording'
        ? 'Recording'
        : phase === 'paused'
          ? interrupted
            ? 'Paused by another app. Tap resume to go on.'
            : 'Paused'
          : phase === 'preview'
            ? 'Listen back, then save'
            : 'Saving';

  return (
    <View style={styles.fill}>
      {/* No swipe-to-dismiss with a take in progress: closing asks first. */}
      <Stack.Screen options={{ gestureEnabled: phase === 'idle' }} />
      <ModalHeader title="Record" subtitle={year ? `${year} Misogi Ritual` : formatLong(date)} onClose={close} />
      <View style={styles.body}>
        <View style={styles.center}>
          <T variant="largeTitle" style={styles.time} accessibilityLabel={`Time ${time}`} chrome>
            {time}
          </T>
          <Animated.View key={status} entering={enterSoft}>
            <T
              variant="subhead"
              tone={phase === 'recording' ? 'accent' : 'ink2'}
              center
              accessibilityLiveRegion="polite"
            >
              {status}
            </T>
          </Animated.View>
        </View>

        <View style={styles.wave}>
          <Waveform levels={levels} progress={phase === 'preview' || phase === 'saving' ? progress : undefined} />
        </View>

        {denied ? (
          <View style={styles.notice}>
            <T variant="subhead" center>
              Life-Tracker needs the microphone to record. You can allow it in Settings.
            </T>
            <Button title="Open Settings" kind="secondary" compact onPress={() => void Linking.openSettings()} />
          </View>
        ) : null}
        {error ? (
          <T variant="footnote" tone="ink2" center>
            {error}
          </T>
        ) : null}

        <View style={styles.controls}>
          <View style={styles.side}>
            {phase === 'preview' ? (
              <RoundButton icon="trash" label="Delete and record again" onPress={deleteTake} />
            ) : null}
          </View>
          <RecordButton phase={phase} onPress={() => void (phase === 'idle' ? start() : stop())} />
          <View style={styles.side}>
            {phase === 'recording' || phase === 'paused' ? (
              <RoundButton
                icon={phase === 'recording' ? 'pause.fill' : 'record.circle'}
                label={phase === 'recording' ? 'Pause' : 'Resume'}
                onPress={pauseOrResume}
              />
            ) : null}
            {phase === 'preview' ? (
              <RoundButton
                icon={playing ? 'pause.fill' : 'play.fill'}
                label={playing ? 'Pause' : 'Play'}
                onPress={playOrPause}
              />
            ) : null}
          </View>
        </View>
      </View>
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.m }]}>
        {phase === 'preview' || phase === 'saving' ? (
          <Button title="Save to this day" onPress={() => void save(uri)} disabled={phase === 'saving'} />
        ) : (
          <T variant="footnote" tone="ink2" center>
            The recording is saved with the day, next to its photos.
          </T>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: GUTTER, gap: space.xxl },
  center: { alignItems: 'center', gap: space.xs },
  time: { fontSize: 54, lineHeight: 62, fontWeight: '300', fontVariant: ['tabular-nums'] },
  wave: { paddingHorizontal: space.s },
  notice: { alignItems: 'center', gap: space.m },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xxl,
    marginTop: space.l,
  },
  side: { width: 56, alignItems: 'center' },
  round: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordOuter: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  recordRing: { position: 'absolute', width: 84, height: 84, borderRadius: 42, backgroundColor: colors.accent },
  recordFrame: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  recordInner: { backgroundColor: colors.accent },
  footer: { paddingHorizontal: GUTTER, paddingTop: space.m },
});
