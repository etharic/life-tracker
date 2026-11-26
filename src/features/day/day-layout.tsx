import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { Settings, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  LayoutAnimationConfig,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { monthName, monthOf, weekOf } from '@/domain/dates';
import { feeling } from '@/domain/feelings';
import {
  CATEGORY_LABEL,
  formatHours,
  hobbyHours,
  HOUR_PER_TICK,
  type Category,
  type GoalCategory,
  type HobbyCategory,
  type ISODate,
  CHALLENGE_KINDS,
} from '@/domain/types';
import {
  orderedGoals,
  orderedHobbies,
  useDay,
  useDayLookup,
  useItemStreak,
  useMonth,
  useStreaks,
  useToday,
} from '@/features/hooks';
import { ringStat } from '@/domain/progress';
import { useJournal } from '@/state/journal';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { Divider } from '@/ui/layout';
import { enterRow, enterSoft, exitSoft, layoutMove, RM } from '@/ui/motion';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, elevation, radius, space, TARGET } from '@/ui/theme';
import { GroupHeader } from '@/ui/group';

import { AllDone } from './all-done';
import { MediaStrip } from './media';
import { DotStrip, HoldDot, type ActiveChallenge } from './today-board';
import { WeekItems } from './week-items';

/**
 * The day, in three groups that follow how a day is lived:
 *   Journal    how the day felt, its one line, the writing and the photos: one entry card
 *   Today      the four goals and four hobbies as rings to hold, then the challenges as a stack
 *   This week  the week's priorities and its other commitments, as capsules
 * Group titles are plain text on the paper (no box), and only the content sits on cards.
 */

/** Shown when the month has no setup yet (and the setup card was skipped). */
export function NoSetupNote({ date }: { date: ISODate }) {
  const month = useMonth(monthOf(date));
  if (month.setup) return null;
  const name = monthName(monthOf(date));
  return (
    <Press
      feedback="highlight"
      onPress={() => router.push(`/setup/${monthOf(date)}`)}
      accessibilityLabel={`Set up ${name}`}
      style={[styles.card, styles.note]}
    >
      <T variant="subhead" tone="ink2">{`Goals and hobbies appear here once ${name} is set up.`}</T>
      <T variant="subhead" weight="600" tone="accent">{`Set up ${name}`}</T>
    </Press>
  );
}

// ---------- Goals and hobbies ----------

/** Goals in ember, hobbies in sage: said once, until the first circle is held. */
const TIP = 'Touch and hold a circle to tick it off. Orange circles are goals, green are hobbies.';

/**
 * Today's goals and hobbies as eight circles in one line, always in view: hold one to tick it.
 * The priority goal and the skill hobby come first, starred. A tap says what a circle is (a goal)
 * or opens its time (a hobby). `locked`: a past day shown as it was; nothing can be ticked.
 */
export function TodayGroup({ date, locked }: { date: ISODate; locked?: boolean }) {
  const month = useMonth(monthOf(date));
  const day = useDay(date);
  const { current } = useStreaks();
  const setup = month.setup;
  const [timing, setTiming] = useState<HobbyCategory | null>(null);
  const [info, setInfo] = useState<GoalCategory | null>(null);
  // Until the first circle is ticked by holding, a quiet line under them says how. Kept on the
  // phone, not in the journal.
  const [learned, setLearned] = useState(() => !!Settings.get('LTRingsLearned'));
  const learn = () => {
    if (learned) return;
    Settings.set({ LTRingsLearned: 1 });
    setLearned(true);
  };
  useEffect(() => {
    if (!info) return;
    const t = setTimeout(() => setInfo(null), 3200);
    return () => clearTimeout(t);
  }, [info]);
  // Simulator check only: `-LTOpen hours` opens the first hobby's time and `goal` names the first
  // goal, as taps do. Unused on a phone.
  useEffect(() => {
    const seq: unknown = Settings.get('LTOpen');
    if (typeof seq !== 'string' || locked || !setup) return;
    const timers = seq.split(',').map((k, i) =>
      setTimeout(
        () => {
          if (k === 'hours') setTiming(orderedHobbies(setup)[0]);
          if (k === 'goal') setInfo(orderedGoals(setup)[0]);
        },
        1200 * (i + 1),
      ),
    );
    return () => timers.forEach(clearTimeout);
    // Once, at launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, !!setup]);
  if (!setup) return null;

  const goalsDone = orderedGoals(setup).filter((c) => day.goals[c]).length;
  const hobbiesDone = orderedHobbies(setup).filter((c) => day.hobbies[c]).length;
  const { updateDay } = useJournal.getState();

  return (
    <View style={styles.group}>
      <View style={styles.board}>
        <DotStrip
          goalsDone={goalsDone}
          hobbiesDone={hobbiesDone}
          goals={(size) =>
            orderedGoals(setup).map((c) => (
              <HabitDot
                date={date}
                key={c}
                size={size}
                kind="goal"
                category={c}
                label={setup.goals[c].text}
                caption={CATEGORY_LABEL[c]}
                checked={day.goals[c]}
                star={c === setup.priority}
                starLabel="priority goal"
                readOnly={locked}
                selected={info === c}
                onToggle={() => {
                  learn();
                  updateDay(date, (d) => void (d.goals[c] = !d.goals[c]));
                }}
                onTap={() => {
                  haptic.select();
                  setTiming(null);
                  setInfo((x) => (x === c ? null : c));
                }}
              />
            ))
          }
          hobbies={(size) =>
            orderedHobbies(setup).map((c) => {
              const hours = hobbyHours(day, c);
              return (
                <HabitDot
                  date={date}
                  key={c}
                  size={size}
                  kind="hobby"
                  category={c}
                  label={setup.hobbies[c].text}
                  caption={CATEGORY_LABEL[c]}
                  checked={day.hobbies[c]}
                  star={c === setup.skill}
                  starLabel="skill hobby"
                  readOnly={locked}
                  selected={timing === c}
                  detail={hours > HOUR_PER_TICK ? formatHours(hours) : undefined}
                  onToggle={() => {
                    learn();
                    updateDay(date, (d) => {
                      d.hobbies[c] = !d.hobbies[c];
                      delete d.hobbyHours[c];
                    });
                  }}
                  onTap={() => {
                    haptic.select();
                    setInfo(null);
                    if (!locked) setTiming((t) => (t === c ? null : c));
                  }}
                />
              );
            })
          }
        />
        {!learned && !locked && !info && !timing ? (
          <View style={styles.tip}>
            <Icon name="hand.tap" size={14} color={colors.ink2} />
            <T variant="footnote" tone="ink2" style={styles.tipText}>
              {TIP}
            </T>
          </View>
        ) : null}
        {info ? (
          <GoalInfo date={date} category={info} name={setup.goals[info].text} done={day.goals[info]} locked={locked} />
        ) : null}
        {timing && !locked ? (
          <HoursRow date={date} category={timing} name={setup.hobbies[timing].text} onClose={() => setTiming(null)} />
        ) : null}
      </View>
      <AllDone date={date} done={goalsDone === 4 && hobbiesDone === 4} streak={current} />
    </View>
  );
}

/**
 * What keeps a goal or hobby going: its run of days once there is one (the pull of not breaking
 * it), otherwise how the month is going.
 */
function useHabitMeta(date: ISODate, c: Category): string | undefined {
  const setup = useMonth(monthOf(date)).setup;
  const bankId = setup
    ? (c in setup.goals ? setup.goals[c as GoalCategory] : setup.hobbies[c as HobbyCategory]).bankId
    : undefined;
  const run = useItemStreak(c, bankId);
  const lookup = useDayLookup();
  const today = useToday();
  const stat = useMemo(() => ringStat(monthOf(date), c, date > today ? date : today, lookup), [date, c, today, lookup]);
  return run >= 2 ? `${run} days running` : stat.passed ? `${stat.ticked} of ${stat.passed} days` : undefined;
}

function HabitDot({ date, ...props }: { date: ISODate } & Omit<ComponentProps<typeof HoldDot>, 'meta'>) {
  const meta = useHabitMeta(date, props.category);
  return <HoldDot {...props} meta={meta} />;
}

/** A tapped goal's name and how it is going, in its colour, for a few seconds. */
function GoalInfo({
  date,
  category,
  name,
  done,
  locked,
}: {
  date: ISODate;
  category: GoalCategory;
  name: string;
  done: boolean;
  locked?: boolean;
}) {
  const meta = useHabitMeta(date, category);
  const how = locked ? undefined : done ? 'Hold to untick' : 'Hold to tick';
  return (
    <Animated.View
      key={category}
      entering={enterSoft}
      exiting={exitSoft}
      style={styles.info}
      accessibilityLiveRegion="polite"
    >
      <T variant="subhead" weight="600" tone="accent" numberOfLines={1}>
        {name}
      </T>
      <T variant="footnote" tone="ink2" numberOfLines={1}>
        {[meta, how].filter(Boolean).join('. ')}
      </T>
    </Animated.View>
  );
}

/**
 * Time on a hobby today, under the rings: a tick is an hour; more can be added in half hours.
 * Down to nothing clears the tick.
 */
function HoursRow({
  date,
  category,
  name,
  onClose,
}: {
  date: ISODate;
  category: HobbyCategory;
  name: string;
  onClose: () => void;
}) {
  const day = useDay(date);
  const hours = hobbyHours(day, category);
  const meta = useHabitMeta(date, category);
  const set = (h: number) => {
    haptic.select();
    useJournal.getState().updateDay(date, (d) => {
      d.hobbies[category] = h > 0;
      if (h > 0 && h !== HOUR_PER_TICK) d.hobbyHours[category] = h;
      else delete d.hobbyHours[category];
    });
  };
  return (
    <Animated.View entering={enterSoft} exiting={exitSoft} layout={layoutMove} style={[styles.card, styles.hoursRow]}>
      <View style={styles.flex}>
        <T variant="subhead" weight="600" style={styles.hobbyName} numberOfLines={1}>
          {name}
        </T>
        <T variant="footnote" tone="ink2" numberOfLines={1}>
          {meta ? `Time today, ${meta}` : 'Time today'}
        </T>
      </View>
      <Press
        onPress={() => set(Math.max(0, hours - 0.5))}
        disabled={hours <= 0}
        accessibilityLabel="Half an hour less"
        style={styles.stepper}
      >
        <Icon name="minus" size={14} color={colors.ink} weight="semibold" />
      </Press>
      <T variant="headline" style={[styles.tabular, styles.hoursValue]} accessibilityLiveRegion="polite">
        {formatHours(hours)}
      </T>
      <Press
        onPress={() => set(Math.min(24, hours + (hours === 0 ? HOUR_PER_TICK : 0.5)))}
        disabled={hours >= 24}
        accessibilityLabel="Half an hour more"
        style={styles.stepper}
      >
        <Icon name="plus" size={14} color={colors.ink} weight="semibold" />
      </Press>
      <Press onPress={onClose} accessibilityLabel="Close the time" hitSlop={10} style={styles.close}>
        <Icon name="xmark" size={12} color={colors.ink3} weight="semibold" />
      </Press>
    </Animated.View>
  );
}

// ---------- Journal: feeling, line, writing, photos ----------

export function JournalGroup({
  date,
  isToday,
  full,
  titled = true,
  locked,
}: {
  date: ISODate;
  isToday: boolean;
  full?: boolean;
  /** Today puts the entry first and needs no title over it. */
  titled?: boolean;
  /** A past day shown as it was, until Edit is chosen. */
  locked?: boolean;
}) {
  const day = useDay(date);
  const f = feeling(day.feeling);
  const hasEntry = !!(day.title || day.writing || day.media.length);
  const write = () => router.push(`/close-day/${date}`);

  return (
    <View style={styles.group}>
      {titled ? <GroupHeader title="Journal" /> : null}
      <Animated.View layout={layoutMove} style={styles.bare}>
        <View>
          {/* How the day felt: one colour, one name. The scale opens only to choose or change it. */}
          {/* How the day felt is chosen in the journal, once; here it is only shown. */}
          {f && locked ? (
            <View style={styles.feelingRow} accessible accessibilityLabel={`Felt ${f.score}, ${f.name}`}>
              <View style={[styles.swatch, { backgroundColor: f.color }]} />
              <View style={styles.flex}>
                <T variant="headline">{f.name}</T>
                <T variant="footnote" tone="ink2">{`${f.score} of 10`}</T>
              </View>
            </View>
          ) : null}
          {!f && locked ? (
            <View style={styles.entry}>
              <T variant="subhead" tone="ink2">
                No feeling recorded
              </T>
            </View>
          ) : null}
          {f && !locked ? (
            <Press
              feedback="highlight"
              onPress={write}
              accessibilityLabel={`Felt ${f.score}, ${f.name}`}
              accessibilityHint="Opens the day to change it"
            >
              <View style={styles.feelingRow}>
                <View style={[styles.swatch, { backgroundColor: f.color }]} />
                <View style={styles.flex}>
                  <T variant="headline">{f.name}</T>
                  <T variant="footnote" tone="ink2">{`${f.score} of 10`}</T>
                </View>
                <Icon name="chevron.right" size={13} color={colors.ink3} weight="semibold" />
              </View>
            </Press>
          ) : null}
          {f || locked ? <Divider /> : null}
          {/* The entry: its line in the serif face, a glimpse of the writing, the photos. */}
          <LayoutAnimationConfig skipEntering>
            {locked ? (
              <View style={styles.entry}>
                {hasEntry ? (
                  <>
                    {day.title ? <T variant="journalTitle">{day.title}</T> : null}
                    {day.writing ? <T variant="journalBody">{day.writing}</T> : null}
                    <MediaStrip date={date} media={day.media} />
                  </>
                ) : (
                  <T variant="subhead" tone="ink2">
                    Nothing was written this day
                  </T>
                )}
              </View>
            ) : hasEntry ? (
              <Animated.View key="entry" entering={enterRow}>
                <Press feedback="highlight" onPress={write} accessibilityLabel="Open the entry">
                  <View style={styles.entry}>
                    {day.title ? <T variant="journalTitle">{day.title}</T> : null}
                    {day.writing ? (
                      <T variant="journalBody" tone={full ? 'ink' : 'ink2'} numberOfLines={full ? undefined : 3}>
                        {day.writing}
                      </T>
                    ) : null}
                    <MediaStrip date={date} media={day.media} />
                  </View>
                </Press>
              </Animated.View>
            ) : (
              <Animated.View key="write" entering={enterSoft}>
                <Press
                  feedback="highlight"
                  onPress={write}
                  accessibilityLabel={isToday ? 'Write today’s journal' : 'Write about this day'}
                >
                  <View style={styles.writeRow}>
                    <View style={styles.writeIcon}>
                      {isToday ? <Ember /> : null}
                      <Icon name="square.and.pencil" size={16} color={colors.onAccent} weight="semibold" />
                    </View>
                    <View style={styles.flex}>
                      <T variant="headline" tone="accent">
                        {isToday ? 'Write today’s journal' : 'Write about this day'}
                      </T>
                      <T variant="footnote" tone="ink2">
                        One line, a few words, a photo or a recording
                      </T>
                    </View>
                    <Icon name="chevron.right" size={13} color={colors.ink3} weight="semibold" />
                  </View>
                </Press>
              </Animated.View>
            )}
          </LayoutAnimationConfig>
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * A soft glow that swells and fades behind today's unwritten journal, like an ember breathing:
 * the one thing on Today that moves on its own, because it is the one thing waiting for you.
 * Still under Reduce Motion.
 */
function Ember() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad), reduceMotion: RM }), -1));
  }, [t]);
  const glow = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - t.get()),
    transform: [{ scale: 1 + t.get() * 0.7 }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.ember, glow]} />;
}

// ---------- This week: its commitments ----------

export function WeekGroup({ date, locked }: { date: ISODate; locked?: boolean }) {
  const week = weekOf(date);
  return (
    <View style={styles.group}>
      <GroupHeader title="This week’s commitments" />
      <Animated.View layout={layoutMove} style={styles.card}>
        <View style={styles.clip}>
          <WeekItems week={week} date={date} interactive={!locked} padded labelled={false} />
        </View>
      </Animated.View>
    </View>
  );
}

/** Every active challenge, from every list there is, newest first. */
export function useActiveChallenges(): ActiveChallenge[] {
  const challenges = useJournal((s) => s.challenges);
  return useMemo(
    () =>
      CHALLENGE_KINDS.flatMap((kind) =>
        challenges[kind].filter((it) => it.started && it.outcome === 'open').map((item) => ({ kind, item })),
      ).sort((a, b) => ((a.item.date ?? a.item.added) < (b.item.date ?? b.item.added) ? 1 : -1)),
    [challenges],
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  group: { gap: space.m },
  board: { gap: space.m },
  tip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs },
  tipText: { flexShrink: 1, textAlign: 'center' },
  info: { alignItems: 'center', gap: 1 },
  hobbyName: { color: colors.hobby },
  card: { borderRadius: radius.section, backgroundColor: colors.surface, ...elevation.card },
  /**
   * Content that belongs to the page sits on it, without a box: rows reach out to the screen
   * gutter so their text lines up with the titles and pills above.
   */
  bare: { marginHorizontal: -space.l },
  clip: {
    borderRadius: radius.section,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  feelingRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l, minHeight: TARGET + 16 },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.edge },
  entry: { gap: space.s, padding: space.l },
  writeRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l, minHeight: TARGET + 16 },
  writeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { padding: space.l, gap: space.xs },
  ember: { position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent },
  trail: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, paddingLeft: space.l },
  close: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  stepper: {
    width: 36,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hoursValue: { minWidth: 48, textAlign: 'center' },
});
