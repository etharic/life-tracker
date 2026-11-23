import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { addWeeks, formatLong, monthName, monthOfWeek, weekDates, weekIndexInMonth, weekMonday } from '@/domain/dates';
import type { Priority } from '@/domain/types';
import { useMonth, useWeek } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { Button, Field, TextAction } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { Divider, Screen, ScreenHeader } from '@/ui/layout';
import { ModalHeader } from '@/ui/modal';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, radius, space, TARGET, type } from '@/ui/theme';

/** A star that makes a commitment a priority, the same as on Today. */
function StarToggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <Press
      onPress={() => {
        haptic.select();
        onToggle();
      }}
      hitSlop={10}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${label}, priority`}
    >
      <Icon name={on ? 'star.fill' : 'star'} size={17} color={on ? colors.accent : colors.ink3} />
    </Press>
  );
}

/**
 * Monday: the outlook, last week's unfinished commitments (keep or drop), then this week's.
 * Everything sits on the page, one thin line between parts, as on Today.
 */
export default function StartWeek() {
  const { week } = useLocalSearchParams<{ week: string }>();
  const valid = typeof week === 'string' && /^\d{4}-W\d{2}$/.test(week);
  const w = valid ? week : '2000-W01';
  const prevWeek = addWeeks(w, -1);
  const month = useMonth(monthOfWeek(w));
  const rec = useWeek(w);
  const prev = useWeek(prevWeek);
  const days = useJournal((s) => s.days);

  const leftover = useMemo(() => {
    const done = new Set(weekDates(prevWeek).flatMap((d) => days[d]?.prioritiesDone ?? []));
    const here = new Set(rec.priorities.map((p) => p.text));
    return prev.priorities.filter((p) => !done.has(p.text) && !here.has(p.text));
  }, [prev, prevWeek, days, rec]);

  const [decisions, setDecisions] = useState<Record<string, 'keep' | 'drop'>>({});
  const [list, setList] = useState<Priority[]>(rec.priorities);
  const [draft, setDraft] = useState('');
  const [draftStar, setDraftStar] = useState(false);
  const [editingOutlook, setEditingOutlook] = useState(false);
  const [outlook, setOutlook] = useState(month.setup?.outlook ?? '');

  if (!valid) return null;

  const undecided = leftover.some((p) => !decisions[p.text]);
  const kept = leftover.filter((p) => decisions[p.text] === 'keep');
  const make = (text: string, star: boolean): Priority => ({ text, done: false, ...(star ? {} : { plain: true }) });

  const addDraft = () => {
    const text = draft.trim();
    if (text && !list.some((p) => p.text === text)) setList((l) => [...l, make(text, draftStar)]);
    setDraft('');
    setDraftStar(false);
  };
  const toggleStar = (text: string) => setList((l) => l.map((p) => (p.text === text ? make(p.text, !!p.plain) : p)));

  const start = () => {
    const text = draft.trim();
    const carried = kept.map((p) => ({ ...make(p.text, !p.plain), carried: true }));
    const all = [...carried, ...list, ...(text && !list.some((p) => p.text === text) ? [make(text, draftStar)] : [])];
    useJournal.getState().updateWeek(w, (x) => {
      x.priorities = all;
      x.started = true;
    });
    if (month.setup && outlook.trim() !== month.setup.outlook) {
      useJournal.getState().updateMonth(monthOfWeek(w), (m) => {
        if (m.setup) m.setup.outlook = outlook.trim();
      });
    }
    haptic.success();
    router.back();
  };

  return (
    <View style={styles.fill}>
      <ModalHeader title="" onClose={() => router.back()} />
      <Screen
        footer={
          <View style={styles.gapS}>
            {undecided ? (
              <T variant="footnote" tone="ink2" center>
                Keep or drop what is left over from last week first.
              </T>
            ) : null}
            <Button title="Start the week" onPress={start} disabled={undecided} />
          </View>
        }
      >
        <ScreenHeader overline={formatLong(weekMonday(w))} title={`Start week ${weekIndexInMonth(w)}`} />

        {month.setup ? (
          <View style={styles.part}>
            <View style={styles.labelRow}>
              <T variant="subhead" weight="600" tone="ink2" style={styles.flex} accessibilityRole="header">
                {`${monthName(monthOfWeek(w))} outlook`}
              </T>
              <TextAction title={editingOutlook ? 'Done' : 'Edit'} onPress={() => setEditingOutlook((e) => !e)} />
            </View>
            {editingOutlook ? (
              <Field value={outlook} onChangeText={setOutlook} multiline autoFocus minHeight={110} />
            ) : (
              <>
                <T variant="body" tone={outlook ? 'ink' : 'ink2'}>
                  {outlook || 'No outlook written yet.'}
                </T>
                <T variant="footnote" tone="ink2">
                  Update it if the month has changed.
                </T>
              </>
            )}
          </View>
        ) : null}

        {leftover.length ? (
          <>
            <Divider inset={0} />
            <View style={styles.part}>
              <T variant="subhead" weight="600" tone="ink2" accessibilityRole="header">
                {`Left over from last week: ${leftover.length}`}
              </T>
              <View style={styles.bare}>
                {leftover.map((p, i) => {
                  const d = decisions[p.text];
                  return (
                    <View key={p.text}>
                      {i > 0 ? <Divider /> : null}
                      <View style={styles.row}>
                        {p.plain ? null : <Icon name="star.fill" size={13} color={colors.accent} />}
                        <T variant="body" style={styles.flex} tone={d === 'drop' ? 'ink3' : 'ink'}>
                          {p.text}
                        </T>
                        <Press
                          onPress={() => {
                            haptic.select();
                            setDecisions((x) => ({ ...x, [p.text]: 'drop' }));
                          }}
                          style={[styles.choice, d === 'drop' && styles.choiceDrop]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: d === 'drop' }}
                          accessibilityLabel={`Drop ${p.text}`}
                        >
                          <T variant="subhead" weight="600" tone={d === 'drop' ? 'ink' : 'ink2'} chrome>
                            Drop
                          </T>
                        </Press>
                        <Press
                          onPress={() => {
                            haptic.select();
                            setDecisions((x) => ({ ...x, [p.text]: 'keep' }));
                          }}
                          style={[styles.choice, d === 'keep' && styles.choiceKeep]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: d === 'keep' }}
                          accessibilityLabel={`Keep ${p.text}`}
                        >
                          <T variant="subhead" weight="600" tone={d === 'keep' ? 'onAccent' : 'accent'} chrome>
                            Keep
                          </T>
                        </Press>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}

        <Divider inset={0} />
        <View style={styles.part}>
          <T variant="subhead" weight="600" tone="ink2" accessibilityRole="header">
            {"This week's commitments"}
          </T>
          <T variant="footnote" tone="ink2">
            Star the ones that are priorities.
          </T>
          <View style={styles.bare}>
            {kept.map((p) => (
              <View key={`k-${p.text}`}>
                <View style={styles.row}>
                  {p.plain ? (
                    <View style={styles.starSpace} />
                  ) : (
                    <Icon name="star.fill" size={17} color={colors.accent} />
                  )}
                  <T variant="body" style={styles.flex}>
                    {p.text}
                  </T>
                  <T variant="footnote" tone="ink2">
                    Kept
                  </T>
                </View>
                <Divider />
              </View>
            ))}
            {list.map((p) => (
              <View key={p.text}>
                <View style={styles.row}>
                  <StarToggle on={!p.plain} onToggle={() => toggleStar(p.text)} label={p.text} />
                  <T variant="body" style={styles.flex}>
                    {p.text}
                  </T>
                  <Press
                    onPress={() => setList((l) => l.filter((x) => x.text !== p.text))}
                    hitSlop={12}
                    accessibilityLabel={`Remove ${p.text}`}
                  >
                    <Icon name="xmark.circle.fill" size={18} color={colors.ink3} />
                  </Press>
                </View>
                <Divider />
              </View>
            ))}
            <View style={styles.row}>
              <StarToggle on={draftStar} onToggle={() => setDraftStar((v) => !v)} label="New commitment" />
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={addDraft}
                submitBehavior="submit"
                returnKeyType="done"
                placeholder={draftStar ? 'Add a priority' : 'Add a commitment'}
                placeholderTextColor={colors.ink3}
                selectionColor={colors.accent}
                style={styles.addInput}
                maxLength={80}
              />
            </View>
          </View>
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  gapS: { gap: space.s },
  part: { gap: space.s },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  // Rows reach out to the gutter so their text lines up with the labels above.
  bare: { marginHorizontal: -space.l },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.l,
    paddingVertical: space.s,
    minHeight: TARGET + 8,
  },
  starSpace: { width: 17 },
  choice: {
    minHeight: 34,
    paddingHorizontal: space.m,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceDrop: { backgroundColor: colors.fill },
  choiceKeep: { backgroundColor: colors.accent },
  addInput: { ...type.body, flex: 1, color: colors.ink, minHeight: TARGET },
});
