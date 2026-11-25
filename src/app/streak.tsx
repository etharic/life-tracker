import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { weekDates, weekdayShort, weekOf } from '@/domain/dates';
import { isActive } from '@/domain/progress';
import { useStreaks, useToday } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { Burst } from '@/ui/burst';
import { Button } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { POP, RM } from '@/ui/motion';
import { RollingText } from '@/ui/rolling-text';
import { T } from '@/ui/text';
import { colors, space, usePalette } from '@/ui/theme';

/** When the new number rolls in and today's circle fills, after the flame has landed. */
const BEAT = 650;

/**
 * The moment after closing a day that keeps a run going (after Duolingo's streak screen): the
 * flame lands, the count rolls from yesterday's number to today's, and today's circle in the
 * week fills. Shown once a day, never for a first day, and closed with one button.
 */
export default function StreakMoment() {
  const params = useLocalSearchParams<{ n?: string }>();
  const { current, longest } = useStreaks();
  const n = Math.max(2, Number(params.n) || current);
  const today = useToday();
  const days = useJournal((s) => s.days);
  const p = usePalette();
  const [shown, setShown] = useState(n - 1);
  const [lit, setLit] = useState(false);

  const flame = useSharedValue(0);
  const flicker = useSharedValue(1);
  useEffect(() => {
    flame.set(withSpring(1, { ...POP, damping: 12 }));
    flicker.set(
      withDelay(
        BEAT,
        withRepeat(
          withSequence(
            withTiming(1.06, { duration: 700, reduceMotion: RM }),
            withTiming(1, { duration: 700, reduceMotion: RM }),
          ),
          -1,
          true,
        ),
      ),
    );
    const t = setTimeout(() => {
      setShown(n);
      setLit(true);
      haptic.success();
    }, BEAT);
    return () => clearTimeout(t);
  }, [n, flame, flicker]);
  const flameStyle = useAnimatedStyle(() => ({
    opacity: flame.get(),
    transform: [{ scale: (0.4 + flame.get() * 0.6) * flicker.get() }, { translateY: (1 - flame.get()) * 40 }],
  }));

  const record = n >= longest;
  const line = record
    ? n === 2
      ? 'Two days in a row. Tomorrow makes three.'
      : 'Your longest run yet.'
    : `${longest - n} more ${longest - n === 1 ? 'day' : 'days'} to beat your record of ${longest}.`;

  return (
    <SafeAreaView style={styles.fill}>
      <View style={styles.body}>
        <View style={styles.flameWrap}>
          <Burst play={lit} color={p.flame} distance={110} />
          <Animated.View style={flameStyle}>
            <Icon name="flame.fill" size={132} color={colors.flame} />
          </Animated.View>
        </View>
        <View style={styles.count} accessible accessibilityLabel={`${n}-day streak`}>
          <RollingText variant="pageTitle" style={styles.number} text={String(shown)} />
          <T variant="title3" tone="ink2" center>
            {n === 1 ? 'day in a row' : 'days in a row'}
          </T>
        </View>
        <Week today={today} lit={lit} active={(d) => (d === today ? lit : isActive(days[d]))} />
        <T variant="body" tone="ink2" center style={styles.line}>
          {line}
        </T>
      </View>
      <View style={styles.footer}>
        <Button title="Continue" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

/** This week, Monday to Sunday: a filled circle for each day in the journal, today filling last. */
function Week({ today, lit, active }: { today: string; lit: boolean; active: (d: string) => boolean }) {
  const p = usePalette();
  return (
    <View style={styles.week}>
      {weekDates(weekOf(today)).map((d) => (
        <View key={d} style={styles.dayCol}>
          <T variant="caption" weight={d === today ? '700' : '500'} tone={d === today ? 'ink' : 'ink2'} chrome>
            {weekdayShort(d).slice(0, 2)}
          </T>
          <Dot on={active(d)} future={d > today} isToday={d === today} lit={lit} flame={p.flame} track={p.track} />
        </View>
      ))}
    </View>
  );
}

function Dot({
  on,
  future,
  isToday,
  lit,
  flame,
  track,
}: {
  on: boolean;
  future: boolean;
  isToday: boolean;
  lit: boolean;
  flame: string;
  track: string;
}) {
  const s = useSharedValue(isToday ? 0 : 1);
  useEffect(() => {
    if (isToday && lit) s.set(withSpring(1, { ...POP, damping: 10 }));
  }, [isToday, lit, s]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return (
    <View style={[styles.dot, { backgroundColor: future ? 'transparent' : track, borderColor: track }]}>
      {on ? (
        <Animated.View style={[styles.dotFill, { backgroundColor: flame }, fill]}>
          <Icon name="checkmark" size={13} color="#FFFFFF" weight="bold" />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl, paddingHorizontal: space.xl },
  flameWrap: { width: 220, height: 170, alignItems: 'center', justifyContent: 'center' },
  count: { alignItems: 'center', gap: space.xs },
  number: { fontSize: 88, lineHeight: 96, color: colors.flame, fontVariant: ['tabular-nums'] },
  week: { flexDirection: 'row', gap: space.s },
  dayCol: { alignItems: 'center', gap: space.xs },
  dot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotFill: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  line: { maxWidth: 300 },
  footer: { padding: space.l },
});
