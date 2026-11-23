import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { yearSuggestions } from '@/domain/chain';
import { isISODate, toISO } from '@/domain/dates';
import { NAMES } from '@/domain/names';
import { emptyYear, type ISODate } from '@/domain/types';
import { MediaEditor } from '@/features/day/media-editor';
import { useToday } from '@/features/hooks';
import { definingFrom, definingKey } from '@/features/year/defining';
import { useJournal } from '@/state/journal';
import { Button, Field, TextAction } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Screen, ScreenHeader, Section } from '@/ui/layout';
import { ModalHeader } from '@/ui/modal';
import { SuggestPicker } from '@/ui/suggest-picker';
import { T } from '@/ui/text';
import { colors, palette, space, TARGET } from '@/ui/theme';

const toDate = (iso: ISODate) =>
  new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const fromDate = (d: Date) => toISO(d.getFullYear(), d.getMonth() + 1, d.getDate());

/**
 * A year's defining moment, edited at any time: from the year's month highlights, Kevin's Rules
 * and extreme incidents, or in your own words, with an optional date, notes, photos and voice
 * notes. The review itself (from 25 December) is /year-review; a year's page is /year.
 *   ?date=YYYY-MM-DD  opened from Today's menu: it happened today
 */
export default function DefiningMoment() {
  const params = useLocalSearchParams<{ year: string; mode?: string; date?: string }>();
  const y = typeof params.year === 'string' && /^\d{4}$/.test(params.year) ? params.year : '';
  const today = useToday();
  const scheme = useColorScheme();
  const months = useJournal((s) => s.months);
  const days = useJournal((s) => s.days);
  const rec = useJournal((s) => s.years[y]) ?? emptyYear(y);
  const items = useMemo(() => yearSuggestions(y, months, days), [y, months, days]);
  const [text, setText] = useState(rec.defining?.text ?? '');
  const [key, setKey] = useState<string | null>(definingKey(rec.defining, rec.definingFrom));
  const asked = isISODate(params.date) && params.date.startsWith(`${y}-`) ? params.date : null;
  const [date, setDate] = useState<ISODate | null>(rec.defining?.date ?? asked);
  const [notes, setNotes] = useState(rec.notes);

  if (!y) return null;
  if (params.mode === 'view') return <Redirect href={`/year/${y}`} />;
  if (params.mode !== 'edit') return <Redirect href={`/year-review/${y}`} />;

  const save = () => {
    const { defining, from } = definingFrom(text, key, months, date);
    if (!defining) return;
    useJournal.getState().updateYear(y, (r) => {
      r.defining = defining;
      r.definingFrom = from;
      r.notes = notes.trim();
    });
    haptic.success();
    router.back();
  };

  const first = `${y}-01-01`;
  const last = today < `${y}-12-31` ? today : `${y}-12-31`;

  return (
    <View style={styles.fill}>
      <ModalHeader title="" onClose={() => router.back()} />
      <Screen footer={<Button title="Save" onPress={save} disabled={!text.trim()} />}>
        <ScreenHeader overline={y} title={NAMES.defining} />
        <SuggestPicker
          label={`Which moment defined ${y}?`}
          items={items}
          value={text}
          onChange={(t, from) => {
            setText(t);
            setKey(from?.key ?? null);
          }}
          placeholder="Something you achieved, or something that happened to you"
          heading={`From ${y}`}
          multiline
        />

        <Section>
          <View style={styles.dateRow}>
            <T variant="body" style={styles.flex}>
              Date
            </T>
            {date ? (
              <>
                <DateTimePicker
                  value={toDate(date)}
                  mode="date"
                  display="compact"
                  minimumDate={toDate(first)}
                  maximumDate={toDate(last < first ? first : last)}
                  accentColor={palette[scheme === 'dark' ? 'dark' : 'light'].accent}
                  onValueChange={(_, d) => setDate(fromDate(d))}
                />
                <TextAction title="Remove" tone="ink2" onPress={() => setDate(null)} />
              </>
            ) : (
              <TextAction title="Add a date" onPress={() => setDate(last < first ? first : last)} />
            )}
          </View>
        </Section>

        <Section>
          <View style={styles.gap}>
            <Field
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              multiline
              minHeight={120}
              placeholder="What happened, and why it defined the year."
              autoCapitalize="sentences"
            />
            <MediaEditor owner={y} media={rec.media} />
          </View>
        </Section>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  gap: { gap: space.m },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: TARGET },
});
