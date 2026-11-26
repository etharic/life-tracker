import { router } from 'expo-router';
import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, Settings, StyleSheet, View } from 'react-native';
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

import { formatFull } from '@/domain/dates';
import type { Category, ChallengeItem, ChallengeKind, ChallengeOutcome } from '@/domain/types';
import { CHALLENGE_COPY, CHALLENGE_ROUTE } from '@/features/past/challenges';
import { useJournal } from '@/state/journal';
import { Button } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { enterSoft, exitSoft, layoutMove, RM } from '@/ui/motion';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, radius, space, TARGET, usePalette } from '@/ui/theme';
import { usePop } from '@/ui/use-pop';
import { GroupHeader } from '@/ui/group';

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

// ---------- Challenges: a stack of cards, after Wallet ----------

/** How much of a card shows under the one in front of it. */
const PEEK = 58;
const CARD = 104;

export interface ActiveChallenge {
  kind: ChallengeKind;
  item: ChallengeItem;
}

/**
 * Active challenges as a stack of cards, each one's title showing, the newest in front. Tap a card
 * and it lifts out of the stack with its date and the two ways it can end; tap it again to put it
 * back. Ending one keeps Undo in view for a few seconds.
 */
export function ChallengeStack({ active }: { active: ActiveChallenge[] }) {
  const p = usePalette();
  const [open, setOpen] = useState<string | null>(null);
  // Simulator check only: `-LTOpen challenge` lifts the first card, as a tap does. Unused on a phone.
  useEffect(() => {
    const seq: unknown = Settings.get('LTOpen');
    if (typeof seq !== 'string' || !seq.includes('challenge')) return;
    const t = setTimeout(() => setOpen(active[0] ? `${active[0].kind}/${active[0].item.id}` : null), 2400);
    return () => clearTimeout(t);
    // Once, at launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [ended, setEnded] = useState<{ kind: ChallengeKind; before: ChallengeItem; outcome: string } | null>(null);
  useEffect(() => {
    if (!ended) return;
    const t = setTimeout(() => setEnded(null), 6000);
    return () => clearTimeout(t);
  }, [ended]);

  const conclude = (kind: ChallengeKind, item: ChallengeItem, outcome: ChallengeOutcome) => {
    if (outcome === 'succeeded') haptic.success();
    else haptic.commit();
    useJournal.getState().saveChallenge(kind, { ...item, outcome, started: true });
    setOpen(null);
    setEnded({
      kind,
      before: item,
      outcome: outcome === 'failed' ? CHALLENGE_COPY[kind].failed : CHALLENGE_COPY[kind].succeeded,
    });
  };

  return (
    <View style={styles.rowGroup}>
      <GroupHeader title="Challenges" />
      {ended ? (
        <Animated.View entering={enterSoft} exiting={exitSoft} style={styles.undoRow}>
          <T variant="subhead" tone="ink2" numberOfLines={1} style={styles.flex}>
            {`${ended.outcome}: ${ended.before.title}`}
          </T>
          <Press
            onPress={() => {
              haptic.select();
              useJournal.getState().saveChallenge(ended.kind, ended.before);
              setEnded(null);
            }}
            accessibilityLabel={`Undo, ${ended.before.title}`}
            style={styles.undo}
          >
            <T variant="subhead" weight="600" tone="accent">
              Undo
            </T>
          </Press>
        </Animated.View>
      ) : null}
      {active.length ? (
        <View>
          {active.map(({ kind, item }, i) => {
            const key = `${kind}/${item.id}`;
            const isOpen = open === key;
            const prevOpen = i > 0 && open === `${active[i - 1].kind}/${active[i - 1].item.id}`;
            const last = i === active.length - 1;
            const nextOpen = !last && open === `${active[i + 1].kind}/${active[i + 1].item.id}`;
            // Each card tucks under the one before it, leaving its top band in view; an open card
            // and the one after it stand apart.
            const overlap = i === 0 ? 0 : isOpen || prevOpen ? space.s : -(CARD - PEEK);
            const copy = CHALLENGE_COPY[kind];
            return (
              <Animated.View
                key={key}
                layout={layoutMove}
                exiting={exitSoft}
                style={[styles.cardWrap, { marginTop: overlap, zIndex: i }]}
              >
                <Press
                  onPress={() => {
                    haptic.select();
                    setOpen((o) => (o === key ? null : key));
                  }}
                  accessibilityState={{ expanded: isOpen }}
                  accessibilityLabel={`${item.title}, ${copy.title}`}
                  accessibilityHint={isOpen ? 'Puts it back in the stack' : 'Lifts it out to end it'}
                  style={[
                    styles.card,
                    { backgroundColor: p.surface, borderColor: p.hairline },
                    !isOpen && !last && !nextOpen && styles.cardTucked,
                  ]}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.flex}>
                      <T variant="callout" weight="600" numberOfLines={isOpen ? undefined : 1}>
                        {item.title}
                      </T>
                      <T variant="footnote" tone="ink2" numberOfLines={1}>
                        {item.date ? `${copy.title}, ${formatFull(item.date)}` : copy.title}
                      </T>
                    </View>
                    <Icon
                      name={isOpen ? 'chevron.up' : 'chevron.down'}
                      size={12}
                      color={colors.ink3}
                      weight="semibold"
                    />
                  </View>
                  {isOpen ? (
                    <Animated.View entering={enterSoft} style={styles.cardBody}>
                      {item.notes ? (
                        <T variant="subhead" tone="ink2">
                          {item.notes}
                        </T>
                      ) : null}
                      <View style={styles.cardButtons}>
                        <View style={styles.flex}>
                          <Button
                            title={copy.succeeded}
                            icon="checkmark"
                            onPress={() => conclude(kind, item, 'succeeded')}
                          />
                        </View>
                        <View style={styles.flex}>
                          <Button
                            title={copy.failed}
                            icon="xmark"
                            kind="secondary"
                            onPress={() => conclude(kind, item, 'failed')}
                          />
                        </View>
                      </View>
                      <Press
                        onPress={() => router.push(CHALLENGE_ROUTE[kind])}
                        accessibilityLabel={`Open the ${copy.title.toLowerCase()}`}
                        style={styles.listLink}
                      >
                        <T variant="subhead" weight="600" tone="accent">
                          {`Open the ${copy.title.toLowerCase()}`}
                        </T>
                      </Press>
                    </Animated.View>
                  ) : null}
                </Press>
              </Animated.View>
            );
          })}
        </View>
      ) : (
        <View style={[styles.empty, { borderColor: p.hairline }]}>
          <T variant="subhead" tone="ink2">
            Nothing under way. Start one from a list.
          </T>
          <View style={styles.emptyLinks}>
            {(Object.keys(CHALLENGE_ROUTE) as ChallengeKind[]).map((k) => (
              <Press
                key={k}
                onPress={() => router.push(CHALLENGE_ROUTE[k])}
                accessibilityLabel={CHALLENGE_COPY[k].title}
                style={styles.listLink}
              >
                <T variant="subhead" weight="600" tone="accent">
                  {CHALLENGE_COPY[k].title}
                </T>
              </Press>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  rowGroup: { gap: space.m },
  strip: { flexDirection: 'row', justifyContent: 'center' },
  wave: { flexDirection: 'row', gap: DOT_GAP },
  dot: { alignItems: 'center', justifyContent: 'center' },
  dotFace: { position: 'absolute', borderRadius: 999 },
  dotPressed: { opacity: 0.85 },
  selected: { position: 'absolute', bottom: -7, width: 4, height: 4, borderRadius: 2 },
  cardWrap: {},
  card: {
    borderRadius: radius.section,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.l,
    gap: space.m,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
  },
  cardTucked: { height: CARD },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: PEEK - 2 * space.l + 4 },
  cardBody: { gap: space.m },
  cardButtons: { flexDirection: 'row', gap: space.s },
  listLink: { minHeight: TARGET, justifyContent: 'center', alignSelf: 'flex-start' },
  undoRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: TARGET },
  undo: { minHeight: TARGET, justifyContent: 'center', paddingHorizontal: space.s },
  empty: {
    padding: space.l,
    gap: space.xs,
    borderRadius: radius.section,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  emptyLinks: { flexDirection: 'row', gap: space.l },
});
