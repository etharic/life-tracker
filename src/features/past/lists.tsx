import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatShort, monthName, weekDates, weekIndexInMonth, weekMonday } from '@/domain/dates';
import { feeling } from '@/domain/feelings';
import type { MonthRecord } from '@/domain/types';
import { useToday } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { Icon } from '@/ui/icon';
import { Divider, Empty, Explainer, Row, Screen, Section, SectionLabel } from '@/ui/layout';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, space, TARGET } from '@/ui/theme';

export function sortedMonths(months: Record<string, MonthRecord>): MonthRecord[] {
  return Object.values(months).sort((a, b) => (a.month < b.month ? 1 : -1));
}

/** Months grouped under their year, newest first. */
export function byYear<T extends { month: string }>(items: T[]): [string, T[]][] {
  const out: [string, T[]][] = [];
  for (const it of items) {
    const y = it.month.slice(0, 4);
    if (!out.length || out[out.length - 1][0] !== y) out.push([y, []]);
    out[out.length - 1][1].push(it);
  }
  return out;
}

export function ListScreen({
  explainer,
  empty,
  children,
}: {
  explainer: string;
  empty: string | null;
  children: ReactNode;
}) {
  return (
    <Screen>
      <Explainer>{explainer}</Explainer>
      {empty ? <Empty title={empty} /> : children}
    </Screen>
  );
}

export function Line({
  over,
  title,
  sub,
  color,
  onPress,
  trailing,
  serif,
}: {
  serif?: boolean;
  over?: string;
  title: string;
  sub?: string;
  color?: string | null;
  onPress?: () => void;
  trailing?: ReactNode;
}) {
  const body = (
    <View style={styles.line}>
      {color !== undefined ? <View style={[styles.bar, { backgroundColor: color ?? colors.track }]} /> : null}
      <View style={styles.flex}>
        {over ? (
          <T variant="footnote" tone="ink2">
            {over}
          </T>
        ) : null}
        <T variant={serif ? 'journalBody' : 'body'}>{title}</T>
        {sub ? (
          <T variant="footnote" tone="ink2">
            {sub}
          </T>
        ) : null}
      </View>
      {trailing}
      {onPress ? <Icon name="chevron.right" size={13} color={colors.ink3} weight="semibold" /> : null}
    </View>
  );
  return onPress ? (
    <Press feedback="highlight" onPress={onPress} accessibilityLabel={[over, title, sub].filter(Boolean).join(', ')}>
      {body}
    </Press>
  ) : (
    body
  );
}

export function Group({ label, children }: { label: string; children: ReactNode[] }) {
  return (
    <View style={styles.group}>
      <SectionLabel>{label}</SectionLabel>
      <Section flush>
        {children.map((c, i) => (
          <View key={i}>
            {i > 0 ? <Divider /> : null}
            {c}
          </View>
        ))}
      </Section>
    </View>
  );
}

// ---------- The lists ----------

export function HighlightsList() {
  const months = useJournal((s) => s.months);
  const items = sortedMonths(months).filter((m) => Object.values(m.weeks).some((w) => w.highlight));
  return (
    <ListScreen
      explainer="One line for each week, written on its Sunday."
      empty={items.length ? null : 'No weekly highlights yet'}
    >
      {items.map((m) => (
        <Group key={m.month} label={`${m.month.slice(0, 4)} · ${monthName(m.month)}`}>
          {Object.keys(m.weeks)
            .sort()
            .reverse()
            .filter((w) => m.weeks[w].highlight)
            .map((w) => (
              <Line
                key={w}
                serif
                over={`Week ${weekIndexInMonth(w)} · from ${formatShort(weekMonday(w))}`}
                title={m.weeks[w].highlight}
              />
            ))}
        </Group>
      ))}
    </ListScreen>
  );
}

export function PrioritiesList() {
  const months = useJournal((s) => s.months);
  const days = useJournal((s) => s.days);
  const items = sortedMonths(months).filter((m) => Object.values(m.weeks).some((w) => w.priorities.length));
  return (
    <ListScreen
      explainer="What each week set out to do, and what got done."
      empty={items.length ? null : 'No weekly priorities yet'}
    >
      {items.map((m) => (
        <Group key={m.month} label={`${m.month.slice(0, 4)} · ${monthName(m.month)}`}>
          {Object.keys(m.weeks)
            .sort()
            .reverse()
            .filter((w) => m.weeks[w].priorities.length)
            .map((w) => {
              const done = new Set(weekDates(w).flatMap((d) => days[d]?.prioritiesDone ?? []));
              const ps = m.weeks[w].priorities;
              return (
                <View key={w} style={styles.week}>
                  <T
                    variant="footnote"
                    tone="ink2"
                  >{`Week ${weekIndexInMonth(w)} · ${ps.filter((p) => done.has(p.text)).length} of ${ps.length} done`}</T>
                  {ps.map((p) => (
                    <View key={p.text} style={styles.pRow}>
                      <Icon
                        name={done.has(p.text) ? 'checkmark.circle.fill' : 'circle'}
                        size={16}
                        color={done.has(p.text) ? colors.accent : colors.ink3}
                      />
                      <T variant="body" tone={done.has(p.text) ? 'ink' : 'ink2'} style={styles.flex}>
                        {p.text}
                      </T>
                    </View>
                  ))}
                </View>
              );
            })}
        </Group>
      ))}
    </ListScreen>
  );
}

export function ExtremesList() {
  const months = useJournal((s) => s.months);
  const items = sortedMonths(months).filter((m) => m.setup?.extremeThing);
  return (
    <ListScreen
      explainer="Kevin’s Rule: the most extreme thing you planned for the month."
      empty={items.length ? null : 'No Kevin’s Rules yet'}
    >
      {byYear(items).map(([y, ms]) => (
        <Group key={y} label={y}>
          {ms.map((m) => (
            <Line
              key={m.month}
              over={monthName(m.month)}
              title={m.setup!.extremeThing}
              sub={m.extremeDone === true ? 'Done' : m.extremeDone === false ? 'Not done' : 'Open'}
              onPress={() => router.push(`/months/${m.month}`)}
            />
          ))}
        </Group>
      ))}
    </ListScreen>
  );
}

export function IncidentsList() {
  const months = useJournal((s) => s.months);
  const days = useJournal((s) => s.days);
  const items = sortedMonths(months).filter((m) => m.extremeIncident);
  return (
    <ListScreen
      explainer="Extreme incident: the day of each month that turned out most memorable."
      empty={items.length ? null : 'No extreme incidents yet'}
    >
      {byYear(items).map(([y, ms]) => (
        <Group key={y} label={y}>
          {ms.map((m) => {
            const inc = m.extremeIncident!;
            return (
              <Line
                key={m.month}
                serif
                over={`${monthName(m.month)} · ${inc.mark}`}
                title={inc.title}
                sub={formatShort(inc.date)}
                color={feeling(days[inc.date]?.feeling)?.color ?? null}
                onPress={() => router.push(`/day/${inc.date}`)}
              />
            );
          })}
        </Group>
      ))}
    </ListScreen>
  );
}

/**
 * Misogi Rituals, one line per year, a life timeline. This year's can be written or changed at
 * any time; past years open as they were recorded.
 */
export function DefiningList() {
  const years = useJournal((s) => s.years);
  const thisYear = useToday().slice(0, 4);
  const mine = years[thisYear]?.defining ?? null;
  const items = Object.values(years)
    .filter((y) => y.defining && y.year !== thisYear)
    .sort((a, b) => (a.year < b.year ? 1 : -1));
  const line = (year: string, text: string, onPress: () => void, hint: string) => (
    <Press feedback="highlight" onPress={onPress} accessibilityLabel={`${year}: ${text}`} accessibilityHint={hint}>
      <View style={styles.timeline}>
        <T variant="title3" tone="accent" style={styles.year}>
          {year}
        </T>
        <T variant="journalBody" style={styles.flex}>
          {text}
        </T>
      </View>
    </Press>
  );
  return (
    <ListScreen explainer="Misogi Ritual: what defined each year. One line per year, a life timeline." empty={null}>
      <Section flush>
        {mine ? (
          line(thisYear, mine.text, () => router.push(`/year-close/${thisYear}?mode=edit`), 'Opens it to change')
        ) : (
          <Row
            leading={<Icon name="plus.circle.fill" size={20} color={colors.accent} />}
            title={`Record ${thisYear}’s Misogi Ritual`}
            onPress={() => router.push(`/year-close/${thisYear}?mode=edit`)}
          />
        )}
        {items.map((y) => (
          <View key={y.year}>
            <Divider />
            {line(y.year, y.defining!.text, () => router.push(`/year-close/${y.year}?mode=view`), 'Opens it')}
          </View>
        ))}
      </Section>
    </ListScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: space.m },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.l,
    paddingVertical: space.m - 2,
    minHeight: TARGET + 8,
  },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 2, marginLeft: -space.s },
  week: { gap: space.xs + 2, paddingHorizontal: space.l, paddingVertical: space.m },
  pRow: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  timeline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.l,
    paddingHorizontal: space.l,
    paddingVertical: space.m + 2,
  },
  year: { width: 52, fontVariant: ['tabular-nums'] },
});
