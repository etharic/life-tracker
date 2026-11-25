import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { dayNumber, monthShort, weekdayShort } from '@/domain/dates';
import { feeling } from '@/domain/feelings';
import type { Span } from '@/domain/search';
import type { DayEntry } from '@/domain/types';
import { mediaUri } from '@/state/media';
import { Icon } from '@/ui/icon';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, radius, space } from '@/ui/theme';

/**
 * A day in a list, the way notes apps show notes: its line in the serif face, two lines of what was
 * written, and its first photo on the right. The feeling is the thin colour bar on the left.
 */
/** A search match: the marks in the title, and the piece of writing around the first match. */
export interface RowMatch {
  headMarks: Span[];
  snippet: string;
  snippetMarks: Span[];
}

export function EntryRow({ day, match, incident }: { day: DayEntry; match?: RowMatch; incident?: boolean }) {
  const f = feeling(day.feeling);
  const photo = day.media.find((m) => m.kind === 'photo');
  const audio = day.media.some((m) => m.kind === 'audio');
  const snippet = match ? match.snippet : snippetOf(day.writing);
  return (
    <Press
      feedback="highlight"
      onPress={() => router.push(`/day/${day.date}`)}
      accessibilityLabel={`${weekdayShort(day.date)} ${dayNumber(day.date)} ${monthShort(day.date.slice(0, 7))}: ${day.title || 'no title'}${f ? `, ${f.score} ${f.name}` : ''}${match && snippet ? `. ${snippet}` : ''}`}
    >
      <View style={styles.row}>
        <View style={[styles.bar, { backgroundColor: f?.color ?? colors.track }]} />
        <View style={styles.text}>
          <View style={styles.meta}>
            <T variant="footnote" weight="600" tone="ink2">
              {`${weekdayShort(day.date)} ${dayNumber(day.date)} ${monthShort(day.date.slice(0, 7))}`}
            </T>
            {f ? (
              <T variant="footnote" tone="ink2">
                {f.name}
              </T>
            ) : null}
            {audio ? <Icon name="waveform" size={12} color={colors.ink3} /> : null}
            {incident ? <Icon name="star.fill" size={11} color={colors.accent} /> : null}
          </View>
          <T variant="journalBody" weight="600" numberOfLines={2}>
            {day.title ? <Marked text={day.title} marks={match?.headMarks ?? []} /> : 'Untitled day'}
          </T>
          {snippet ? (
            <T variant="subhead" tone="ink2" numberOfLines={2}>
              <Marked text={snippet} marks={match?.snippetMarks ?? []} />
            </T>
          ) : null}
        </View>
        {photo ? (
          <Image
            source={{ uri: mediaUri(day.date, photo) }}
            style={styles.thumb}
            contentFit="cover"
            recyclingKey={photo.path}
          />
        ) : null}
      </View>
    </Press>
  );
}

/** The writing on one line. */
function snippetOf(writing: string): string {
  return writing.replace(/\s+/g, ' ').trim();
}

/** Text with its matched spans in pen blue (search results). */
export function Marked({ text, marks }: { text: string; marks: Span[] }) {
  if (!marks.length) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let at = 0;
  marks.forEach(([a, b], i) => {
    if (a > at) parts.push(text.slice(at, a));
    parts.push(
      <T key={i} tone="accent" weight="700">
        {text.slice(a, b)}
      </T>,
    );
    at = b;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.m, paddingVertical: space.m, paddingRight: space.l, alignItems: 'center' },
  bar: { width: 4, alignSelf: 'stretch', borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  text: { flex: 1, gap: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  thumb: { width: 60, height: 60, borderRadius: radius.control, backgroundColor: colors.fill },
});
