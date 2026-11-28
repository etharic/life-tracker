import { router, type Href } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Settings, StyleSheet, TextInput, View } from 'react-native';

import { monthOf } from '@/domain/dates';
import { monthHighlightRows } from '@/domain/lists';
import { CHALLENGE_KINDS } from '@/domain/types';
import { CHALLENGE_COPY, CHALLENGE_ROUTE } from '@/features/past/challenges';
import { useToday } from '@/features/hooks';
import { SearchResults } from '@/features/past/search-results';
import { Insights } from '@/features/past/insights';
import { GoodDays, OnThisDay } from '@/features/past/remember';
import { Weekdays } from '@/features/past/stats';
import { useJournal } from '@/state/journal';
import { Icon } from '@/ui/icon';
import { Row, Rows, Screen, TopBar } from '@/ui/layout';
import { Ribbon } from '@/ui/ribbon';
import { colors, radius, space, type } from '@/ui/theme';
import { NAMES } from '@/domain/names';

type Item = { title: string; href: Href; icon: SFSymbol; value: string };

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
        // Every challenge list there is, so a new one shows up here by itself.
        items: CHALLENGE_KINDS.map((k) => ({
          title: CHALLENGE_COPY[k].title,
          href: CHALLENGE_ROUTE[k],
          icon: CHALLENGE_COPY[k].icon,
          value: n(challenges[k].length),
        })),
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
            title: 'Week highlights',
            href: '/past/highlights',
            icon: 'sparkle',
            value: n(weekList.filter((w) => w.highlight).length),
          },
          {
            title: 'Commitments',
            href: '/past/priorities',
            icon: 'checklist',
            value: n(weekList.filter((w) => w.started || w.priorities.length).length),
          },
        ],
      },
      {
        title: 'Every month',
        items: [
          {
            title: 'Month highlights',
            href: '/past/month-highlights',
            icon: 'sparkles',
            // Good or bad: the closing highlight and the extreme incident count together.
            value: n(monthHighlightRows(monthList).length),
          },
          {
            title: 'Kevin’s Rules',
            href: '/past/extremes',
            icon: 'flag',
            value: n(monthList.filter((m) => m.setup?.extremeThing).length),
          },
          { title: 'Goals and hobbies', href: '/past/archive', icon: 'circle.circle', value: n(used.size) },
          { title: 'Achievements', href: '/past/achievements', icon: 'star', value: n(achievements.length) },
        ],
      },
      {
        title: 'Every year',
        items: [
          {
            title: NAMES.definingPlural,
            href: '/past/defining',
            icon: 'calendar',
            value: n(Object.values(years).filter((y) => y.defining).length),
          },
          {
            title: 'Yearly book',
            href: '/backup',
            icon: 'book.closed',
            value: today.slice(0, 4),
          },
        ],
      },
    ];
  }, [days, months, years, achievements, challenges, today]);
}

/** Look back: one search over everything written, the run, the weekdays, and the archive by how often it grows. */
export default function LookBackHub() {
  // Simulator screenshots fill the field with the launch argument `-LTSearch <words>`. Unused on a phone.
  const [query, setQuery] = useState(() => {
    const v: unknown = Settings.get('LTSearch');
    return typeof v === 'string' ? v : '';
  });
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
          placeholder="Search everything you wrote"
          placeholderTextColor={colors.ink3}
          selectionColor={colors.accent}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
          style={styles.searchInput}
          accessibilityLabel="Search everything you wrote"
        />
      </View>
      {searching ? (
        <SearchResults query={query} />
      ) : (
        <View style={styles.groups}>
          <Insights />
          <OnThisDay />
          <GoodDays />
          {/* The weekdays and the archive as ribbons, one on the next, each named on its side. */}
          <View style={styles.ribbons}>
            <Weekdays />
            {groups.map((g) => (
              <Ribbon key={g.title} label={g.title} tint={colors.ink2} soft={colors.fill}>
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
              </Ribbon>
            ))}
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  groups: { gap: space.xxl },
  ribbons: { gap: 2 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    paddingHorizontal: space.m,
    minHeight: 44,
    borderRadius: radius.control,
    backgroundColor: colors.fill,
  },
  searchInput: { ...type.body, flex: 1, color: colors.ink, paddingVertical: space.s },
});
