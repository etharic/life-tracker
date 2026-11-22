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
  type ChallengeItem,
  type ChallengeKind,
} from '@/domain/types';
import { orderedGoals, orderedHobbies, useDay, useMonth, useStreaks, useWeek } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { CHALLENGE_COPY, CHALLENGE_ROUTE, ChallengeRow } from '@/features/past/challenges';
import { CheckRow, TextAction } from '@/ui/controls';
import { FeelingDots } from '@/ui/feelings';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { Divider } from '@/ui/layout';
import { enterRow, enterSoft, exitSoft, layoutMove } from '@/ui/motion';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, elevation, radius, space, TARGET, usePalette } from '@/ui/theme';
import { GroupHeader } from '@/ui/group';

import { AllDone } from './all-done';
import { MediaStrip } from './media';
import { WeekItems } from './week-items';

/**
 * The day, in three groups that follow how a day is lived:
 *   Journal    how the day felt, its one line, the writing and the photos: one entry card
 *   Today      the four goals and four hobbies, two pills that open their list
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

type ListKey = 'goals' | 'hobbies' | 'challenges';

/**
 * One pill per list: the open one is filled. The count is part of the pill, said once: done of four
 * for goals and hobbies, the number under way for challenges.
 */
function ListSwitch({
  value,
  onChange,
  options,
}: {
  value: string | null;
  onChange: (k: ListKey) => void;
  options: { key: ListKey; label: string; count: string; a11y: string }[];
}) {
  const p = usePalette();
  return (
    <View style={styles.switch} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Press
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on, expanded: on }}
            accessibilityLabel={`${o.label}, ${o.a11y}`}
            containerStyle={styles.pillCell}
            fill={{ backgroundColor: on ? p.ink : p.fill }}
            style={styles.pill}
          >
            <T
              variant="subhead"
              weight="600"
              chrome
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={{ color: on ? colors.bg : colors.ink }}
            >
              {o.label}
              <T
                variant="subhead"
                weight="400"
                chrome
                style={[styles.tabular, { color: on ? colors.bg : colors.ink2 }]}
              >
                {`  ${o.count}`}
              </T>
            </T>
          </Press>
        );
      })}
    </View>
  );
}

/**
 * Today's goals and hobbies: two pills, collapsed until one is tapped; its plain list of four opens
 * below and a second tap closes it. The priority goal and the skill hobby come first, starred.
 */
/** `locked`: a past day shown as it was; the lists still open, nothing can be ticked. */
export function TodayGroup({ date, locked }: { date: ISODate; locked?: boolean }) {
  const month = useMonth(monthOf(date));
  const day = useDay(date);
  const { current } = useStreaks();
  const setup = month.setup;
  const goalsDone = setup ? orderedGoals(setup).filter((c) => day.goals[c]).length : 0;
  const hobbiesDone = setup ? orderedHobbies(setup).filter((c) => day.hobbies[c]).length : 0;
  const [open, setOpen] = useState<ListKey | null>(null);
  const active = useActiveChallenges();
  // Simulator check only: `-LTOpen goals,hobbies,challenges` opens the lists one after another,
  // the way switching between them by hand does. Unused on a phone.
  useEffect(() => {
    const seq: unknown = Settings.get('LTOpen');
    if (typeof seq !== 'string' || locked) return;
    const keys = seq.split(',').filter((k): k is ListKey => ['goals', 'hobbies', 'challenges'].includes(k));
    const timers = keys.map((k, i) => setTimeout(() => setOpen(k), 1200 * (i + 1)));
    return () => timers.forEach(clearTimeout);
  }, [locked]);
  const [timing, setTiming] = useState<HobbyCategory | null>(null);
  if (!setup) return null;

  const rows =
    !open || open === 'challenges'
      ? []
      : open === 'goals'
        ? orderedGoals(setup).map((c) => ({
            c,
            text: setup.goals[c].text,
            checked: day.goals[c],
            caption: CATEGORY_LABEL[c],
            star: c === setup.priority,
            hobby: null,
            toggle: () => useJournal.getState().updateDay(date, (d) => void (d.goals[c] = !d.goals[c])),
          }))
        : orderedHobbies(setup).map((c) => ({
            c,
            text: setup.hobbies[c].text,
            checked: day.hobbies[c],
            caption: CATEGORY_LABEL[c],
            star: c === setup.skill,
            hobby: c,
            toggle: () =>
              useJournal.getState().updateDay(date, (d) => {
                d.hobbies[c] = !d.hobbies[c];
                delete d.hobbyHours[c];
              }),
          }));

  return (
    <View style={styles.group}>
      <ListSwitch
        value={open}
        onChange={(k) => {
          haptic.select();
          setOpen((o) => (o === k ? null : k));
        }}
        options={[
          { key: 'goals', label: 'Goals', count: fourCount(goalsDone), a11y: `${goalsDone} of 4 done` },
          { key: 'hobbies', label: 'Hobbies', count: fourCount(hobbiesDone), a11y: `${hobbiesDone} of 4 done` },
          // Challenges are not tied to a day: a past day shows only what that day had.
          ...(locked
            ? []
            : [
                {
                  key: 'challenges' as const,
                  label: 'Challenges',
                  count: String(active.length),
                  a11y: `${active.length} active`,
                },
              ]),
        ]}
      />
      {/*
        One container for whichever list is open: it fades in when a list opens and out when it
        closes. Switching lists changes what is inside, in place, so two containers never animate
        in and out at the same moment.
      */}
      {open ? (
        <Animated.View entering={enterSoft} exiting={exitSoft} layout={layoutMove} style={styles.bare}>
          <Animated.View key={open} entering={enterSoft}>
            {open === 'challenges' ? (
              <View>
                {active.length ? (
                  active.map(({ kind, item }, i) => (
                    <Animated.View key={`${kind}/${item.id}`} exiting={exitSoft} layout={layoutMove}>
                      {i > 0 ? <Divider inset={space.l + 26 + space.m} /> : null}
                      <ChallengeRow item={item} kind={kind} caption={CHALLENGE_COPY[kind].title} onPaper />
                    </Animated.View>
                  ))
                ) : (
                  <View style={styles.challengeEmpty}>
                    <T variant="subhead" tone="ink2">
                      Nothing under way. Tap the box in front of an item on a list to start it.
                    </T>
                    <View style={styles.challengeLinks}>
                      {CHALLENGE_KINDS.map((k) => (
                        <TextAction
                          key={k}
                          title={CHALLENGE_COPY[k].title}
                          onPress={() => router.push(CHALLENGE_ROUTE[k])}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View>
                {rows.map((r, i) => (
                  <View key={r.c}>
                    {i > 0 ? <Divider inset={space.l + 26 + space.m} /> : null}
                    <CheckRow
                      checked={r.checked}
                      label={r.text}
                      caption={r.caption}
                      onToggle={r.toggle}
                      readOnly={locked}
                      onPressRow={
                        r.hobby && !locked
                          ? () => {
                              haptic.select();
                              setTiming((t) => (t === r.hobby ? null : r.hobby));
                            }
                          : undefined
                      }
                      expanded={!!r.hobby && timing === r.hobby}
                      trailing={
                        <View style={styles.trail}>
                          {r.hobby && hobbyHours(day, r.hobby) > HOUR_PER_TICK ? (
                            <T variant="subhead" tone="ink2" style={styles.tabular}>
                              {formatHours(hobbyHours(day, r.hobby))}
                            </T>
                          ) : null}
                          {r.star ? <Icon name="star.fill" size={13} color={colors.accent} /> : null}
                        </View>
                      }
                    />
                    {r.hobby && !locked && timing === r.hobby ? <HoursRow date={date} category={r.hobby} /> : null}
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        </Animated.View>
      ) : null}
      <AllDone date={date} done={goalsDone === 4 && hobbiesDone === 4} streak={current} />
    </View>
  );
}

/**
 * Time on a hobby today, under its row: a tick is an hour; more can be added in half hours.
 * Down to nothing clears the tick.
 */
function HoursRow({ date, category }: { date: ISODate; category: HobbyCategory }) {
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
    <Animated.View entering={enterSoft} style={styles.hoursRow}>
      <T variant="subhead" tone="ink2" style={styles.flex}>
        Time today
      </T>
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
  const [picking, setPicking] = useState(false);
  const showDots = !locked && (!f || picking);
  const hasEntry = !!(day.title || day.writing || day.media.length);
  const write = () => router.push(`/close-day/${date}`);
  const setFeeling = (v: number | null) => {
    useJournal.getState().updateDay(date, (d) => void (d.feeling = v));
    if (v != null) setPicking(false);
  };

  return (
    <View style={styles.group}>
      {titled ? <GroupHeader title="Journal" /> : null}
      <Animated.View layout={layoutMove} style={styles.bare}>
        <View>
          {/* How the day felt: one colour, one name. The scale opens only to choose or change it. */}
          {f && !picking && locked ? (
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
              <T variant="subhead" tone="ink3">
                No feeling recorded
              </T>
            </View>
          ) : null}
          {f && !picking && !locked ? (
            <Press
              feedback="highlight"
              onPress={() => setPicking(true)}
              accessibilityLabel={`Felt ${f.score}, ${f.name}. Change`}
            >
              <View style={styles.feelingRow}>
                <View style={[styles.swatch, { backgroundColor: f.color }]} />
                <View style={styles.flex}>
                  <T variant="headline">{f.name}</T>
                  <T variant="footnote" tone="ink2">{`${f.score} of 10`}</T>
                </View>
                <T variant="subhead" weight="600" tone="accent">
                  Change
                </T>
              </View>
            </Press>
          ) : null}
          {showDots ? (
            <Animated.View entering={enterSoft} style={styles.feelingPick}>
              <T variant="subhead" tone="ink2">
                {isToday ? 'How does today feel?' : 'How did the day feel?'}
              </T>
              <FeelingDots value={day.feeling} onChange={setFeeling} />
              <View style={styles.ends}>
                <T variant="caption" tone="ink3">
                  Worst day ever
                </T>
                <T variant="caption" tone="ink3">
                  Best day ever
                </T>
              </View>
            </Animated.View>
          ) : null}
          <Divider />
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
                  <T variant="subhead" tone="ink3">
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

const fourCount = (n: number) => (n === 4 ? '✓' : `${n}/4`);

/** Every active challenge, from every list there is, newest first. */
function useActiveChallenges(): { kind: ChallengeKind; item: ChallengeItem }[] {
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
  challengeEmpty: { padding: space.l, gap: space.s },
  challengeLinks: { flexDirection: 'row', gap: space.l },
  tabular: { fontVariant: ['tabular-nums'] },
  group: { gap: space.m },
  switch: { flexDirection: 'row', gap: space.s },
  // Each pill takes the room its words need, and gives some back when the line is short.
  pillCell: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: space.m,
    borderRadius: radius.pill,
  },
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
  feelingPick: { gap: space.m, padding: space.l },
  ends: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -space.xs },
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
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingLeft: space.l + 26 + space.m,
    paddingRight: space.l,
    paddingBottom: space.m,
  },
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
