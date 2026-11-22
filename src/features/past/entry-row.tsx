import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { dayNumber, monthShort, weekdayShort } from '@/domain/dates';
import { feeling } from '@/domain/feelings';
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
export function EntryRow({ day, highlight, incident }: { day: DayEntry; highlight?: string; incident?: boolean }) {
  const f = feeling(day.feeling);
  const photo = day.media.find((m) => m.kind === 'photo');
  const audio = day.media.some((m) => m.kind === 'audio');
  const snippet = snippetOf(day.writing, highlight);
  return (
    <Press
      feedback="highlight"
      onPress={() => router.push(`/day/${day.date}`)}
      accessibilityLabel={`${weekdayShort(day.date)} ${dayNumber(day.date)} ${monthShort(day.date.slice(0, 7))}: ${day.title || 'no title'}${f ? `, ${f.score} ${f.name}` : ''}`}
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
            {day.title || 'Untitled day'}
          </T>
          {snippet ? (
            <T variant="subhead" tone="ink2" numberOfLines={2}>
              {snippet}
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

/** The writing, or the part of it around a search match. */
function snippetOf(writing: string, highlight?: string): string {
  const flat = writing.replace(/\s+/g, ' ').trim();
  if (!flat) return '';
  if (!highlight) return flat;
  const i = flat.toLowerCase().indexOf(highlight.toLowerCase());
  if (i <= 30) return flat;
  return `…${flat.slice(i - 30)}`;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.m, paddingVertical: space.m, paddingRight: space.l, alignItems: 'center' },
  bar: { width: 4, alignSelf: 'stretch', borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  text: { flex: 1, gap: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  thumb: { width: 60, height: 60, borderRadius: radius.control, backgroundColor: colors.fill },
});
