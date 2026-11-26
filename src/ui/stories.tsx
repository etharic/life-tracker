import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, Settings, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { scheduleOnRN } from 'react-native-worklets';

import type { RecapSlide } from '../domain/recap';
import { feeling } from '../domain/feelings';
import { Button } from './controls';
import { haptic } from './haptics';
import { Icon } from './icon';
import { RM } from './motion';
import { RollingText } from './rolling-text';
import { T } from './text';
import { space } from './theme';

/** How long a card stays before the next one comes, unless held. */
const SLIDE_MS = 6000;
const PEN = '#8E3F12'; // deep ember
const INK = '#16110D'; // the hearth at night

function look(s: RecapSlide): { bg: string; fg: string } {
  const f = s.feeling != null ? feeling(s.feeling) : null;
  if (f) return { bg: f.color, fg: f.on };
  return { bg: s.tone === 'ink' ? INK : PEN, fg: '#FFFFFF' };
}

const rise = (delay: number) => FadeInDown.delay(delay).duration(420).easing(Easing.out(Easing.cubic)).reduceMotion(RM);

/**
 * Full-screen cards, one after another (after Spotify Wrapped): bars at the top fill as each card
 * plays; tap the right side for the next, the left for the one before; touch and hold to pause.
 * The last card ends in one button. With VoiceOver on, cards wait to be moved on.
 */
export function Stories({
  slides,
  doneLabel,
  onDone,
  onClose,
}: {
  slides: RecapSlide[];
  doneLabel: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  // Simulator check only: `-LTSlide 3` opens on that card. Unused on a phone.
  const [i, setI] = useState(() => Math.min(Math.max(0, Number(Settings.get('LTSlide')) || 0), slides.length - 1));
  const [reader, setReader] = useState(false);
  const progress = useSharedValue(0);
  const held = useRef(false);
  const last = i === slides.length - 1;
  const s = slides[i];
  const { bg, fg } = look(s);

  useEffect(() => {
    void AccessibilityInfo.isScreenReaderEnabled().then(setReader);
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setReader);
    return () => sub.remove();
  }, []);

  const next = () => setI((k) => Math.min(k + 1, slides.length - 1));
  const back = () => setI((k) => Math.max(k - 1, 0));

  const play = (from: number) => {
    if (reader || last) {
      progress.set(last ? 1 : from);
      return;
    }
    progress.set(from);
    progress.set(
      withTiming(1, { duration: SLIDE_MS * (1 - from), easing: Easing.linear }, (finished) => {
        if (finished) scheduleOnRN(next);
      }),
    );
  };
  useEffect(() => {
    play(0);
    return () => cancelAnimation(progress);
    // A new card starts its own clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, reader]);

  const bar = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));

  return (
    <View style={[styles.fill, { backgroundColor: bg }]}>
      {/* A full-screen modal sets its own status bar: light words on the dark cards. */}
      <Stack.Screen options={{ statusBarStyle: fg === '#FFFFFF' ? 'light' : 'dark' }} />
      {/* One large soft circle behind the words, a little different on every card. */}
      <Animated.View
        key={`orb-${s.key}`}
        entering={rise(0)}
        pointerEvents="none"
        style={[styles.orbWrap, { top: 120 + ((i * 97) % 260), right: -140 + ((i * 53) % 90) }]}
      >
        {/* The fade-in animates the wrapper's opacity, so the faintness lives on the circle inside. */}
        <View style={[styles.orb, { backgroundColor: fg }]} />
      </Animated.View>
      <View style={[styles.top, { paddingTop: insets.top + space.s }]}>
        <View style={styles.bars} accessible accessibilityLabel={`Card ${i + 1} of ${slides.length}`}>
          {slides.map((x, k) => (
            <View key={x.key} style={[styles.track, { backgroundColor: `${fg}40` }]}>
              {k < i ? <View style={[styles.full, { backgroundColor: fg }]} /> : null}
              {k === i ? <Animated.View style={[styles.full, { backgroundColor: fg }, bar]} /> : null}
            </View>
          ))}
        </View>
        <View style={styles.topRow}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Icon name="xmark" size={18} color={fg} weight="semibold" />
          </Pressable>
          {!last ? (
            <Pressable
              onPress={() => setI(slides.length - 1)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Skip to the end"
            >
              <T variant="subhead" weight="600" chrome style={{ color: fg }}>
                Skip
              </T>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Pressable
        style={styles.stage}
        onPress={(e) => {
          if (held.current) return;
          haptic.select();
          if (e.nativeEvent.locationX < 110) back();
          else next();
        }}
        onLongPress={() => {
          held.current = true;
          cancelAnimation(progress);
        }}
        delayLongPress={220}
        onPressOut={() => {
          if (!held.current) return;
          held.current = false;
          play(progress.get());
        }}
        accessible
        accessibilityRole="button"
        accessibilityLabel={[s.kicker, s.big, s.line].filter(Boolean).join('. ')}
        accessibilityHint={last ? undefined : 'Shows the next card'}
        accessibilityActions={[{ name: 'activate' }, { name: 'decrement', label: 'Previous card' }]}
        onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'decrement' ? back() : next())}
      >
        <View key={s.key} style={styles.content}>
          <Animated.View entering={rise(60)}>
            <T variant="headline" chrome style={[styles.kicker, { color: fg }]}>
              {s.kicker}
            </T>
          </Animated.View>
          <Animated.View entering={rise(180)}>
            {/^\d/.test(s.big) ? (
              // A number is revealed: its digits roll up from 0.
              <RollingText variant="pageTitle" chrome fromZero style={[styles.big, { color: fg }]} text={s.big} />
            ) : (
              <T
                variant="pageTitle"
                chrome
                numberOfLines={4}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
                style={[styles.big, { color: fg }]}
              >
                {s.big}
              </T>
            )}
          </Animated.View>
          {s.line ? (
            <Animated.View entering={rise(320)}>
              <T variant="title3" chrome style={[styles.line, { color: fg }]}>
                {s.line}
              </T>
            </Animated.View>
          ) : null}
        </View>
      </Pressable>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.l }]}>
        {last ? (
          <Animated.View entering={rise(400)}>
            <Button title={doneLabel} kind="secondary" onPress={onDone} />
          </Animated.View>
        ) : i === 0 ? (
          <T variant="footnote" chrome style={[styles.hint, { color: fg }]}>
            Tap to go on. Touch and hold to pause.
          </T>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
  orbWrap: { position: 'absolute', width: 380, height: 380 },
  orb: { width: 380, height: 380, borderRadius: 190, opacity: 0.08 },
  top: { paddingHorizontal: space.l, gap: space.m },
  bars: { flexDirection: 'row', gap: 4 },
  track: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  full: { height: 3, width: '100%', borderRadius: 2 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 32 },
  stage: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xxl },
  content: { gap: space.l },
  kicker: { opacity: 0.85 },
  big: { fontSize: 58, lineHeight: 64, letterSpacing: -0.5 },
  line: { fontWeight: '500', opacity: 0.92 },
  bottom: { paddingHorizontal: space.l, minHeight: 80, justifyContent: 'flex-end' },
  hint: { textAlign: 'center', opacity: 0.75 },
});
