import { useMemo, useState } from 'react';
import { ActionSheetIOS, StyleSheet, TextInput, View } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';

import { monthOfWeek, weekDates } from '@/domain/dates';
import { plusPlace } from '@/domain/lists';
import { CHECK_KEYS, type ISODate, type WeekId } from '@/domain/types';
import { useMonth, useWeek } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { AddButton, CheckRow } from '@/ui/controls';
import { Divider } from '@/ui/layout';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { enterRow, exitSoft, layoutMove } from '@/ui/motion';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, space, TARGET, type } from '@/ui/theme';

/** A small label over a list, in sentence case like every other label. */
export function SubLabel({ children }: { children: string }) {
  return (
    <T variant="footnote" weight="600" tone="ink2" accessibilityRole="header">
      {children}
    </T>
  );
}

/**
 * A week's commitments as one checklist: its own commitments first (priorities starred; touch and
 * hold for the menu), then the month's three weekly checks. A small + at the end of the last
 * line adds one.
 * A week that is not the current one is shown as it was, without being changed.
 */
export function WeekItems({
  week,
  date,
  interactive,
  padded,
  label = 'Commitments',
}: {
  week: WeekId;
  date: ISODate;
  interactive: boolean;
  /** Inside a card of its own: the run carries the card's padding. */
  padded?: boolean;
  /** The small title inside the card, over the list; null when a ribbon names it on its side. */
  label?: string | null;
}) {
  const rec = useWeek(week);
  const setup = useMonth(monthOfWeek(week)).setup;
  const days = useJournal((s) => s.days);
  const { togglePriority, updateWeek } = useJournal.getState();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [starDraft, setStarDraft] = useState(false);
  const [showDone, setShowDone] = useState(false);
  // Lines just ticked stay in place for a moment, so the tick is seen before the line folds away.
  const [lingering, setLingering] = useState<Set<string>>(() => new Set());
  const linger = (key: string) => {
    setLingering((s) => new Set(s).add(key));
    setTimeout(
      () =>
        setLingering((s) => {
          const n = new Set(s);
          n.delete(key);
          return n;
        }),
      1400,
    );
  };
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

  if (!items.length && !setup && !interactive) return null;

  const rows = [
    ...items.map((p) => ({
      key: `p:${p.text}`,
      label: p.text,
      checked: doneSet.has(p.text),
      star: !p.plain,
      toggle: () => togglePriority(week, p.text, date),
      menu: () => menu(p.text, !p.plain),
    })),
    ...(setup
      ? CHECK_KEYS.map((k) => ({
          key: `c:${k}`,
          label: setup.weeklyChecks[k],
          checked: rec.checks[k],
          star: false,
          toggle: () => updateWeek(week, (w) => void (w.checks[k] = !w.checks[k])),
          menu: undefined,
        }))
      : []),
  ];
  // A past week shows everything as it was; this week folds what is done unless asked to show it.
  const fold = interactive && !showDone;
  const shown = fold ? rows.filter((r) => !r.checked || lingering.has(r.key)) : rows;
  const folded = fold ? rows.filter((r) => r.checked && !lingering.has(r.key)) : [];
  // The "+" takes no line of its own: it sits at the end of the "n done" line, or of the last item.
  const plus = interactive && !adding ? <AddButton onPress={() => setAdding(true)} label="Add a commitment" /> : null;
  const place = plusPlace({ interactive, adding, shown: shown.length, folded: folded.length });

  return (
    <View style={padded ? styles.listPadded : styles.list}>
      {label ? (
        <View style={padded ? styles.labelPadded : undefined}>
          <SubLabel>{label}</SubLabel>
        </View>
      ) : null}
      {/*
        A checklist, as in Things: the box springs and ticks; a ticked line stays a moment, then
        folds into "n done" at the end, so the list shows only what is left this week. The week's
        own commitments lead, a priority starred; then the month's weekly checks.
      */}
      <LayoutAnimationConfig skipEntering>
        {shown.map((r, i) => (
          <Animated.View key={r.key} entering={enterRow} exiting={exitSoft} layout={layoutMove}>
            {i > 0 ? <Divider inset={INSET} /> : null}
            <View style={styles.line}>
              <View style={styles.flex}>
                <CheckRow
                  checked={r.checked}
                  label={r.label}
                  strike
                  readOnly={!interactive}
                  onToggle={() => {
                    if (!r.checked) linger(r.key);
                    r.toggle();
                  }}
                  onLongPress={interactive ? r.menu : undefined}
                  star={r.star}
                />
              </View>
              {place === 'last-item' && i === shown.length - 1 ? <View style={styles.plusEnd}>{plus}</View> : null}
            </View>
          </Animated.View>
        ))}
      </LayoutAnimationConfig>
      {folded.length ? (
        <>
          {shown.length ? <Divider inset={INSET} /> : null}
          <View style={styles.line}>
            <Press
              feedback="highlight"
              onPress={() => {
                haptic.select();
                setShowDone(true);
              }}
              accessibilityLabel={`Show ${folded.length} done`}
              containerStyle={styles.flex}
              style={styles.addRow}
            >
              <View style={styles.addIcon}>
                <Icon name="checkmark.circle.fill" size={18} color={colors.accent} />
              </View>
              <T variant="body" tone="ink2" style={styles.flex}>
                {`${folded.length} done`}
              </T>
            </Press>
            {place === 'done-line' ? <View style={styles.plusEnd}>{plus}</View> : null}
          </View>
        </>
      ) : null}
      {place === 'own-line' ? (
        <>
          {shown.length || folded.length ? <Divider inset={INSET} /> : null}
          {adding ? (
            <View style={styles.addRow}>
              {/* The star decides, before the commitment is added, whether it is a priority. */}
              <Press
                onPress={() => setStarDraft((v) => !v)}
                hitSlop={10}
                accessibilityRole="switch"
                accessibilityState={{ checked: starDraft }}
                accessibilityLabel="Priority"
                style={styles.addIcon}
              >
                <Icon
                  name={starDraft ? 'star.fill' : 'star'}
                  size={18}
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
              feedback="highlight"
              onPress={() => setAdding(true)}
              accessibilityLabel="Add a commitment"
              style={styles.addRow}
            >
              <View style={styles.addIcon}>
                <Icon name="plus" size={16} color={colors.accent} weight="semibold" />
              </View>
              <T variant="body" tone="accent">
                Add a commitment
              </T>
            </Press>
          )}
        </>
      ) : null}
    </View>
  );
}

/** Rows start where the text does, past the box: dividers line up with the words. */
const INSET = space.l + 26 + space.m;

const styles = StyleSheet.create({
  list: {},
  listPadded: { paddingVertical: space.xs },
  labelPadded: { paddingHorizontal: space.l, paddingTop: space.s },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    minHeight: TARGET + 8,
    paddingHorizontal: space.l,
  },
  addIcon: { width: 26, alignItems: 'center' },
  line: { flexDirection: 'row', alignItems: 'center' },
  plusEnd: { paddingRight: space.l, paddingLeft: space.xs },
  flex: { flex: 1 },
  input: { ...type.body, flex: 1, color: colors.ink, paddingVertical: space.s },
});
