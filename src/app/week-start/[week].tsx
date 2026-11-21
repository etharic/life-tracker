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
import { Screen, ScreenHeader, Section } from '@/ui/layout';
import { ModalHeader } from '@/ui/modal';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, radius, space, TARGET, type } from '@/ui/theme';

/** Monday: the outlook, last week's unfinished priorities (keep or drop), then this week's. */
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
  const [editingOutlook, setEditingOutlook] = useState(false);
  const [outlook, setOutlook] = useState(month.setup?.outlook ?? '');

  if (!valid) return null;

  const undecided = leftover.some((p) => !decisions[p.text]);

  const addDraft = () => {
    const text = draft.trim();
    if (text && !list.some((p) => p.text === text)) setList((l) => [...l, { text, done: false }]);
    setDraft('');
  };

  const start = () => {
    const text = draft.trim();
    const kept = leftover
      .filter((p) => decisions[p.text] === 'keep')
      .map((p) => ({ text: p.text, done: false, carried: true }));
    const all = [...kept, ...list, ...(text && !list.some((p) => p.text === text) ? [{ text, done: false }] : [])];
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
          <Section
            title={`${monthName(monthOfWeek(w))} outlook`}
            action={
              <TextAction title={editingOutlook ? 'Done' : 'Edit'} onPress={() => setEditingOutlook((e) => !e)} />
            }
          >
            {editingOutlook ? (
              <Field value={outlook} onChangeText={setOutlook} multiline autoFocus minHeight={110} />
            ) : (
              <View style={styles.gapS}>
                <T variant="body" tone={outlook ? 'ink' : 'ink2'}>
                  {outlook || 'No outlook written yet.'}
                </T>
                <T variant="footnote" tone="ink2">
                  Update it if the month has changed.
                </T>
              </View>
            )}
          </Section>
        ) : null}

        {leftover.length ? (
          <Section title={`Left over from last week: ${leftover.length}`} flush>
            {leftover.map((p) => {
              const d = decisions[p.text];
              return (
                <View key={p.text} style={styles.leftRow}>
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
              );
            })}
          </Section>
        ) : null}

        <Section title="This week's priorities">
          <View style={styles.gapS}>
            {leftover
              .filter((p) => decisions[p.text] === 'keep')
              .map((p) => (
                <View key={`k-${p.text}`} style={styles.item}>
                  <T variant="body" style={styles.flex}>
                    {p.text}
                  </T>
                  <T variant="footnote" tone="ink2">
                    kept
                  </T>
                </View>
              ))}
            {list.map((p) => (
              <View key={p.text} style={styles.item}>
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
            ))}
            <View style={styles.addWrap}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={addDraft}
                submitBehavior="submit"
                returnKeyType="done"
                placeholder="Add priority"
                placeholderTextColor={colors.ink3}
                selectionColor={colors.accent}
                style={styles.addInput}
                maxLength={80}
              />
            </View>
          </View>
        </Section>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  gapS: { gap: space.s },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    paddingHorizontal: space.l,
    paddingVertical: space.s,
    minHeight: TARGET + 8,
  },
  choice: {
    minHeight: 34,
    paddingHorizontal: space.m,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceDrop: { backgroundColor: colors.fill },
  choiceKeep: { backgroundColor: colors.accent },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    minHeight: TARGET + 4,
    paddingHorizontal: space.l,
    backgroundColor: colors.fill,
    borderRadius: radius.control,
  },
  addWrap: {
    borderRadius: radius.control,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.boxBorder,
    paddingHorizontal: space.l,
  },
  addInput: { ...type.body, color: colors.ink, minHeight: TARGET + 4 },
});
