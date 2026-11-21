import { router, type Href } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { monthOf } from '@/domain/dates';
import { useToday } from '@/features/hooks';
import { EntryRow } from '@/features/past/entry-row';
import { Insights } from '@/features/past/insights';
import { useJournal } from '@/state/journal';
import { Icon } from '@/ui/icon';
import { Divider, Row, Rows, Screen, Section, TopBar } from '@/ui/layout';
import { T } from '@/ui/text';
import { colors, radius, space, type } from '@/ui/theme';
import { Group } from '@/ui/group';

type Item = { title: string; href: Href; icon: SFSymbol; value: string };

function SearchResults({ query }: { query: string }) {
  const days = useJournal((s) => s.days);
  const months = useJournal((s) => s.months);
  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (q.length < 2) return [];
    return Object.values(days)
      .filter((d) => d.title.toLowerCase().includes(q) || d.writing.toLowerCase().includes(q))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 80);
  }, [days, q]);
  return (
    <>
      <T variant="footnote" tone="ink2" style={styles.count}>
        {results.length
          ? `${results.length === 80 ? '80+' : results.length} days`
          : `Nothing found for “${query.trim()}”.`}
      </T>
      {results.length ? (
        <Section flush>
          {results.map((d, i) => (
            <View key={d.date}>
              {i > 0 ? <Divider /> : null}
              <EntryRow day={d} highlight={q} incident={months[d.date.slice(0, 7)]?.extremeIncident?.date === d.date} />
            </View>
          ))}
        </Section>
      ) : null}
    </>
  );
}

/** Every list in the archive, grouped by how often it grows, each with a live count. */
function useArchive(): { title: string; items: Item[] }[] {
  const days = useJournal((s) => s.days);
  const months = useJournal((s) => s.months);
  const years = useJournal((s) => s.years);
  const achievements = useJournal((s) => s.achievements);
  const challenges = useJournal((s) => s.challenges);
  const today = useToday();
  return useMemo(() => {
    const dayList = Object.values(days);
    const monthList = Object.values(months);
    const weekList = monthList.flatMap((m) => Object.values(m.weeks));
    const thisMonth = dayList.filter((d) => monthOf(d.date) === monthOf(today) && d.feeling != null);
    const avg = thisMonth.length ? thisMonth.reduce((k, d) => k + (d.feeling ?? 0), 0) / thisMonth.length : null;
    const used = new Set(
      monthList.flatMap((m) =>
        m.setup ? [...Object.values(m.setup.goals), ...Object.values(m.setup.hobbies)].map((c) => c.bankId) : [],
      ),
    );
    const n = (x: number) => String(x);
    return [
      {
        title: 'Challenges',
        items: [
          {
            title: 'Rejection list',
            href: '/past/rejections',
            icon: 'xmark.seal',
            value: n(challenges.rejections.length),
          },
          { title: 'Bucket list', href: '/past/bucket', icon: 'list.star', value: n(challenges.bucket.length) },
        ],
      },
      {
        title: 'Every day',
        items: [
          {
            title: 'Day titles',
            href: '/past/titles',
            icon: 'text.book.closed',
            value: n(dayList.filter((d) => d.title).length),
          },
          {
            title: 'Feelings',
            href: '/past/feelings',
            icon: 'square.grid.3x3',
            value: avg == null ? '' : `${avg.toFixed(1)} this month`,
          },
        ],
      },
      {
        title: 'Every week',
        items: [
          {
            title: 'Highlights',
            href: '/past/highlights',
            icon: 'sparkle',
            value: n(weekList.filter((w) => w.highlight).length),
          },
          {
            title: 'Priorities',
            href: '/past/priorities',
            icon: 'checklist',
            value: n(weekList.reduce((k, w) => k + w.priorities.length, 0)),
          },
        ],
      },
      {
        title: 'Every month',
        items: [
          {
            title: 'Kevin’s Rules',
            href: '/past/extremes',
            icon: 'flag',
            value: n(monthList.filter((m) => m.setup?.extremeThing).length),
          },
          {
            title: 'Extreme incidents',
            href: '/past/incidents',
            icon: 'bolt',
            value: n(monthList.filter((m) => m.extremeIncident).length),
          },
          { title: 'Goals and hobbies', href: '/past/archive', icon: 'circle.circle', value: n(used.size) },
          { title: 'Achievements', href: '/past/achievements', icon: 'star', value: n(achievements.length) },
        ],
      },
      {
        title: 'Every year',
        items: [
          {
            title: 'Misogi Rituals',
            href: '/past/defining',
            icon: 'calendar',
            value: n(Object.values(years).filter((y) => y.defining).length),
          },
          { title: 'Yearly book', href: '/backup', icon: 'book.closed', value: today.slice(0, 4) },
        ],
      },
    ];
  }, [days, months, years, achievements, challenges, today]);
}

/** Look back: one search over everything written, three numbers, and the archive by how often it grows. */
export default function LookBackHub() {
  const [query, setQuery] = useState('');
  const groups = useArchive();
  const searching = query.trim().length >= 2;
  return (
    <Screen topInset>
      <TopBar title="Look back" />
      <View style={styles.search}>
        <Icon name="magnifyingglass" size={16} color={colors.ink3} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search all days"
          placeholderTextColor={colors.ink3}
          selectionColor={colors.accent}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
          style={styles.searchInput}
          accessibilityLabel="Search all days"
        />
      </View>
      {searching ? (
        <SearchResults query={query} />
      ) : (
        <View style={styles.groups}>
          <Insights />
          {groups.map((g) => (
            <Group key={g.title} title={g.title}>
              <Section flush>
                <Rows inset={space.l + 18 + space.m}>
                  {g.items.map((it) => (
                    <Row
                      key={it.title}
                      leading={<Icon name={it.icon} size={18} color={colors.accent} />}
                      title={it.title}
                      value={it.value}
                      onPress={() => router.push(it.href)}
                    />
                  ))}
                </Rows>
              </Section>
            </Group>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  groups: { gap: space.xxl },
  count: { paddingHorizontal: space.xs },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    paddingHorizontal: space.m,
    minHeight: 40,
    borderRadius: radius.control,
    backgroundColor: colors.fill,
  },
  searchInput: { ...type.body, flex: 1, color: colors.ink, paddingVertical: space.s },
});
