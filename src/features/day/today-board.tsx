import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import type { SFSymbol } from 'expo-symbols';

import type { Category, ChallengeItem, ChallengeKind } from '@/domain/types';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { RM } from '@/ui/motion';
import { usePalette } from '@/ui/theme';
import { usePop } from '@/ui/use-pop';

/**
 * Today's goals and hobbies as eight small circles in one line (after Streaks and Instagram's
 * story circles): touch and hold one and it fills under the finger; when it closes, the item is
 * done. Holding a done circle empties it again. A quick tap never ticks anything by accident.
 */

export const HOLD_MS = 450;

export const CATEGORY_ICON: Record<Category, SFSymbol> = {
  health: 'heart',
  wealth: 'banknote',
  wise: 'lightbulb',
  versatility: 'sparkles',
  intellectual: 'book',
  physical: 'figure.run',
  creative: 'paintbrush.pointed',
  social: 'person.2',
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const STROKE = 3;
/** The largest a circle grows on a wide phone; on a small one the eight share the width. */
const DOT_MAX = 46;
const DOT_GAP = 6;
/** The extra space between the four goals and the four hobbies. */
const SPLIT = 14;

export type HabitKind = 'goal' | 'hobby';

/** The hello hop plays once per launch, the first time the circles are seen. */
let introduced = false;

/**
 * One goal or hobby on Today as a small circle with its symbol (after Instagram's story circles,
 * smaller): goals in ember, hobbies in sage. Touch and hold and the ring fills under the
 * finger; when it closes, the item is done and the circle fills with its colour. Holding a done
 * circle empties it. A tap never ticks: it says what the circle is.
 */
export function HoldDot({
  category,
  kind,
  label,
  caption,
  checked,
  star,
  starLabel,
  readOnly,
  selected,
  detail,
  meta,
  size,
  onToggle,
  onTap,
}: {
  category: Category;
  kind: HabitKind;
  label: string;
  caption: string;
  checked: boolean;
  star: boolean;
  starLabel: string;
  readOnly?: boolean;
  /** Its line or its time is showing below. */
  selected?: boolean;
  /** Time today, such as 2½ h. */
  detail?: string;
  /** What keeps it going: its run of days, or how the month is going. */
  meta?: string;
  size: number;
  onToggle: () => void;
  onTap?: () => void;
}) {
  const p = usePalette();
  const tint = kind === 'goal' ? p.accent : p.hobby;
  const soft = kind === 'goal' ? p.accentSoft : p.hobbySoft;
  const r = (size - STROKE) / 2;
  const c = 2 * Math.PI * r;
  // How far the finger has held, 0 to 1. A done circle shows it draining instead of filling.
  const hold = useSharedValue(0);
  const on = useSharedValue(checked ? 1 : 0);
  useEffect(() => on.set(checked ? 1 : 0), [checked, on]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fired = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);
  const pop = usePop(checked, 0.18);

  const arc = useAnimatedProps(() => {
    const v = on.get() ? 1 - hold.get() : hold.get();
    return { strokeDashoffset: c * (1 - v) };
  });
  const filled = useAnimatedStyle(() => ({
    opacity: withTiming(on.get(), { duration: 180, reduceMotion: RM }),
    transform: [{ scale: withTiming(on.get() ? 1 : 0.6, { duration: 220, reduceMotion: RM }) }],
  }));

  const commit = () => {
    if (checked) haptic.commit();
    else haptic.success();
    onToggle();
  };
  const start = () => {
    if (readOnly) return;
    fired.current = false;
    hold.set(withTiming(1, { duration: HOLD_MS, easing: Easing.linear }));
    timer.current = setTimeout(() => {
      fired.current = true;
      commit();
      hold.set(0);
    }, HOLD_MS);
  };
  const release = () => {
    clearTimeout(timer.current);
    if (!fired.current) hold.set(withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) }));
  };

  const inner = size - 2 * STROKE - 3;
  const a11y = `${kind === 'goal' ? 'Goal' : 'Hobby'}: ${label}, ${caption}${star ? `, ${starLabel}` : ''}${detail ? `, ${detail}` : ''}${meta ? `, ${meta}` : ''}`;
  return (
    <Pressable
      onPressIn={start}
      onPressOut={release}
      onPress={() => {
        if (!fired.current) onTap?.();
      }}
      disabled={readOnly && !onTap}
      hitSlop={{ top: 8, bottom: 8 }}
      accessible
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: readOnly, expanded: selected }}
      accessibilityLabel={a11y}
      accessibilityHint={readOnly ? undefined : 'Double tap to tick or untick'}
      accessibilityActions={readOnly ? [] : [{ name: 'activate' }]}
      // VoiceOver: a double tap ticks at once; holding is for fingers.
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'activate') commit();
      }}
      style={({ pressed }) => [pressed && styles.dotPressed]}
    >
      <Animated.View style={[{ width: size, height: size }, styles.dot, pop]}>
        <View style={[styles.dotFace, { width: inner, height: inner, backgroundColor: soft }]} />
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={soft} strokeWidth={STROKE} fill="none" />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={tint}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c} ${c}`}
            animatedProps={arc}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <Animated.View style={[styles.dotFace, { width: inner, height: inner, backgroundColor: tint }, filled]} />
        <Icon
          name={CATEGORY_ICON[category]}
          size={Math.round(size * 0.4)}
          color={checked ? p.onAccent : tint}
          weight={checked ? 'semibold' : 'medium'}
        />
        {/* The priority goal and the skill hobby keep their small star, as on the rings before. */}
        {star ? (
          <View style={[styles.star, { backgroundColor: p.bg }]}>
            <Icon name="star.fill" size={9} color={tint} />
          </View>
        ) : null}
        {selected ? <View style={[styles.selected, { backgroundColor: tint }]} /> : null}
      </Animated.View>
    </Pressable>
  );
}

/**
 * Today's eight circles in one line, never scrolled: the four goals, a little space, the four
 * hobbies. They share the width of the screen, up to DOT_MAX each.
 */
export function DotStrip({
  goalsDone,
  hobbiesDone,
  goals,
  hobbies,
}: {
  goalsDone: number;
  hobbiesDone: number;
  goals: (size: number) => ReactNode[];
  hobbies: (size: number) => ReactNode[];
}) {
  const [width, setWidth] = useState(0);
  const size = width ? Math.min(DOT_MAX, Math.floor((width - 6 * DOT_GAP - SPLIT) / 8)) : 0;
  // Motion says what can be touched: the first time the circles appear, a small hop runs along
  // them from left to right, once per launch.
  const [intro] = useState(() => {
    if (introduced) return false;
    introduced = true;
    return true;
  });
  return (
    <View style={styles.strip} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {size ? (
        <>
          <WaveGroup done={goalsDone} intro={intro} offset={0}>
            {goals(size)}
          </WaveGroup>
          <View style={{ width: SPLIT }} />
          <WaveGroup done={hobbiesDone} intro={intro} offset={4}>
            {hobbies(size)}
          </WaveGroup>
        </>
      ) : null}
    </View>
  );
}

/** Four circles that hop in turn when the last of them is ticked (after Apple Fitness's closed rings). */
function WaveGroup({
  done,
  intro,
  offset,
  children,
}: {
  done: number;
  intro: boolean;
  offset: number;
  children: ReactNode;
}) {
  // Counts each time the group becomes full while on screen (not when it opens already full).
  const [wave, setWave] = useState(0);
  const was = useRef(done);
  useEffect(() => {
    const full = done === 4 && was.current < 4;
    was.current = done;
    if (!full) return;
    const t = setTimeout(() => setWave((w) => w + 1), 120);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <View style={styles.wave}>
      {Children.map(children, (c, i) => (
        <Wave index={i} play={wave} intro={intro ? offset + i : undefined}>
          {c}
        </Wave>
      ))}
    </View>
  );
}

/** One circle's hop in the wave. Nothing with Reduce Motion. */
function Wave({
  index,
  play,
  intro,
  children,
}: {
  index: number;
  play: number;
  /** Its place in the hello hop, when it plays. */
  intro?: number;
  children: ReactNode;
}) {
  const y = useSharedValue(0);
  useEffect(() => {
    if (intro == null) return;
    y.set(
      withDelay(
        500 + intro * 60,
        withSequence(
          withTiming(-5, { duration: 150, easing: Easing.out(Easing.quad), reduceMotion: RM }),
          withSpring(0, { damping: 10, stiffness: 240, mass: 0.6, reduceMotion: RM }),
        ),
      ),
    );
    // Once, when the circles first appear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!play) return;
    y.set(
      withDelay(
        index * 70,
        withSequence(
          withTiming(-6, { duration: 140, easing: Easing.out(Easing.quad), reduceMotion: RM }),
          withSpring(0, { damping: 9, stiffness: 260, mass: 0.6, reduceMotion: RM }),
        ),
      ),
    );
  }, [play, index, y]);
  const hop = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return <Animated.View style={hop}>{children}</Animated.View>;
}

// ---------- Challenges ----------

export interface ActiveChallenge {
  kind: ChallengeKind;
  item: ChallengeItem;
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', justifyContent: 'center' },
  wave: { flexDirection: 'row', gap: DOT_GAP },
  dot: { alignItems: 'center', justifyContent: 'center' },
  dotFace: { position: 'absolute', borderRadius: 999 },
  dotPressed: { opacity: 0.85 },
  selected: { position: 'absolute', bottom: -7, width: 4, height: 4, borderRadius: 2 },
  star: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
