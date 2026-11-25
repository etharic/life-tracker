import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { newAchievements, runEndingAt, slotOf, tickedInMonth } from '@/domain/achievements';
import { addDays, addMonths, daysInMonth, dayNumber, lastOfMonth, monthDates, monthName } from '@/domain/dates';
import { chainSource, monthSuggestions } from '@/domain/chain';
import { feeling } from '@/domain/feelings';
import { outcomeQuestion } from '@/domain/misogi';
import { NAMES } from '@/domain/names';
import type { ExtremeIncident, MonthId } from '@/domain/types';
import { AchievementBanner } from '@/features/achievements';
import { askList } from '@/features/list-question';
import { useDayLookup, useMonth, useMonthsMap, useToday } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { recapSlides } from '@/domain/recap';
import { Stories } from '@/ui/stories';
import { Button, Segmented } from '@/ui/controls';
import { StepHead } from '@/ui/steps';
import { SuggestPicker } from '@/ui/suggest-picker';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { Divider, Empty, Screen, Section } from '@/ui/layout';
import { ModalHeader } from '@/ui/modal';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, space, TARGET } from '@/ui/theme';

function KeepCard({
  label,
  title,
  detail,
  keep,
  onChange,
  changeLabel,
}: {
  label: string;
  title: string;
  detail: string;
  keep: boolean;
  onChange: (k: boolean) => void;
  changeLabel: string;
}) {
  return (
    <Section>
      <View style={styles.gapS}>
        <T variant="overline" tone="ink2">
          {label}
        </T>
        <T variant="headline">{title}</T>
        <T variant="subhead" tone="ink2">
          {detail}
        </T>
        <View style={styles.seg}>
          <Segmented
            options={[
              { value: 'keep', label: 'Keep' },
              { value: 'change', label: changeLabel },
            ]}
            value={keep ? 'keep' : 'change'}
            onChange={(v) => onChange(v === 'keep')}
          />
        </View>
      </View>
    </Section>
  );
}

export default function CloseMonth() {
  const params = useLocalSearchParams<{ month: string }>();
  const month: MonthId = typeof params.month === 'string' && /^\d{4}-\d{2}$/.test(params.month) ? params.month : '';
  const rec = useMonth(month || '2000-01');
  const months = useMonthsMap();
  const lookup = useDayLookup();
  const today = useToday();
  const existing = useJournal((s) => s.achievements);
  const next = addMonths(month || '2000-01', 1);
  const name = monthName(month || '2000-01');

  const [step, setStep] = useState(1);
  // The month in a few cards first; the questions come after.
  const [recap, setRecap] = useState(true);
  const challenges = useJournal((s) => s.challenges);
  const allDays = useJournal((s) => s.days);
  const allMonths = useJournal((s) => s.months);
  const slides = useMemo(
    () =>
      recapSlides(
        { kind: 'month', month: month || '2000-01' },
        { days: allDays, months: allMonths, challenges, today },
      ),
    [month, allDays, allMonths, challenges, today],
  );
  const [extremeDone, setExtremeDone] = useState<boolean | null>(rec.extremeDone);
  const [incident, setIncident] = useState<ExtremeIncident | null>(rec.extremeIncident);
  const [highlight, setHighlight] = useState(rec.highlight);
  const [fromWeek, setFromWeek] = useState<string | null>(rec.highlightFromWeek);
  const weekItems = useMemo(() => monthSuggestions(month || '2000-01', rec), [month, rec]);
  const [keepPriority, setKeepPriority] = useState(true);
  const [keepSkill, setKeepSkill] = useState(true);
  const [keepLineup, setKeepLineup] = useState(true);

  const titled = useMemo(
    () =>
      monthDates(month || '2000-01')
        .map((d) => lookup(d))
        .filter((d): d is NonNullable<typeof d> => !!d && d.title.trim() !== '')
        .reverse(),
    [lookup, month],
  );

  // Achievements this month would earn once closed (shown before saving, written on finish).
  const earned = useMemo(() => {
    if (!month) return [];
    const closed = new Map(months);
    const r = closed.get(month);
    if (r) closed.set(month, { ...r, close: { closedOn: today, keepPriority, keepSkill, keepLineup } });
    return newAchievements(closed, lookup, addDays(lastOfMonth(month), 1), existing).filter(
      (a) => a.months[a.months.length - 1] === month,
    );
  }, [months, month, lookup, existing, today, keepPriority, keepSkill, keepLineup]);

  if (!month || !rec.setup) {
    return (
      <View style={styles.fill}>
        <ModalHeader title="" onClose={() => router.back()} fullScreen />
        <Empty title="This month has no setup to close" />
      </View>
    );
  }
  const setup = rec.setup;

  const runInfo = (kind: 'priority' | 'skill') => {
    const run = runEndingAt(months, kind, month);
    const slot = slotOf(rec, kind)!;
    const pct = Math.round((tickedInMonth(slot, lookup) / daysInMonth(month)) * 100);
    return `${run.length} ${run.length === 1 ? 'month' : 'months'} in a row, ${pct}% this month`;
  };

  const finish = (thenSetup: boolean) => {
    useJournal.getState().updateMonth(month, (m) => {
      m.extremeDone = extremeDone;
      if (extremeDone !== true) m.extremeDoneOn = null;
      m.extremeIncident = incident;
      m.highlight = highlight.trim();
      // The week it came from, kept only while the text still equals that week's highlight.
      m.highlightFromWeek =
        fromWeek && highlight.trim() && m.weeks[fromWeek]?.highlight.trim() === highlight.trim() ? fromWeek : null;
      m.close = { closedOn: today, keepPriority, keepSkill, keepLineup };
    });
    useJournal.getState().checkAchievements();
    haptic.success();
    if (thenSetup && !months.get(next)?.setup) router.replace(`/setup/${next}`);
    else router.back();
  };

  const overline = `Close ${name}`;
  let body: React.ReactNode;
  let footer: React.ReactNode;

  if (step === 1) {
    body = (
      <>
        <StepHead
          overline={overline}
          title={NAMES.kevin}
          step={1}
          total={TOTAL}
          prompt="The most extreme thing you planned for the month."
        />
        <Section>
          <T variant="title3">{setup.extremeThing}</T>
        </Section>
        <T variant="subhead" weight="600" tone="ink2">
          Did you do it?
        </T>
        <Segmented
          options={[
            { value: 'yes', label: 'Done' },
            { value: 'no', label: 'Not this time' },
          ]}
          value={extremeDone === false ? 'no' : 'yes'}
          onChange={(v) => setExtremeDone(v === 'yes')}
        />
      </>
    );
    footer = (
      <Button
        title="Next"
        onPress={async () => {
          const done = extremeDone ?? true;
          if (extremeDone === null) setExtremeDone(true);
          // Kevin's Rule from a list: one tap updates the list item, asked once per judgement.
          const link = rec.kevinLink;
          if (link) {
            const changed = rec.extremeDone !== done;
            if (changed)
              useJournal.getState().updateMonth(month, (m) => {
                m.extremeDone = done;
                if (m.kevinLink) m.kevinLink.outcomeConfirmed = null;
              });
            const item = challenges[link.kind].find((x) => x.id === link.id);
            const q = outcomeQuestion(changed ? { ...link, outcomeConfirmed: null } : link, item, done);
            if (q) {
              const a = await askList(q);
              if (a) useJournal.getState().answerList({ month }, 'outcome', a);
            }
          }
          setStep(2);
        }}
      />
    );
  } else if (step === 2) {
    body = (
      <>
        <StepHead
          overline={overline}
          title="Highlight of the month"
          step={2}
          total={TOTAL}
          prompt="The best of the month, in a line. The most extreme day comes next: a different question."
        />
        <SuggestPicker
          label="Highlight"
          items={weekItems}
          value={highlight}
          onChange={(t, from) => {
            setHighlight(t);
            setFromWeek(chainSource(from?.key)?.ref ?? null);
          }}
          placeholder="Moved into the new flat"
          heading="Or use one of the week highlights"
        />
      </>
    );
    footer = <Button title="Next" onPress={() => setStep(3)} />;
  } else if (step === 3) {
    body = (
      <>
        <StepHead
          overline={overline}
          title="Extreme incident"
          step={3}
          total={TOTAL}
          prompt="Which day will you remember for a long time?"
        />
        {titled.length ? (
          <Section flush>
            {titled.map((d, i) => {
              const f = feeling(d.feeling);
              const selected = incident?.date === d.date;
              return (
                <View key={d.date}>
                  {i > 0 ? <Divider /> : null}
                  <Press
                    feedback="highlight"
                    onPress={() => {
                      haptic.select();
                      setIncident({ date: d.date, title: d.title, mark: incident?.mark ?? 'positive' });
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${dayNumber(d.date)}: ${d.title}`}
                    style={selected ? styles.selected : undefined}
                  >
                    <View style={styles.titleRow}>
                      <View style={[styles.bar, f ? { backgroundColor: f.color } : styles.barEmpty]} />
                      <T variant="headline" style={styles.dayNo}>
                        {dayNumber(d.date)}
                      </T>
                      <T variant="body" weight={selected ? '600' : '400'} style={styles.flex} numberOfLines={2}>
                        {d.title}
                      </T>
                      {selected ? <Icon name="checkmark.circle.fill" size={22} color={colors.accent} /> : null}
                    </View>
                  </Press>
                </View>
              );
            })}
          </Section>
        ) : (
          <Section>
            <T variant="subhead" tone="ink2">
              No day has a title this month, so there is nothing to choose from.
            </T>
          </Section>
        )}
        {incident ? (
          <>
            <T variant="subhead" weight="600" tone="ink2">
              This day was
            </T>
            <Segmented
              options={[
                { value: 'positive', label: 'Positive' },
                { value: 'negative', label: 'Negative' },
              ]}
              value={incident.mark}
              onChange={(v) => setIncident({ ...incident, mark: v })}
            />
          </>
        ) : null}
      </>
    );
    footer = <Button title="Save and continue" onPress={() => setStep(4)} />;
  } else if (step === 4) {
    body = (
      <>
        <StepHead overline={overline} title="Achievements" step={4} total={TOTAL} />
        {earned.length ? (
          earned.map((a) => <AchievementBanner key={`${a.kind}-${a.bankId}`} a={a} fresh />)
        ) : (
          <Section>
            <View style={styles.gapS}>
              <T variant="body">No new achievement this month.</T>
              <T variant="subhead" tone="ink2">
                An achievement comes after three months in a row with the same priority goal or skill, on more than 80%
                of the days.
              </T>
            </View>
          </Section>
        )}
      </>
    );
    footer = <Button title="Next" onPress={() => setStep(5)} />;
  } else if (step === 5) {
    body = (
      <>
        <StepHead overline={overline} title={`Before ${monthName(next)}`} step={5} total={TOTAL} />
        <KeepCard
          label={`Priority goal, to ${setup.priorityKind === 'build' ? 'build' : 'break'}`}
          title={setup.goals[setup.priority].text}
          detail={runInfo('priority')}
          keep={keepPriority}
          onChange={setKeepPriority}
          changeLabel="Change"
        />
        <KeepCard
          label="Skill hobby"
          title={setup.hobbies[setup.skill].text}
          detail={runInfo('skill')}
          keep={keepSkill}
          onChange={setKeepSkill}
          changeLabel="Move on"
        />
        <T variant="footnote" tone="ink2" center>{`Keeping carries both into ${monthName(next)}’s setup.`}</T>
      </>
    );
    footer = <Button title="Next" onPress={() => setStep(6)} />;
  } else {
    body = (
      <>
        <StepHead
          overline={overline}
          title="Goals and hobbies"
          step={6}
          total={TOTAL}
          prompt={`Start ${monthName(next)} with the same goals, hobbies and commitments, or choose again?`}
        />
        <Section>
          <View style={styles.gapS}>
            {Object.values(setup.goals).map((c) => (
              <T key={c.bankId} variant="body">
                {c.text}
              </T>
            ))}
            <Divider inset={0} />
            {Object.values(setup.hobbies).map((c) => (
              <T key={c.bankId} variant="body">
                {c.text}
              </T>
            ))}
          </View>
        </Section>
        <Segmented
          options={[
            { value: 'keep', label: 'Keep them' },
            { value: 'change', label: 'Choose again' },
          ]}
          value={keepLineup ? 'keep' : 'change'}
          onChange={(v) => setKeepLineup(v === 'keep')}
        />
      </>
    );
    footer = (
      <View style={styles.gapS}>
        <Button
          title={months.get(next)?.setup ? 'Close the month' : `Continue to ${monthName(next)} setup`}
          onPress={() => finish(true)}
        />
      </View>
    );
  }

  if (recap && slides.length > 1) {
    return (
      <Stories
        slides={slides}
        doneLabel={`Close ${name}`}
        onDone={() => setRecap(false)}
        onClose={() => router.back()}
      />
    );
  }

  return (
    <View style={styles.fill}>
      <ModalHeader
        title=""
        onClose={() => (step > 1 ? setStep(step - 1) : router.back())}
        closeIcon={step > 1 ? 'chevron.left' : 'xmark'}
        fullScreen
      />
      <Screen footer={footer}>{body}</Screen>
    </View>
  );
}

const TOTAL = 6;

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  gapS: { gap: space.s },
  selected: { backgroundColor: colors.accentSoft },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingRight: space.l, minHeight: TARGET + 10 },
  bar: { width: 4, alignSelf: 'stretch', marginVertical: space.s, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  barEmpty: { backgroundColor: colors.track },
  dayNo: { width: 28, fontVariant: ['tabular-nums'] },
  seg: { marginTop: space.s },
});
