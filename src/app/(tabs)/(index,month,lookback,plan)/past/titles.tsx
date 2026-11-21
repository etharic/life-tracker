import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatMonth, monthOf } from '@/domain/dates';
import type { DayEntry } from '@/domain/types';
import { EntryRow } from '@/features/past/entry-row';
import { useJournal } from '@/state/journal';
import { Empty } from '@/ui/layout';
import { T } from '@/ui/text';
import { colors, GUTTER, radius, space } from '@/ui/theme';

/** Every day title, newest first, grouped by month. Tap opens the day. */
export default function DayTitles() {
  const days = useJournal((s) => s.days);
  const months = useJournal((s) => s.months);
  const insets = useSafeAreaInsets();
  const sections = useMemo(() => {
    const titled = Object.values(days)
      .filter((d) => d.title.trim())
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    const out: { title: string; data: DayEntry[] }[] = [];
    for (const d of titled) {
      const m = monthOf(d.date);
      if (!out.length || out[out.length - 1].title !== m) out.push({ title: m, data: [] });
      out[out.length - 1].data.push(d);
    }
    return out;
  }, [days]);

  return (
    <>
      {/* The list comes first so the native large title tracks its scrolling. */}
      <SectionList
        style={styles.list}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: insets.bottom + space.huge }}
        sections={sections}
        keyExtractor={(d) => d.date}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <Empty title="No day titles yet" body="Give a day a one-line title when you close it, and it appears here." />
        }
        renderSectionHeader={({ section }) => (
          <T variant="overline" tone="ink2" style={styles.header}>
            {formatMonth(section.title)}
          </T>
        )}
        renderItem={({ item, index, section }) => {
          const incident = months[monthOf(item.date)]?.extremeIncident?.date === item.date;
          const first = index === 0;
          const last = index === section.data.length - 1;
          return (
            <View style={[styles.cell, first && styles.first, last && styles.last]}>
              {!first ? <View style={styles.sepLine} /> : null}
              <EntryRow day={item} incident={incident} />
            </View>
          );
        }}
      />
      <Stack.Screen options={{ title: 'Day titles', headerLargeTitleEnabled: false }} />
    </>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  header: { marginTop: space.xl, marginBottom: space.s, marginLeft: space.xs },
  cell: {
    backgroundColor: colors.surface,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  first: {
    borderTopLeftRadius: radius.section,
    borderTopRightRadius: radius.section,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  last: {
    borderBottomLeftRadius: radius.section,
    borderBottomRightRadius: radius.section,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sepLine: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginLeft: space.l },
});
