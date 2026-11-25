import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { yearSuggestions } from '@/domain/chain';
import { formatFull } from '@/domain/dates';
import { misogiCandidates, misogiFor, sittingSteps, unsealDate, type SittingStep } from '@/domain/misogi';
import { misogiOf, NAMES } from '@/domain/names';
import { emptyYear } from '@/domain/types';
import { useToday } from '@/features/hooks';
import { commitNextMisogi, judgeMisogi } from '@/features/year/commit';
import { definingFrom, definingKey } from '@/features/year/defining';
import { SealedCard } from '@/features/year/sealed-card';
import { useJournal } from '@/state/journal';
import { recapSlides } from '@/domain/recap';
import { Stories } from '@/ui/stories';
import { Button, Segmented } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Screen, Section } from '@/ui/layout';
import { ModalHeader } from '@/ui/modal';
import { enterSoft } from '@/ui/motion';
import { StepHead } from '@/ui/steps';
import { SuggestPicker } from '@/ui/suggest-picker';
import { T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

type Step = SittingStep | 'end';

/**
 * The year review, from 25 December: one thing at a time.
 *   note      last year's sealed note, if its date has come (tap to play, never on its own)
 *   judge     last year's misogi: done, or not this time
 *   defining  the defining moment, from the month highlights, Kevin's Rules and incidents
 *   next      next year's misogi, from the bucket list or in your own words
 *   seal      an optional voice note to open next 25 December
 * and a quiet closing screen. Each answer is saved as you go; the review counts as done at the end.
 */
export default function YearReview() {
  const params = useLocalSearchParams<{ year: string }>();
  const y = typeof params.year === 'string' && /^\d{4}$/.test(params.year) ? params.year : '';
  const today = useToday();
  const years = useJournal((s) => s.years);
  const months = useJournal((s) => s.months);
  const days = useJournal((s) => s.days);
  const bucket = useJournal((s) => s.challenges.bucket);
  const rec = years[y] ?? emptyYear(y || '2000');
  const nextYear = String(Number(y) + 1);

  // The steps are fixed when the sitting opens, so answering one never moves the dots.
  const [steps] = useState<Step[]>(() => [...sittingSteps(years, y, today), 'end']);
  const [index, setIndex] = useState(0);
  // The year in a few cards first; the questions come after.
  const [recap, setRecap] = useState(true);
  const challenges = useJournal((s) => s.challenges);
  const slides = useMemo(
    () => recapSlides({ kind: 'year', year: y || '2000' }, { days, months, challenges, today }),
    [y, days, months, challenges, today],
  );
  const step = steps[index];

  const last = misogiFor(years, y);
  const lastNote = years[String(Number(y) - 1)]?.sealedNote ?? null;
  const [judged, setJudged] = useState<boolean | null>(last?.done ?? null);

  const suggestions = useMemo(() => yearSuggestions(y, months, days), [y, months, days]);
  const [defText, setDefText] = useState(rec.defining?.text ?? '');
  const [defKey, setDefKey] = useState<string | null>(definingKey(rec.defining, rec.definingFrom));

  const candidates = useMemo(
    () =>
      misogiCandidates(bucket).map((b) => ({
        key: `bucket:${b.id}`,
        text: b.title,
        sub: b.started ? 'Bucket list, active' : 'Bucket list, not started',
      })),
    [bucket],
  );
  const [misogiText, setMisogiText] = useState(rec.nextMisogi?.text ?? '');
  const [misogiPick, setMisogiPick] = useState<string | null>(rec.nextMisogi?.link?.id ?? null);

  if (!y) return null;

  if (recap && slides.length > 1) {
    return (
      <Stories slides={slides} doneLabel={`Review ${y}`} onDone={() => setRecap(false)} onClose={() => router.back()} />
    );
  }

  const real = steps.filter((s) => s !== 'end');
  const overline = `Review ${y}`;
  const go = () => setIndex((i) => Math.min(i + 1, steps.length - 1));

  const saveDefining = () => {
    const { defining, from } = definingFrom(defText, defKey, months, rec.defining?.date ?? null);
    if (!defining) return;
    useJournal.getState().updateYear(y, (r) => {
      r.defining = defining;
      r.definingFrom = from;
    });
    go();
  };

  const finish = () => {
    useJournal.getState().updateYear(y, (r) => {
      r.reviewed = true;
      r.reviewedOn = r.reviewedOn ?? today;
      r.skipped = null;
    });
    haptic.success();
    router.back();
  };

  let body: React.ReactNode = null;
  let footer: React.ReactNode = null;
  const head = (title: string, prompt?: string) => (
    <StepHead overline={overline} title={title} step={index + 1} total={real.length} prompt={prompt} />
  );

  if (step === 'note' && lastNote) {
    body = (
      <>
        {head('A note from last year', `You recorded this on 25 December ${Number(y) - 1}, for today.`)}
        <SealedCard year={String(Number(y) - 1)} note={lastNote} today={today} />
      </>
    );
    footer = <Button title="Next" onPress={go} />;
  } else if (step === 'judge' && last) {
    body = (
      <>
        {head(misogiOf(y), 'The challenge you set yourself a year ago.')}
        <Section>
          <T variant="journalTitle">{last.text}</T>
        </Section>
        <T variant="subhead" weight="600" tone="ink2">
          Did you do it?
        </T>
        <Segmented<'yes' | 'no' | 'unanswered'>
          options={[
            { value: 'yes', label: 'Done' },
            { value: 'no', label: 'Not this time' },
          ]}
          value={judged === false ? 'no' : judged === true ? 'yes' : 'unanswered'}
          onChange={(v) => setJudged(v === 'yes')}
        />
        {last.done === true && last.doneOn ? (
          <T variant="footnote" tone="ink2">{`You marked it done on ${formatFull(last.doneOn)}.`}</T>
        ) : null}
      </>
    );
    footer = (
      <Button
        title="Next"
        disabled={judged === null}
        onPress={async () => {
          if (judged === null) return;
          if (judged !== last.done) await judgeMisogi(y, judged, last.doneOn ?? undefined);
          go();
        }}
      />
    );
  } else if (step === 'defining') {
    body = (
      <>
        {head(NAMES.defining, `Which moment defined ${y}?`)}
        <SuggestPicker
          label="In a line"
          items={suggestions}
          value={defText}
          onChange={(t, from) => {
            setDefText(t);
            setDefKey(from?.key ?? null);
          }}
          placeholder="Something you achieved, or something that happened to you"
          heading={`From ${y}`}
          multiline
        />
        <T variant="footnote" tone="ink2">
          A date, notes and photos can be added to it later in Look back.
        </T>
      </>
    );
    footer = <Button title="Next" disabled={!defText.trim()} onPress={saveDefining} />;
  } else if (step === 'next') {
    body = (
      <>
        {head(misogiOf(nextYear), `One hard thing to do in ${nextYear}. Plan shows it all year.`)}
        <SuggestPicker
          label="The challenge"
          items={candidates}
          value={misogiText}
          onChange={(t, from) => {
            setMisogiText(t);
            setMisogiPick(from ? from.key.slice('bucket:'.length) : null);
          }}
          placeholder="Climb a 4,000 m peak"
          heading="From your bucket list"
          footer={
            !misogiPick && misogiText.trim() ? (
              <T variant="footnote" tone="ink2">
                It will be added to your bucket list.
              </T>
            ) : null
          }
        />
      </>
    );
    footer = (
      <View style={styles.footer}>
        <Button
          title="Next"
          disabled={!misogiText.trim()}
          onPress={async () => {
            await commitNextMisogi(y, misogiText, misogiPick);
            go();
          }}
        />
        <Button title="Not this year" kind="plain" onPress={go} />
      </View>
    );
  } else if (step === 'seal') {
    body = (
      <>
        {head(
          'Seal a note',
          `A voice note to yourself. It stays locked in the app until 25 December ${nextYear}, and opens your next review.`,
        )}
        {rec.sealedNote ? <SealedCard year={y} note={rec.sealedNote} today={today} editable /> : null}
      </>
    );
    footer = (
      <View style={styles.footer}>
        {rec.sealedNote ? (
          <Button title="Next" onPress={go} />
        ) : (
          <>
            <Button title="Record a note" icon="mic.fill" onPress={() => router.push(`/record/sealed-${y}`)} />
            <Button title="Skip" kind="plain" onPress={go} />
          </>
        )}
      </View>
    );
  } else {
    // The closing screen: the year in three lines, then Done. The end shapes the memory of the sitting.
    const saved = years[y] ?? rec;
    body = (
      <Animated.View entering={enterSoft} style={styles.end}>
        <T variant="pageTitle" accessibilityRole="header">
          {y}
        </T>
        <View style={styles.endLines}>
          {saved.defining ? <T variant="journalTitle">{saved.defining.text}</T> : null}
          {saved.nextMisogi ? (
            <View style={styles.gapXs}>
              <T variant="footnote" tone="ink2">
                {misogiOf(nextYear)}
              </T>
              <T variant="journalBody">{saved.nextMisogi.text}</T>
            </View>
          ) : null}
          {saved.sealedNote ? (
            <T variant="subhead" tone="ink2">{`Your note opens ${formatFull(unsealDate(y))}.`}</T>
          ) : null}
        </View>
      </Animated.View>
    );
    footer = <Button title="Done" onPress={finish} />;
  }

  return (
    <View style={styles.fill}>
      <ModalHeader
        title=""
        onClose={() => (index > 0 ? setIndex(index - 1) : router.back())}
        closeIcon={index > 0 ? 'chevron.left' : 'xmark'}
        fullScreen
      />
      <Screen footer={footer}>{body}</Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  footer: { gap: space.xs },
  gapXs: { gap: space.xs },
  end: { gap: space.xl, paddingTop: space.xxl },
  endLines: { gap: space.l },
});
