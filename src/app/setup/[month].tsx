import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { addMonths, monthName } from '@/domain/dates';
import {
  CATEGORY_LABEL,
  CHECK_KEYS,
  GOAL_CATEGORIES,
  HOBBY_CATEGORIES,
  kindOf,
  type Category,
  type Choice,
  type GoalCategory,
  type HobbyCategory,
  type MonthSetup,
} from '@/domain/types';
import { useDayLookup, useMonthsMap } from '@/features/hooks';
import { runHint, usageCounts, usageLabel } from '@/features/setup/usage';
import { useJournal } from '@/state/journal';
import { Button, Field, Segmented } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { Divider, Screen, Section } from '@/ui/layout';
import { ModalHeader } from '@/ui/modal';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, radius, space, TARGET, type } from '@/ui/theme';

type Draft = {
  goals: Partial<Record<GoalCategory, Choice>>;
  hobbies: Partial<Record<HobbyCategory, Choice>>;
  priority: GoalCategory | null;
  priorityKind: 'build' | 'break';
  skill: HobbyCategory | null;
  weeklyChecks: Record<(typeof CHECK_KEYS)[number], string>;
  outlook: string;
  extremeThing: string;
};

/** Pages: four goal pages, priority, four hobby pages, skill, checks, outlook, extreme thing. */
type Page =
  | { step: 1; kind: 'goal'; category: GoalCategory }
  | { step: 2; kind: 'priority' }
  | { step: 3; kind: 'hobby'; category: HobbyCategory }
  | { step: 4; kind: 'skill' }
  | { step: 5; kind: 'checks' }
  | { step: 6; kind: 'outlook' }
  | { step: 7; kind: 'extreme' };

const PAGES: Page[] = [
  ...GOAL_CATEGORIES.map((category) => ({ step: 1 as const, kind: 'goal' as const, category })),
  { step: 2, kind: 'priority' },
  ...HOBBY_CATEGORIES.map((category) => ({ step: 3 as const, kind: 'hobby' as const, category })),
  { step: 4, kind: 'skill' },
  { step: 5, kind: 'checks' },
  { step: 6, kind: 'outlook' },
  { step: 7, kind: 'extreme' },
];

const STEP_NAMES = ['Goals', 'Priority', 'Hobbies', 'Skill', 'Commitments', 'Outlook', 'Kevin’s Rule'];

function initialDraft(
  setup: MonthSetup | null,
  prev: MonthSetup | null,
  keep: { lineup: boolean; priority: boolean; skill: boolean },
): Draft {
  if (setup) return { ...setup };
  const base: Draft = {
    goals: {},
    hobbies: {},
    priority: null,
    priorityKind: 'build',
    skill: null,
    weeklyChecks: { check_1: '', check_2: '', check_3: '' },
    outlook: '',
    extremeThing: '',
  };
  if (!prev) return base;
  if (keep.lineup) {
    base.goals = { ...prev.goals };
    base.hobbies = { ...prev.hobbies };
    base.weeklyChecks = { ...prev.weeklyChecks };
  }
  if (keep.priority) {
    base.goals[prev.priority] = prev.goals[prev.priority];
    base.priority = prev.priority;
    base.priorityKind = prev.priorityKind;
  }
  // The skill carries over until you decide to move on.
  if (keep.skill) {
    base.hobbies[prev.skill] = prev.hobbies[prev.skill];
    base.skill = prev.skill;
  }
  return base;
}

function Dots({ step }: { step: number }) {
  return (
    <View style={styles.dots} accessibilityLabel={`Step ${step} of 7, ${STEP_NAMES[step - 1]}`}>
      {Array.from({ length: 7 }, (_, i) => (
        <View key={i} style={[styles.dot, i < step && styles.dotOn]} />
      ))}
      <T variant="footnote" tone="ink2" style={styles.dotsText}>{`Step ${step} of 7 · ${STEP_NAMES[step - 1]}`}</T>
    </View>
  );
}

function ChoiceList({
  category,
  value,
  onChange,
}: {
  category: Category;
  value: Choice | undefined;
  onChange: (c: Choice) => void;
}) {
  const kind = kindOf(category);
  const bank = useJournal((s) => s.bank);
  const months = useMonthsMap();
  const counts = useMemo(() => usageCounts(months), [months]);
  const entries = (bank[kind] as Record<string, { id: string; text: string; retired: boolean }[]>)[category].filter(
    (e) => !e.retired || e.id === value?.bankId,
  );
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const add = () => {
    const text = draft.trim();
    setDraft('');
    setAdding(false);
    if (!text) return;
    const e = useJournal.getState().addBankEntry(kind, category, text);
    onChange({ text: e.text, bankId: e.id });
  };

  return (
    <View style={styles.gap}>
      {entries.length ? (
        <Section flush>
          {entries.map((e, i) => {
            const selected = value?.bankId === e.id;
            return (
              <View key={e.id}>
                {i > 0 ? <Divider inset={space.l + 36} /> : null}
                <Press
                  feedback="highlight"
                  onPress={() => {
                    haptic.select();
                    onChange({ text: e.text, bankId: e.id });
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${e.text}, ${usageLabel(counts.get(e.id) ?? 0)}`}
                  style={selected ? styles.selectedRow : undefined}
                >
                  <View style={styles.choice}>
                    <View style={[styles.radio, selected && styles.radioOn]}>
                      {selected ? <View style={styles.radioDot} /> : null}
                    </View>
                    <View style={styles.flex}>
                      <T variant="body">{e.text}</T>
                      <T variant="footnote" tone="ink2">
                        {usageLabel(counts.get(e.id) ?? 0)}
                      </T>
                    </View>
                  </View>
                </Press>
              </View>
            );
          })}
        </Section>
      ) : (
        <T
          variant="subhead"
          tone="ink2"
        >{`Your bank has no ${CATEGORY_LABEL[category].toLowerCase()} ideas yet. Add the first one.`}</T>
      )}
      {adding ? (
        <View style={styles.newIdea}>
          <TextInput
            autoFocus
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            onBlur={add}
            returnKeyType="done"
            placeholder={`A new ${CATEGORY_LABEL[category].toLowerCase()} idea`}
            placeholderTextColor={colors.ink3}
            selectionColor={colors.accent}
            style={styles.newInput}
            maxLength={60}
          />
        </View>
      ) : (
        <Press
          onPress={() => setAdding(true)}
          style={styles.dashed}
          accessibilityLabel={`New ${CATEGORY_LABEL[category].toLowerCase()} idea`}
        >
          <Icon name="plus" size={15} color={colors.ink2} weight="semibold" />
          <T variant="body" weight="500" tone="ink2">{`New ${CATEGORY_LABEL[category].toLowerCase()} idea`}</T>
        </Press>
      )}
    </View>
  );
}

function StarCards<C extends Category>({
  categories,
  choices,
  value,
  onChange,
}: {
  categories: readonly C[];
  choices: Partial<Record<C, Choice>>;
  value: C | null;
  onChange: (c: C) => void;
}) {
  return (
    <View style={styles.gapS}>
      {categories.map((c) => {
        const selected = value === c;
        return (
          <Press
            key={c}
            onPress={() => {
              haptic.select();
              onChange(c);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${CATEGORY_LABEL[c]}: ${choices[c]?.text ?? ''}`}
            style={[styles.card, selected && styles.cardOn]}
          >
            <View style={styles.flex}>
              <T variant="overline" tone={selected ? 'accent' : 'ink2'}>
                {CATEGORY_LABEL[c]}
              </T>
              <T variant="headline">{choices[c]?.text ?? ''}</T>
            </View>
            <Icon name="star.fill" size={22} color={selected ? colors.accent : colors.track} />
          </Press>
        );
      })}
    </View>
  );
}

export default function SetupFlow() {
  const params = useLocalSearchParams<{ month: string }>();
  const month = typeof params.month === 'string' && /^\d{4}-\d{2}$/.test(params.month) ? params.month : '';
  const months = useMonthsMap();
  const lookup = useDayLookup();
  const rec = months.get(month);
  const prevRec = months.get(addMonths(month, -1));
  const [draft, setDraft] = useState<Draft>(() =>
    initialDraft(rec?.setup ?? null, prevRec?.setup ?? null, {
      lineup: prevRec?.close ? prevRec.close.keepLineup : true,
      priority: prevRec?.close ? prevRec.close.keepPriority : false,
      skill: prevRec?.close ? prevRec.close.keepSkill : true,
    }),
  );
  const [index, setIndex] = useState(0);
  const page = PAGES[index];
  const name = monthName(month);
  const editing = !!rec?.setup;

  const valid = (() => {
    switch (page.kind) {
      case 'goal':
        return !!draft.goals[page.category];
      case 'hobby':
        return !!draft.hobbies[page.category];
      case 'priority':
        return !!draft.priority;
      case 'skill':
        return !!draft.skill;
      case 'checks':
        return CHECK_KEYS.every((k) => draft.weeklyChecks[k].trim());
      case 'outlook':
        return true;
      case 'extreme':
        return !!draft.extremeThing.trim();
    }
  })();

  const finish = () => {
    const setup: MonthSetup = {
      goals: draft.goals as MonthSetup['goals'],
      hobbies: draft.hobbies as MonthSetup['hobbies'],
      priority: draft.priority!,
      priorityKind: draft.priorityKind,
      skill: draft.skill!,
      weeklyChecks: {
        check_1: draft.weeklyChecks.check_1.trim(),
        check_2: draft.weeklyChecks.check_2.trim(),
        check_3: draft.weeklyChecks.check_3.trim(),
      },
      outlook: draft.outlook.trim(),
      extremeThing: draft.extremeThing.trim(),
    };
    useJournal.getState().updateMonth(month, (m) => void (m.setup = setup));
    haptic.success();
    router.back();
  };

  const next = () => (index === PAGES.length - 1 ? finish() : setIndex(index + 1));

  let title = '';
  let prompt = '';
  let body: React.ReactNode = null;
  switch (page.kind) {
    case 'goal':
      title = `${CATEGORY_LABEL[page.category]} goal`;
      prompt = 'Pick one from your ideas, or add a new one.';
      body = (
        <ChoiceList
          category={page.category}
          value={draft.goals[page.category]}
          onChange={(c) => setDraft((d) => ({ ...d, goals: { ...d.goals, [page.category]: c } }))}
        />
      );
      break;
    case 'hobby':
      title = `${CATEGORY_LABEL[page.category]} hobby`;
      prompt = 'Pick one from your ideas, or add a new one.';
      body = (
        <ChoiceList
          category={page.category}
          value={draft.hobbies[page.category]}
          onChange={(c) => setDraft((d) => ({ ...d, hobbies: { ...d.hobbies, [page.category]: c } }))}
        />
      );
      break;
    case 'priority': {
      title = 'Your priority';
      prompt = 'Which goal matters most this month?';
      const p = draft.priority;
      const hint =
        p && draft.goals[p]
          ? runHint(months, 'priority', month, draft.goals[p]!.bankId, draft.goals[p]!.text, lookup)
          : null;
      body = (
        <View style={styles.gap}>
          <StarCards
            categories={GOAL_CATEGORIES}
            choices={draft.goals}
            value={p}
            onChange={(c) => setDraft((d) => ({ ...d, priority: c }))}
          />
          <T variant="subhead" weight="600" tone="ink2">
            Are you building it or breaking it?
          </T>
          <Segmented
            options={[
              { value: 'build', label: 'Build' },
              { value: 'break', label: 'Break' },
            ]}
            value={draft.priorityKind}
            onChange={(v) => setDraft((d) => ({ ...d, priorityKind: v }))}
          />
          {hint ? (
            <T variant="subhead" tone="ink2">
              {hint}
            </T>
          ) : null}
        </View>
      );
      break;
    }
    case 'skill': {
      title = 'Your skill';
      prompt = 'Which hobby are you building as a skill?';
      const s = draft.skill;
      const hint =
        s && draft.hobbies[s]
          ? runHint(months, 'skill', month, draft.hobbies[s]!.bankId, draft.hobbies[s]!.text, lookup)
          : null;
      body = (
        <View style={styles.gap}>
          <StarCards
            categories={HOBBY_CATEGORIES}
            choices={draft.hobbies}
            value={s}
            onChange={(c) => setDraft((d) => ({ ...d, skill: c }))}
          />
          <T variant="subhead" tone="ink2">
            A skill carries over until you decide to move on.
          </T>
          {hint ? (
            <Section>
              <T variant="subhead">{hint}</T>
            </Section>
          ) : null}
        </View>
      );
      break;
    }
    case 'checks':
      title = 'Other commitments';
      prompt = 'Three things to do once a week. Each gets one box per week.';
      body = (
        <View style={styles.gap}>
          {CHECK_KEYS.map((k, i) => (
            <Field
              key={k}
              label={`Check ${i + 1}`}
              value={draft.weeklyChecks[k]}
              onChangeText={(t) => setDraft((d) => ({ ...d, weeklyChecks: { ...d.weeklyChecks, [k]: t } }))}
              placeholder={['Travel somewhere', 'Read a novel', 'A memory activity'][i]}
              maxLength={60}
              returnKeyType="next"
            />
          ))}
        </View>
      );
      break;
    case 'outlook':
      title = 'Outlook';
      prompt = `What you want from ${name}, one per line. Tick each off on the Month page.`;
      body = (
        <Field
          value={draft.outlook}
          onChangeText={(t) => setDraft((d) => ({ ...d, outlook: t }))}
          multiline
          minHeight={180}
          placeholder={'Finish the valuation chapters\nLand two interviews\nKeep the 5 pm dinner rule'}
        />
      );
      break;
    case 'extreme':
      title = 'Kevin’s Rule';
      prompt = `The most extreme thing you will do in ${name}. At the end of the month the app asks if it was done.`;
      body = (
        <Field
          value={draft.extremeThing}
          onChangeText={(t) => setDraft((d) => ({ ...d, extremeThing: t }))}
          placeholder="Run 10 km without stopping"
          maxLength={80}
          returnKeyType="done"
        />
      );
      break;
  }

  if (!month) return null;

  return (
    <View style={styles.fill}>
      <ModalHeader
        title={editing ? `Edit ${name}` : `Set up ${name}`}
        onClose={() => router.back()}
        closeIcon="xmark"
        fullScreen
      />
      <Screen
        footer={
          <View style={styles.footer}>
            {index > 0 ? (
              <View style={styles.back}>
                <Button title="Back" kind="secondary" onPress={() => setIndex(index - 1)} />
              </View>
            ) : null}
            <View style={styles.flex}>
              <Button
                title={index === PAGES.length - 1 ? (editing ? 'Save changes' : `Start ${name}`) : 'Next'}
                onPress={next}
                disabled={!valid}
              />
            </View>
          </View>
        }
      >
        <View style={styles.head}>
          <T variant="largeTitle" accessibilityRole="header">
            {title}
          </T>
          <Dots step={page.step} />
          <T variant="body" style={styles.prompt}>
            {prompt}
          </T>
        </View>
        {body}
        {page.kind === 'goal' || page.kind === 'hobby' ? (
          <T variant="footnote" tone="ink2" center>
            New ideas are saved to your bank for later months.
          </T>
        ) : null}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  gap: { gap: space.l },
  gapS: { gap: space.s },
  head: { gap: space.s, marginBottom: space.xs },
  prompt: { marginTop: space.s },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.track },
  dotOn: { backgroundColor: colors.accent },
  dotsText: { marginLeft: space.s },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.l,
    paddingVertical: space.m,
    minHeight: TARGET + 12,
  },
  selectedRow: { backgroundColor: colors.accentSoft },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.boxBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
  dashed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s,
    minHeight: TARGET + 10,
    borderRadius: radius.section,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.boxBorder,
  },
  newIdea: {
    backgroundColor: colors.surface,
    borderRadius: radius.section,
    borderWidth: 1.5,
    borderColor: colors.accent,
    paddingHorizontal: space.l,
  },
  newInput: { ...type.body, color: colors.ink, minHeight: TARGET + 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    padding: space.l,
    borderRadius: radius.section,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  cardOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  footer: { flexDirection: 'row', gap: space.s },
  back: { width: 110 },
});
