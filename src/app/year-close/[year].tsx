import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { formatFull, formatShort, isISODate, monthShort, toISO } from '@/domain/dates';
import { feeling } from '@/domain/feelings';
import { emptyYear, type DefiningIncident, type ISODate } from '@/domain/types';
import { MediaStrip } from '@/features/day/media';
import { MediaEditor } from '@/features/day/media-editor';
import { useToday } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { Button, Field, Segmented, TextAction } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { Divider, Screen, ScreenHeader, Section } from '@/ui/layout';
import { ModalHeader } from '@/ui/modal';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, palette, space, TARGET } from '@/ui/theme';

type Tab = 'things' | 'incidents' | 'own';
type Mode = 'review' | 'edit' | 'view';

const toDate = (iso: ISODate) =>
  new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const fromDate = (d: Date) => toISO(d.getFullYear(), d.getMonth() + 1, d.getDate());

/**
 * A year's Misogi Ritual: what defined the year. Chosen from the year's Kevin's Rules or extreme
 * incidents, or written in your own words, with an optional date, notes, photos and voice notes.
 *   review  the 25 December card: record it, or confirm the one recorded during the year
 *   edit    from Look back, for the current year, at any time
 *   view    a past year, as it was recorded
 */
export default function MisogiRitual() {
  const params = useLocalSearchParams<{ year: string; mode?: string; date?: string }>();
  const y = typeof params.year === 'string' && /^\d{4}$/.test(params.year) ? params.year : '';
  const today = useToday();
  const scheme = useColorScheme();
  // Editing outside the review is for the current year only; any other year opens read-only.
  const mode: Mode =
    params.mode === 'edit' ? (y === today.slice(0, 4) ? 'edit' : 'view') : params.mode === 'view' ? 'view' : 'review';
  const months = useJournal((s) => s.months);
  const days = useJournal((s) => s.days);
  const rec = useJournal((s) => s.years[y]) ?? emptyYear(y);
  const current = rec.defining;
  const [tab, setTab] = useState<Tab>(
    current?.source === 'custom'
      ? 'own'
      : current?.source === 'extreme_thing'
        ? 'things'
        : current
          ? 'incidents'
          : 'own',
  );
  const [choice, setChoice] = useState<DefiningIncident | null>(current?.source === 'custom' ? null : current);
  const [own, setOwn] = useState(current?.source === 'custom' ? current.text : '');
  // Opened from Today's menu: achieved today, unless a date was already recorded.
  const asked = isISODate(params.date) && params.date.startsWith(`${y}-`) ? params.date : null;
  const [date, setDate] = useState<ISODate | null>(current?.date ?? asked);
  const [notes, setNotes] = useState(rec.notes);

  const list = useMemo(() => {
    const ms = Object.values(months)
      .filter((m) => m.month.startsWith(`${y}-`) && m.setup)
      .sort((a, b) => (a.month < b.month ? -1 : 1));
    return {
      things: ms.map((m) => ({
        key: m.month,
        month: m.month,
        date: null as string | null,
        text: m.setup!.extremeThing,
        color: null as string | null,
        sub: m.extremeDone === true ? 'done' : m.extremeDone === false ? 'not done' : '',
      })),
      incidents: ms
        .filter((m) => m.extremeIncident)
        .map((m) => ({
          key: m.month,
          month: m.month,
          date: m.extremeIncident!.date,
          text: m.extremeIncident!.title,
          color: feeling(days[m.extremeIncident!.date]?.feeling)?.color ?? null,
          sub: `${m.extremeIncident!.mark}, ${formatShort(m.extremeIncident!.date)}`,
        })),
    };
  }, [months, days, y]);

  if (!y) return null;

  if (mode === 'view') {
    return (
      <View style={styles.fill}>
        <ModalHeader title="" onClose={() => router.back()} />
        <Screen>
          <ScreenHeader overline={y} title="Misogi Ritual" />
          {current ? (
            <Section>
              <View style={styles.gap}>
                {current.date ? (
                  <T variant="footnote" tone="ink2">
                    {formatFull(current.date)}
                  </T>
                ) : null}
                <T variant="journalTitle">{current.text}</T>
                {rec.notes ? <T variant="journalBody">{rec.notes}</T> : null}
                <MediaStrip date={y} media={rec.media} />
              </View>
            </Section>
          ) : (
            <Section>
              <T variant="subhead" tone="ink2">
                {`No Misogi Ritual was recorded for ${y}.`}
              </T>
            </Section>
          )}
        </Screen>
      </View>
    );
  }

  const defining: DefiningIncident | null =
    tab === 'own'
      ? own.trim()
        ? { text: own.trim(), source: 'custom', month: null, date }
        : null
      : choice && choice.source === (tab === 'things' ? 'extreme_thing' : 'extreme_incident')
        ? { ...choice, date }
        : null;

  const save = () => {
    if (!defining) return;
    useJournal.getState().updateYear(y, (r) => {
      r.defining = defining;
      r.notes = notes.trim();
      if (mode === 'review') r.reviewed = true;
    });
    haptic.success();
    router.back();
  };

  const rows = tab === 'things' ? list.things : list.incidents;
  const first = `${y}-01-01`;
  const last = today < `${y}-12-31` ? today : `${y}-12-31`;
  const footer =
    mode === 'review' ? (current ? `Confirm ${y}’s Misogi Ritual` : `Save as ${y}’s Misogi Ritual`) : 'Save';

  return (
    <View style={styles.fill}>
      <ModalHeader title="" onClose={() => router.back()} />
      <Screen footer={<Button title={footer} onPress={save} disabled={!defining} />}>
        <ScreenHeader overline={mode === 'review' ? `Review ${y}` : y} title="Misogi Ritual" />
        <T variant="body">
          {mode === 'review' && current ? 'Is this still what defined your year?' : 'Which moment defined your year?'}
        </T>
        <Segmented
          options={[
            { value: 'own', label: 'Write my own' },
            { value: 'things', label: 'Kevin’s Rules' },
            { value: 'incidents', label: 'Incidents' },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === 'own' ? (
          <Section>
            <Field
              value={own}
              onChangeText={setOwn}
              multiline
              minHeight={90}
              placeholder="Something you achieved, or something that happened to you"
            />
          </Section>
        ) : rows.length ? (
          <Section flush>
            {rows.map((r, i) => {
              const source = tab === 'things' ? 'extreme_thing' : 'extreme_incident';
              const selected = choice?.source === source && choice.month === r.month;
              return (
                <View key={r.key}>
                  {i > 0 ? <Divider /> : null}
                  <Press
                    feedback="highlight"
                    onPress={() => {
                      haptic.select();
                      setChoice({ text: r.text, source, month: r.month, date: r.date });
                      if (r.date) setDate(r.date);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${monthShort(r.month)}: ${r.text}`}
                    style={selected ? styles.selected : undefined}
                  >
                    <View style={styles.row}>
                      <View style={[styles.bar, { backgroundColor: r.color ?? colors.track }]} />
                      <View style={styles.flex}>
                        <T variant="footnote" tone="ink2">
                          {[monthShort(r.month), r.sub].filter(Boolean).join(', ')}
                        </T>
                        <T variant="body" weight={selected ? '600' : '400'}>
                          {r.text}
                        </T>
                      </View>
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
              {tab === 'things'
                ? 'No Kevin’s Rules were set this year.'
                : 'No extreme incidents were chosen this year.'}
            </T>
          </Section>
        )}

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
                  maximumDate={toDate(last)}
                  accentColor={palette[scheme === 'dark' ? 'dark' : 'light'].accent}
                  onValueChange={(_, d) => setDate(fromDate(d))}
                />
                <TextAction title="Remove" tone="ink2" onPress={() => setDate(null)} />
              </>
            ) : (
              <TextAction title="Add a date" onPress={() => setDate(last)} />
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
  selected: { backgroundColor: colors.accentSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingRight: space.l, minHeight: TARGET + 14 },
  bar: { width: 4, alignSelf: 'stretch', marginVertical: space.s, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: TARGET },
});
