import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatShort, monthName, weekDates, weekIndexInMonth, weekMonday } from '@/domain/dates';
import { feeling } from '@/domain/feelings';
import { CHECK_KEYS, type MonthRecord, type WeekRecord } from '@/domain/types';
import { useToday } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { Icon } from '@/ui/icon';
import { Divider, Empty, Explainer, Screen, Section, SectionLabel } from '@/ui/layout';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, space, TARGET } from '@/ui/theme';
import { misogiFor } from '@/domain/misogi';
import { misogiOf, NAMES } from '@/domain/names';
import { monthHighlightRows } from '@/domain/lists';

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
        <Group key={m.month} label={`${monthName(m.month)} ${m.month.slice(0, 4)}`}>
          {Object.keys(m.weeks)
            .sort()
            .reverse()
            .filter((w) => m.weeks[w].highlight)
            .map((w) => (
              <Line
                key={w}
                serif
                over={`Week ${weekIndexInMonth(w)}, from ${formatShort(weekMonday(w))}`}
                title={m.weeks[w].highlight}
                sub={m.weekHighlightFrom[w] ? `The title of ${formatShort(m.weekHighlightFrom[w])}` : undefined}
              />
            ))}
        </Group>
      ))}
    </ListScreen>
  );
}

/**
 * Each week's commitments, as on Today: its own (priorities starred, first) and the month's weekly
 * checks, each with whether it got done.
 */
export function PrioritiesList() {
  const months = useJournal((s) => s.months);
  const days = useJournal((s) => s.days);
  const lines = (m: MonthRecord, id: string) => {
    const w: WeekRecord = m.weeks[id];
    const done = new Set(weekDates(id).flatMap((d) => days[d]?.prioritiesDone ?? []));
    const own = [...w.priorities]
      .sort((a, b) => Number(!!a.plain) - Number(!!b.plain))
      .map((p) => ({ text: p.text, star: !p.plain, done: done.has(p.text) }));
    const checks = m.setup
      ? CHECK_KEYS.map((k) => ({ text: m.setup!.weeklyChecks[k], star: false, done: w.checks[k] })).filter(
          (c) => c.text,
        )
      : [];
    return [...own, ...checks];
  };
  const items = sortedMonths(months).filter((m) =>
    Object.keys(m.weeks).some((w) => m.weeks[w].started || m.weeks[w].priorities.length),
  );
  return (
    <ListScreen
      explainer="What each week set out to do, and what got done. Priorities carry a star."
      empty={items.length ? null : 'No weekly commitments yet'}
    >
      {items.map((m) => (
        <Group key={m.month} label={`${monthName(m.month)} ${m.month.slice(0, 4)}`}>
          {Object.keys(m.weeks)
            .sort()
            .reverse()
            .filter((w) => m.weeks[w].started || m.weeks[w].priorities.length)
            .map((w) => {
              const ps = lines(m, w);
              return (
                <View key={w} style={styles.week}>
                  <T
                    variant="footnote"
                    tone="ink2"
                  >{`Week ${weekIndexInMonth(w)}: ${ps.filter((p) => p.done).length} of ${ps.length} done`}</T>
                  {ps.map((p) => (
                    <View key={p.text} style={styles.pRow}>
                      <Icon
                        name={p.done ? 'checkmark.circle.fill' : 'circle'}
                        size={16}
                        color={p.done ? colors.accent : colors.ink3}
                      />
                      <T variant="body" tone={p.done ? 'ink' : 'ink2'} style={styles.flex}>
                        {p.text}
                      </T>
                      {p.star ? <Icon name="star.fill" size={12} color={colors.accent} /> : null}
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

/**
 * Month highlights: each month's best moments, good or bad. A month shows its highlight, chosen
 * when it closes (with the week it came from), and its extreme incident, the day that stood out
 * most, marked positive or negative, in that day's feeling colour; a tap on it opens the day.
 */
export function MonthHighlightsList() {
  const months = useJournal((s) => s.months);
  const days = useJournal((s) => s.days);
  const rows = monthHighlightRows(Object.values(months));
  return (
    <ListScreen
      explainer="Each month’s highlights, good or bad: the line chosen when it closes, and the day that stood out most."
      empty={rows.length ? null : 'No month highlights yet'}
    >
      {byYear(rows).map(([year, rs]) => (
        <Group key={year} label={year}>
          {rs.map((r) =>
            r.kind === 'highlight' ? (
              <Line
                key={`${r.month}/h`}
                serif
                over={monthName(r.month)}
                title={r.text}
                sub={r.fromWeek ? `From week ${weekIndexInMonth(r.fromWeek)}` : undefined}
              />
            ) : (
              <Line
                key={`${r.month}/i`}
                serif
                over={`${monthName(r.month)}, the day that stood out, ${r.incident.mark}`}
                title={r.incident.title || formatShort(r.incident.date)}
                sub={formatShort(r.incident.date)}
                color={feeling(days[r.incident.date]?.feeling)?.color ?? null}
                onPress={() => router.push(`/day/${r.incident.date}`)}
              />
            ),
          )}
        </Group>
      ))}
    </ListScreen>
  );
}

/**
 * Defining moments and misogis, one line per year: a life timeline. Each year opens its page,
 * where the defining moment, the year's misogi and the sealed note live.
 */
export function DefiningList() {
  const years = useJournal((s) => s.years);
  const thisYear = useToday().slice(0, 4);
  const all = new Set<string>([thisYear]);
  for (const y of Object.values(years)) {
    if (y.defining) all.add(y.year);
    if (y.nextMisogi) all.add(String(Number(y.year) + 1));
  }
  const list = [...all]
    .filter((y) => y <= String(Number(thisYear) + 1))
    .sort()
    .reverse();
  return (
    <ListScreen explainer={`${NAMES.definingPlural}: what defined each year, and each year’s misogi.`} empty={null}>
      <Section flush>
        {list.map((y, i) => {
          const d = years[y]?.defining ?? null;
          const m = misogiFor(years, y);
          const outcome = m ? (m.done === true ? 'done' : m.done === false ? 'not this time' : '') : '';
          const sub = m ? `${misogiOf(y)}: ${m.text}${outcome ? `, ${outcome}` : ''}` : '';
          const title = d?.text ?? (y === thisYear ? `Record ${y}’s ${NAMES.defining.toLowerCase()}` : 'Not recorded');
          return (
            <View key={y}>
              {i > 0 ? <Divider /> : null}
              <Press
                feedback="highlight"
                onPress={() => router.push(`/past/year/${y}`)}
                accessibilityLabel={[y, title, sub].filter(Boolean).join(', ')}
                accessibilityHint="Opens the year"
              >
                <View style={styles.timeline}>
                  <T variant="title3" tone="accent" style={styles.year}>
                    {y}
                  </T>
                  <View style={styles.flex}>
                    <T variant="journalBody" tone={d ? 'ink' : 'ink3'}>
                      {title}
                    </T>
                    {sub ? (
                      <T variant="footnote" tone="ink2">
                        {sub}
                      </T>
                    ) : null}
                  </View>
                  <Icon name="chevron.right" size={13} color={colors.ink3} weight="semibold" />
                </View>
              </Press>
            </View>
          );
        })}
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
