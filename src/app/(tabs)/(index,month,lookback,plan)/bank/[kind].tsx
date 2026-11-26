import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActionSheetIOS, StyleSheet, TextInput, View } from 'react-native';

import {
  CATEGORY_LABEL,
  GOAL_CATEGORIES,
  HOBBY_CATEGORIES,
  type BankEntry,
  type BankKind,
  type Category,
} from '@/domain/types';
import { useMonthsMap } from '@/features/hooks';
import { usageCounts, usageLabel } from '@/features/setup/usage';
import { useJournal } from '@/state/journal';
import { AddButton } from '@/ui/controls';
import { Icon } from '@/ui/icon';
import { Divider, Explainer, Screen, Section, SectionLabel } from '@/ui/layout';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, space, TARGET, type } from '@/ui/theme';

function entriesOf(bank: ReturnType<typeof useJournal.getState>['bank'], kind: BankKind, c: Category): BankEntry[] {
  return (bank[kind] as Record<string, BankEntry[]>)[c] ?? [];
}

function EditLine({
  initial,
  placeholder,
  onDone,
}: {
  initial: string;
  placeholder: string;
  onDone: (text: string) => void;
}) {
  const [text, setText] = useState(initial);
  return (
    <TextInput
      autoFocus
      value={text}
      onChangeText={setText}
      onSubmitEditing={() => onDone(text)}
      onBlur={() => onDone(text)}
      returnKeyType="done"
      placeholder={placeholder}
      placeholderTextColor={colors.ink3}
      selectionColor={colors.accent}
      maxLength={60}
      style={styles.input}
    />
  );
}

function CategoryBlock({
  kind,
  category,
  counts,
}: {
  kind: BankKind;
  category: Category;
  counts: Map<string, number>;
}) {
  const bank = useJournal((s) => s.bank);
  const all = entriesOf(bank, kind, category);
  const active = all.filter((e) => !e.retired);
  const retired = all.filter((e) => e.retired);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showRetired, setShowRetired] = useState(false);

  const update = (id: string, fn: (e: BankEntry) => void) =>
    useJournal.getState().updateBank((b) => {
      const e = entriesOf(b, kind, category).find((x) => x.id === id);
      if (e) fn(e);
    });

  const menu = (e: BankEntry) =>
    ActionSheetIOS.showActionSheetWithOptions(
      { title: e.text, options: ['Reword', e.retired ? 'Bring back' : 'Retire', 'Cancel'], cancelButtonIndex: 2 },
      (i) => {
        if (i === 0) setEditing(e.id);
        if (i === 1) update(e.id, (x) => void (x.retired = !x.retired));
      },
    );

  const row = (e: BankEntry) =>
    editing === e.id ? (
      <View key={e.id} style={styles.row}>
        <EditLine
          initial={e.text}
          placeholder="The idea"
          onDone={(t) => {
            setEditing(null);
            if (t.trim() && t.trim() !== e.text) update(e.id, (x) => void (x.text = t.trim()));
          }}
        />
      </View>
    ) : (
      <Press
        key={e.id}
        feedback="highlight"
        onPress={() => menu(e)}
        accessibilityLabel={`${e.text}, ${usageLabel(counts.get(e.id) ?? 0)}. Reword or retire`}
      >
        <View style={styles.row}>
          <View style={styles.flex}>
            <T variant="body" tone={e.retired ? 'ink2' : 'ink'}>
              {e.text}
            </T>
            <T variant="footnote" tone="ink2">
              {usageLabel(counts.get(e.id) ?? 0)}
            </T>
          </View>
          <Icon name="ellipsis" size={16} color={colors.ink3} />
        </View>
      </Press>
    );

  return (
    <View style={styles.block}>
      <SectionLabel>{CATEGORY_LABEL[category]}</SectionLabel>
      <Section flush>
        {active.map((e, i) => (
          <View key={e.id}>
            {i > 0 ? <Divider /> : null}
            {/* The + sits at the end of the last idea's line, not on a line of its own. */}
            {i === active.length - 1 && !adding ? (
              <View style={styles.line}>
                <View style={styles.flex}>{row(e)}</View>
                <View style={styles.plusEnd}>
                  <AddButton
                    onPress={() => setAdding(true)}
                    label={`Add a ${CATEGORY_LABEL[category].toLowerCase()} idea`}
                  />
                </View>
              </View>
            ) : (
              row(e)
            )}
          </View>
        ))}
        {active.length && adding ? <Divider /> : null}
        {adding ? (
          <View style={styles.row}>
            <EditLine
              initial=""
              placeholder={`A new ${CATEGORY_LABEL[category].toLowerCase()} idea`}
              onDone={(t) => {
                setAdding(false);
                if (t.trim()) useJournal.getState().addBankEntry(kind, category, t);
              }}
            />
          </View>
        ) : active.length ? null : (
          <View style={styles.row}>
            <T variant="body" tone="ink2" style={styles.flex}>
              No ideas yet
            </T>
            <AddButton onPress={() => setAdding(true)} label={`Add a ${CATEGORY_LABEL[category].toLowerCase()} idea`} />
          </View>
        )}
        {retired.length ? (
          <>
            <Divider />
            <Press
              feedback="highlight"
              onPress={() => setShowRetired((s) => !s)}
              accessibilityState={{ expanded: showRetired }}
            >
              <View style={styles.row}>
                <T variant="subhead" tone="ink2" style={styles.flex}>{`Retired (${retired.length})`}</T>
                <Icon
                  name={showRetired ? 'chevron.down' : 'chevron.right'}
                  size={13}
                  color={colors.ink3}
                  weight="semibold"
                />
              </View>
            </Press>
            {showRetired
              ? retired.map((e) => (
                  <View key={e.id}>
                    <Divider />
                    {row(e)}
                  </View>
                ))
              : null}
          </>
        ) : null}
      </Section>
    </View>
  );
}

export default function BankScreen() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const k: BankKind = kind === 'hobbies' ? 'hobbies' : 'goals';
  const months = useMonthsMap();
  const counts = useMemo(() => usageCounts(months), [months]);
  const cats: readonly Category[] = k === 'goals' ? GOAL_CATEGORIES : HOBBY_CATEGORIES;
  return (
    <Screen>
      <Stack.Screen options={{ title: k === 'goals' ? 'Goal ideas' : 'Hobby ideas', headerLargeTitleEnabled: true }} />
      <Explainer>Tap an idea to reword or retire it. Months keep the wording they used at the time.</Explainer>
      {cats.map((c) => (
        <CategoryBlock key={c} kind={k} category={c} counts={counts} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { gap: space.m },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.l,
    paddingVertical: space.s + 2,
    minHeight: TARGET + 8,
  },
  input: { ...type.body, flex: 1, color: colors.ink, minHeight: TARGET },
  line: { flexDirection: 'row', alignItems: 'center' },
  plusEnd: { paddingRight: space.l },
});
