import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Settings, StyleSheet, View } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';

import { monthName, monthOf, monthOfWeek, weekDates, weekIndexInMonth, weekOf } from '@/domain/dates';
import { feeling } from '@/domain/feelings';
import {
  CATEGORY_LABEL,
  formatHours,
  hobbyHours,
  HOUR_PER_TICK,
  type HobbyCategory,
  type ISODate,
  CHALLENGE_KINDS,
  CHECK_KEYS,
} from '@/domain/types';
import { orderedGoals, orderedHobbies, useDay, useMonth, useStreaks, useWeek } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { Divider } from '@/ui/layout';
import { enterRow, enterSoft, exitSoft, layoutMove } from '@/ui/motion';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, elevation, radius, space, TARGET } from '@/ui/theme';
import { GroupHeader } from '@/ui/group';

import { AllDone } from './all-done';
import { MediaStrip } from './media';
import { ChallengeStack, HoldRing, RingRow, type ActiveChallenge } from './today-board';
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

// ---------- Goals, hobbies and challenges ----------

/**
 * Today's goals and hobbies as two rows of rings, always in view: hold a ring to tick it. The
 * priority goal and the skill hobby come first, starred. Under them, the challenges under way as a
 * stack of cards. `locked`: a past day shown as it was; nothing can be ticked and challenges,
 * which are not tied to a day, are left out.
 */
export function TodayGroup({ date, locked }: { date: ISODate; locked?: boolean }) {
  const month = useMonth(monthOf(date));
  const day = useDay(date);
  const { current } = useStreaks();
  const setup = month.setup;
  const active = useActiveChallenges();
  const [timing, setTiming] = useState<HobbyCategory | null>(null);
  const [hint, setHint] = useState(false);
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(false), 2200);
    return () => clearTimeout(t);
  }, [hint]);
  // Simulator check only: `-LTOpen hours` opens the first hobby's time, as a tap does. Unused on a phone.
  useEffect(() => {
    const seq: unknown = Settings.get('LTOpen');
    if (typeof seq !== 'string' || locked || !setup) return;
    const timers = seq.split(',').map((k, i) =>
      setTimeout(
        () => {
          if (k === 'hours') setTiming(orderedHobbies(setup)[0]);
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
        <RingRow title="Goals" done={goalsDone}>
          {orderedGoals(setup).map((c) => (
            <HoldRing
              key={c}
              category={c}
              label={setup.goals[c].text}
              caption={CATEGORY_LABEL[c]}
              checked={day.goals[c]}
              star={c === setup.priority}
              starLabel="priority goal"
              readOnly={locked}
              onToggle={() => updateDay(date, (d) => void (d.goals[c] = !d.goals[c]))}
              onTap={() => setHint(true)}
            />
          ))}
        </RingRow>
        <RingRow title="Hobbies" done={hobbiesDone}>
          {orderedHobbies(setup).map((c) => {
            const hours = hobbyHours(day, c);
            return (
              <HoldRing
                key={c}
                category={c}
                label={setup.hobbies[c].text}
                caption={CATEGORY_LABEL[c]}
                checked={day.hobbies[c]}
                star={c === setup.skill}
                starLabel="skill hobby"
                readOnly={locked}
                selected={timing === c}
                detail={hours > HOUR_PER_TICK ? formatHours(hours) : undefined}
                onToggle={() =>
                  updateDay(date, (d) => {
                    d.hobbies[c] = !d.hobbies[c];
                    delete d.hobbyHours[c];
                  })
                }
                onTap={() => {
                  haptic.select();
                  setTiming((t) => (t === c ? null : c));
                }}
              />
            );
          })}
        </RingRow>
        {hint ? (
          <Animated.View entering={enterSoft} exiting={exitSoft}>
            <T variant="footnote" tone="ink2" style={styles.hint} accessibilityLiveRegion="polite">
              Touch and hold a ring to tick it off. Tap a hobby for its time.
            </T>
          </Animated.View>
        ) : null}
        {timing && !locked ? (
          <HoursRow date={date} category={timing} name={setup.hobbies[timing].text} onClose={() => setTiming(null)} />
        ) : null}
      </View>
      {locked ? null : <ChallengeStack active={active} />}
      <AllDone date={date} done={goalsDone === 4 && hobbiesDone === 4} streak={current} />
    </View>
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
        <T variant="footnote" tone="ink2">
          Time today
        </T>
        <T variant="subhead" weight="600" numberOfLines={1}>
          {name}
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
          {/* How the day felt is chosen in Close the day, once; here it is only shown. */}
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
                  accessibilityLabel={isToday ? 'Close the day' : 'Write about this day'}
                >
                  <View style={styles.writeRow}>
                    <View style={styles.writeIcon}>
                      <Icon name="square.and.pencil" size={16} color={colors.onAccent} weight="semibold" />
                    </View>
                    <View style={styles.flex}>
                      <T variant="headline" tone="accent">
                        {isToday ? 'Close the day' : 'Write about this day'}
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

// ---------- This week: its commitments ----------

export function WeekGroup({ date, locked }: { date: ISODate; locked?: boolean }) {
  const week = weekOf(date);
  const rec = useWeek(week);
  const days = useJournal((s) => s.days);
  const doneSet = useMemo(() => new Set(weekDates(week).flatMap((d) => days[d]?.prioritiesDone ?? [])), [days, week]);
  const hasChecks = !!useMonth(monthOfWeek(week)).setup;
  // One count for all the week's commitments: its priorities and the month's weekly checks.
  const total = rec.priorities.length + (hasChecks ? CHECK_KEYS.length : 0);
  const done =
    rec.priorities.filter((p) => doneSet.has(p.text)).length +
    (hasChecks ? CHECK_KEYS.filter((k) => rec.checks[k]).length : 0);

  return (
    <View style={styles.group}>
      <GroupHeader
        title="This week"
        trailing={
          <T variant="subhead" tone="ink2" style={styles.tabular}>
            {`Week ${weekIndexInMonth(week)}${total ? `, ${done} of ${total} done` : ''}`}
          </T>
        }
      />
      <Animated.View layout={layoutMove} style={styles.card}>
        <View style={styles.clip}>
          <WeekItems week={week} date={date} interactive={!locked} padded />
        </View>
      </Animated.View>
    </View>
  );
}

/** Every active challenge, from every list there is, newest first. */
function useActiveChallenges(): ActiveChallenge[] {
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
  board: { gap: space.xl },
  hint: { textAlign: 'center' },
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
