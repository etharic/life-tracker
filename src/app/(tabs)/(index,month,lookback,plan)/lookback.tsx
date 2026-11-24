import { router, type Href } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Settings, StyleSheet, TextInput, View } from 'react-native';

import { monthOf } from '@/domain/dates';
import { CHALLENGE_KINDS } from '@/domain/types';
import { CHALLENGE_COPY, CHALLENGE_ROUTE } from '@/features/past/challenges';
import { usePromptInput, useToday } from '@/features/hooks';
import { backupLine } from '@/domain/prompts';
import { SearchResults } from '@/features/past/search-results';
import { Insights } from '@/features/past/insights';
import { GoodDays, OnThisDay } from '@/features/past/remember';
import { Weekdays, Writing } from '@/features/past/stats';
import { useJournal } from '@/state/journal';
import { Icon } from '@/ui/icon';
import { Row, Rows, Screen, Section, TopBar } from '@/ui/layout';
import { colors, radius, space, type } from '@/ui/theme';
import { Group } from '@/ui/group';
import { NAMES } from '@/domain/names';

type Item = { title: string; href: Href; icon: SFSymbol; value: string; subtitle?: string };

/** Every list in the archive, grouped by how often it grows, each with a live count. */
function useArchive(): { title: string; items: Item[] }[] {
  const days = useJournal((s) => s.days);
  const months = useJournal((s) => s.months);
  const years = useJournal((s) => s.years);
  const achievements = useJournal((s) => s.achievements);
  const challenges = useJournal((s) => s.challenges);
  const today = useToday();
  const settings = useJournal((s) => s.settings);
  const { driveSync } = usePromptInput();
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
            value: n(monthList.filter((m) => m.highlight).length),
          },
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
            subtitle: backupLine(settings, driveSync ?? null, today),
          },
        ],
      },
    ];
  }, [days, months, years, achievements, challenges, today, settings, driveSync]);
}

/** Look back: one search over everything written, three numbers, and the archive by how often it grows. */
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
          <OnThisDay />
          <GoodDays />
          <Weekdays />
          <Writing />
          {groups.map((g) => (
            <Group key={g.title} title={g.title}>
              <Section flush>
                <Rows inset={space.l + 18 + space.m}>
                  {g.items.map((it) => (
                    <Row
                      key={it.title}
                      leading={<Icon name={it.icon} size={18} color={colors.accent} />}
                      title={it.title}
                      detail={it.subtitle}
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
