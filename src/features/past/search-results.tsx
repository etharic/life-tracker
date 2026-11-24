import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatWeekRange, monthName } from '@/domain/dates';
import { NAMES } from '@/domain/names';
import { buildIndex, searchIndex, type SearchHit } from '@/domain/search';
import type { MonthId, WeekId } from '@/domain/types';
import { useJournal } from '@/state/journal';
import { Divider, Section } from '@/ui/layout';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

import { EntryRow, Marked } from './entry-row';

function whereOf(hit: SearchHit): string {
  const { kind, ref } = hit.doc;
  switch (kind) {
    case 'week':
      return `Week highlight, ${formatWeekRange(ref as WeekId)}`;
    case 'month':
      return `Month highlight, ${monthName(ref as MonthId)} ${ref.slice(0, 4)}`;
    case 'defining':
      return `${NAMES.defining}, ${ref}`;
    case 'misogi':
      return `${NAMES.misogi}, ${ref}`;
    default:
      return '';
  }
}

function OtherRow({ hit }: { hit: SearchHit }) {
  const where = whereOf(hit);
  return (
    <Press
      feedback="highlight"
      onPress={() => router.push(hit.doc.route as Href)}
      accessibilityLabel={`${where}: ${hit.doc.head.text}`}
    >
      <View style={styles.other}>
        <T variant="footnote" weight="600" tone="ink2">
          {where}
        </T>
        <T variant="journalBody" numberOfLines={3}>
          <Marked text={hit.doc.head.text} marks={hit.headMarks} />
        </T>
      </View>
    </Press>
  );
}

/** Results for a query of two or more characters, newest first. */
export function SearchResults({ query }: { query: string }) {
  const days = useJournal((s) => s.days);
  const months = useJournal((s) => s.months);
  const years = useJournal((s) => s.years);
  // Folding every entry is done once per change of the journal, not on every keystroke.
  const index = useMemo(() => buildIndex({ days, months, years }), [days, months, years]);
  const [q, setQ] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setQ(query), 150);
    return () => clearTimeout(t);
  }, [query]);
  const { hits, more } = useMemo(() => searchIndex(index, q), [index, q]);
  const shown = q.trim();
  return (
    <>
      <T variant="footnote" tone="ink2" style={styles.count}>
        {hits.length
          ? more
            ? `Showing the newest ${hits.length}`
            : `${hits.length} ${hits.length === 1 ? 'entry' : 'entries'}`
          : `Nothing found for “${shown}”.`}
      </T>
      {hits.length ? (
        <Section flush>
          {hits.map((h, i) => (
            <View key={h.doc.key}>
              {i > 0 ? <Divider /> : null}
              {h.doc.kind === 'day' && days[h.doc.ref] ? (
                <EntryRow
                  day={days[h.doc.ref]}
                  match={{ headMarks: h.headMarks, snippet: h.snippet, snippetMarks: h.snippetMarks }}
                  incident={months[h.doc.ref.slice(0, 7)]?.extremeIncident?.date === h.doc.ref}
                />
              ) : (
                <OtherRow hit={h} />
              )}
            </View>
          ))}
        </Section>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  count: { paddingHorizontal: space.xs },
  other: {
    gap: 3,
    paddingVertical: space.m,
    paddingHorizontal: space.l,
    borderLeftWidth: 4,
    borderLeftColor: colors.track,
  },
});
