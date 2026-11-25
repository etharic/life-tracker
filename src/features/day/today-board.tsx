import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, Settings, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
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

/**
 * Today's goals and hobbies as rings, always in view, four to a row (after Streaks): touch and hold
 * a ring and it fills under the finger; when it closes, the item is done. Holding a done ring
 * empties it again. A quick tap never ticks anything by accident: it says to hold (a goal) or
 * opens the time spent (a hobby).
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
const RING = 60;
const STROKE = 5;

export function HoldRing({
  category,
  label,
  caption,
  checked,
  star,
  starLabel,
  readOnly,
  selected,
  detail,
  onToggle,
  onTap,
}: {
  category: Category;
  label: string;
  caption: string;
  checked: boolean;
  star: boolean;
  starLabel: string;
  readOnly?: boolean;
  /** Its time row is open below. */
  selected?: boolean;
  /** A short value under the label, such as 2½ h. */
  detail?: string;
  onToggle: () => void;
  onTap?: () => void;
}) {
  const p = usePalette();
  const r = (RING - STROKE) / 2;
  const c = 2 * Math.PI * r;
  // How far the finger has held, 0 to 1. A done ring shows it draining instead of filling.
  const hold = useSharedValue(0);
  const on = useSharedValue(checked ? 1 : 0);
  useEffect(() => on.set(checked ? 1 : 0), [checked, on]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fired = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);
  const pop = usePop(checked, 0.16);

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

  const a11y = `${label}, ${caption}${star ? `, ${starLabel}` : ''}${detail ? `, ${detail}` : ''}`;
  return (
    <Pressable
      onPressIn={start}
      onPressOut={release}
      onPress={() => {
        if (!fired.current && !readOnly) onTap?.();
      }}
      disabled={readOnly && !onTap}
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
      style={styles.tile}
    >
      <Animated.View style={[styles.ring, pop]}>
        <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
          <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={p.track} strokeWidth={STROKE} fill="none" />
          <AnimatedCircle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            stroke={p.accent}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c} ${c}`}
            animatedProps={arc}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
        <Animated.View style={[styles.done, { backgroundColor: p.accent }, filled]} />
        <Icon
          name={CATEGORY_ICON[category]}
          size={22}
          color={checked ? colors.onAccent : colors.ink2}
          weight={checked ? 'semibold' : 'regular'}
        />
        {star ? (
          <View style={[styles.star, { backgroundColor: p.bg }]}>
            <Icon name="star.fill" size={11} color={colors.accent} />
          </View>
        ) : null}
      </Animated.View>
      <T
        variant="footnote"
        weight={selected ? '600' : '500'}
        tone={checked ? 'ink2' : 'ink'}
        numberOfLines={2}
        style={styles.label}
      >
        {label}
      </T>
      {detail ? (
        <T variant="caption" tone="accent" weight="600" style={styles.detail}>
          {detail}
        </T>
      ) : null}
    </Pressable>
  );
}

/** A row of four rings with its name and count above. */
export function RingRow({ title, done, children }: { title: string; done: number; children: ReactNode }) {
  return (
    <View style={styles.rowGroup}>
      <View style={styles.rowHead}>
        <T variant="footnote" weight="600" tone="ink2" accessibilityRole="header" style={styles.flex}>
          {title}
        </T>
        <T variant="footnote" tone="ink2" style={styles.tabular}>
          {done === 4 ? 'All done' : `${done} of 4`}
        </T>
      </View>
      <View style={styles.rings}>{children}</View>
    </View>
  );
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
      <View style={styles.rowHead}>
        <T variant="footnote" weight="600" tone="ink2" accessibilityRole="header" style={styles.flex}>
          Challenges
        </T>
        <T variant="footnote" tone="ink2" style={styles.tabular}>
          {active.length ? `${active.length} under way` : ''}
        </T>
      </View>
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
                    <View style={[styles.badge, { backgroundColor: p.accentSoft }]}>
                      <Icon name={copy.icon} size={16} color={colors.accent} weight="semibold" />
                    </View>
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
  rowHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.m },
  rings: { flexDirection: 'row', gap: space.s },
  tile: { flex: 1, alignItems: 'center', gap: space.s, minHeight: TARGET },
  ring: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  done: {
    position: 'absolute',
    width: RING - 2 * STROKE - 2,
    height: RING - 2 * STROKE - 2,
    borderRadius: RING,
  },
  star: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { textAlign: 'center' },
  detail: { textAlign: 'center', fontVariant: ['tabular-nums'] },
  cardWrap: {},
  card: {
    borderRadius: radius.section + 2,
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
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
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
