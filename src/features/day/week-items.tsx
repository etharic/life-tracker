import { useMemo, useState } from 'react';
import { ActionSheetIOS, StyleSheet, TextInput, View } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';

import { monthOfWeek, weekDates } from '@/domain/dates';
import { CHECK_KEYS, type ISODate, type WeekId } from '@/domain/types';
import { useMonth, useWeek } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { Chip } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { enterRow, exitSoft, layoutMove } from '@/ui/motion';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, radius, space, TARGET, type } from '@/ui/theme';

/** A small label over a run of capsules, in sentence case like every other label. */
export function SubLabel({ children }: { children: string }) {
  return (
    <T variant="footnote" weight="600" tone="ink2" accessibilityRole="header">
      {children}
    </T>
  );
}

/**
 * A week's commitments as one run of capsules: its priorities first, each starred, then the month's
 * three weekly checks, then a button to add a priority. Capsules flow side by side and wrap.
 * A week that is not the current one is shown as it was, without being changed.
 */
export function WeekItems({
  week,
  date,
  interactive,
  padded,
}: {
  week: WeekId;
  date: ISODate;
  interactive: boolean;
  /** Inside a card of its own: the run carries the card's padding. */
  padded?: boolean;
}) {
  const rec = useWeek(week);
  const setup = useMonth(monthOfWeek(week)).setup;
  const days = useJournal((s) => s.days);
  const { togglePriority, updateWeek } = useJournal.getState();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [starDraft, setStarDraft] = useState(false);
  const doneSet = useMemo(() => new Set(weekDates(week).flatMap((d) => days[d]?.prioritiesDone ?? [])), [days, week]);
  const items = rec.priorities;

  const add = () => {
    const text = draft.trim();
    if (text && !items.some((p) => p.text === text)) {
      updateWeek(week, (w) => void w.priorities.push({ text, done: false, ...(starDraft ? {} : { plain: true }) }));
      haptic.commit();
    }
    setDraft('');
    setStarDraft(false);
  };
  const setStar = (text: string, star: boolean) =>
    updateWeek(week, (w) => {
      const p = w.priorities.find((x) => x.text === text);
      if (!p) return;
      if (star) delete p.plain;
      else p.plain = true;
    });
  const menu = (text: string, star: boolean) =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: text,
        options: [star ? 'Not a priority' : 'Make it a priority', 'Remove from this week', 'Cancel'],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
      },
      (i) => {
        if (i === 0) {
          haptic.select();
          setStar(text, !star);
          return;
        }
        if (i !== 1) return;
        for (const d of weekDates(week)) {
          if (days[d]?.prioritiesDone.includes(text)) {
            useJournal
              .getState()
              .updateDay(d, (x) => void (x.prioritiesDone = x.prioritiesDone.filter((p) => p !== text)));
          }
        }
        updateWeek(week, (w) => void (w.priorities = w.priorities.filter((p) => p.text !== text)));
      },
    );

  const run = padded ? styles.runPadded : styles.run;
  if (!items.length && !setup && !interactive) return null;

  return (
    <View style={run}>
      <SubLabel>Commitments</SubLabel>
      <View style={styles.chips}>
        {/* The week's own commitments lead; a priority carries a star, like the priority goal. */}
        <LayoutAnimationConfig skipEntering>
          {items.map((p) => (
            <Animated.View key={p.text} entering={enterRow} exiting={exitSoft} layout={layoutMove}>
              <Chip
                label={p.text}
                wrap
                starred={!p.plain}
                starLabel="priority"
                selected={doneSet.has(p.text)}
                readOnly={!interactive}
                onPress={() => togglePriority(week, p.text, date)}
                onLongPress={() => menu(p.text, !p.plain)}
                accessibilityHint="Touch and hold to make it a priority or remove it"
              />
            </Animated.View>
          ))}
        </LayoutAnimationConfig>
        {setup
          ? CHECK_KEYS.map((k) => (
              <Chip
                key={k}
                label={setup.weeklyChecks[k]}
                wrap
                selected={rec.checks[k]}
                readOnly={!interactive}
                onPress={() => updateWeek(week, (w) => void (w.checks[k] = !w.checks[k]))}
              />
            ))
          : null}
        {interactive ? (
          adding ? (
            <View style={[styles.capsule, styles.inputCapsule]}>
              {/* The star decides, before the commitment is added, whether it is a priority. */}
              <Press
                onPress={() => setStarDraft((v) => !v)}
                hitSlop={8}
                accessibilityRole="switch"
                accessibilityState={{ checked: starDraft }}
                accessibilityLabel="Priority"
              >
                <Icon
                  name={starDraft ? 'star.fill' : 'star'}
                  size={17}
                  color={starDraft ? colors.accent : colors.ink3}
                />
              </Press>
              <TextInput
                autoFocus
                value={draft}
                onChangeText={setDraft}
                placeholder={starDraft ? 'A priority' : 'A commitment'}
                placeholderTextColor={colors.ink3}
                selectionColor={colors.accent}
                returnKeyType="done"
                submitBehavior="submit"
                onSubmitEditing={add}
                onBlur={() => {
                  add();
                  setAdding(false);
                }}
                style={styles.input}
                maxLength={80}
              />
            </View>
          ) : (
            <Press
              onPress={() => setAdding(true)}
              accessibilityLabel="Add a commitment"
              style={[styles.capsule, styles.addCapsule]}
            >
              <Icon name="plus" size={14} color={colors.accent} weight="bold" />
              <T variant="callout" weight="500" tone="accent" chrome>
                Commitment
              </T>
            </Press>
          )
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  run: { gap: space.s },
  runPadded: { gap: space.s, padding: space.l, paddingTop: space.m },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: TARGET,
    paddingHorizontal: space.m,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  addCapsule: { borderColor: colors.hairline, borderStyle: 'dashed', backgroundColor: colors.surface },
  inputCapsule: { borderColor: colors.accent, backgroundColor: colors.surface, minWidth: 180 },
  input: { ...type.callout, color: colors.ink, paddingVertical: space.xs, minWidth: 150 },
});
