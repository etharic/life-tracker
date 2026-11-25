import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  addMonths,
  addWeeks,
  dayNumber,
  daysInMonth,
  formatShort,
  formatWeekRange,
  monthName,
  monthOf,
  MONTHS,
  toISO,
  weekDates,
  weekdayShort,
  weekIndexInMonth,
  weekMonday,
  weekOf,
  weeksOfMonth,
} from '@/domain/dates';
import { feeling } from '@/domain/feelings';
import type { ISODate, MonthId, WeekId } from '@/domain/types';
import { useToday } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { Segmented } from '@/ui/controls';
import { FeelingBox, FeelingScale } from '@/ui/feelings';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { Screen, Section } from '@/ui/layout';
import { Press } from '@/ui/press';
import { DayLink } from '@/features/past/day-link';
import { T } from '@/ui/text';
import { colors, GUTTER, radius, space, TARGET } from '@/ui/theme';

type Scope = 'week' | 'month' | 'year';

function Pager({
  title,
  sub,
  onPrev,
  onNext,
  canNext,
}: {
  title: string;
  sub?: string;
  onPrev: () => void;
  onNext: () => void;
  canNext: boolean;
}) {
  return (
    <View style={styles.pager}>
      <Press onPress={onPrev} style={styles.pageBtn} accessibilityLabel="Previous">
        <Icon name="chevron.left" size={17} color={colors.accent} weight="semibold" />
      </Press>
      <View style={styles.pagerMid}>
        <T variant="title" center accessibilityRole="header">
          {title}
        </T>
        {sub ? (
          <T variant="subhead" tone="ink2" center>
            {sub}
          </T>
        ) : null}
      </View>
      <Press onPress={onNext} disabled={!canNext} style={styles.pageBtn} accessibilityLabel="Next">
        <Icon name="chevron.right" size={17} color={colors.accent} weight="semibold" />
      </Press>
    </View>
  );
}

/** What a tapped box says: its date, number, name and title, with a way into the day. */
function Selection({ date }: { date: ISODate | null }) {
  const day = useJournal((s) => (date ? s.days[date] : undefined));
  if (!date) {
    return (
      <T variant="footnote" tone="ink2" center>
        Tap a box to see that day.
      </T>
    );
  }
  const f = feeling(day?.feeling);
  return (
    <Press
      feedback="highlight"
      onPress={() => router.push(`/day/${date}`)}
      accessibilityLabel={`Open ${formatShort(date)}`}
      style={styles.selection}
    >
      <View style={[styles.selSwatch, f ? { backgroundColor: f.color } : styles.selEmpty]} />
      <View style={styles.flex}>
        <T
          variant="subhead"
          weight="600"
        >{`${weekdayShort(date)} ${formatShort(date)}, ${f ? `${f.name.toLowerCase()} (${f.score})` : 'no feeling logged'}`}</T>
        <T variant="footnote" tone="ink2" numberOfLines={1}>
          {day?.title || 'No title'}
        </T>
      </View>
      <T variant="subhead" weight="600" tone="accent">
        Open
      </T>
    </Press>
  );
}

function WeekView({ week, selected, today }: { week: WeekId; selected: ISODate | null; today: ISODate }) {
  const days = useJournal((s) => s.days);
  return (
    <View style={styles.weekList}>
      {weekDates(week).map((d) => {
        const f = feeling(days[d]?.feeling);
        const future = d > today;
        const row = (
          <Pressable
            key={d}
            disabled={future}
            accessibilityRole="button"
            accessibilityLabel={`${weekdayShort(d)} ${dayNumber(d)}: ${f ? `${f.score}, ${f.name}` : 'no feeling'}`}
            style={styles.weekRow}
          >
            <T
              variant="body"
              weight={d === today ? '600' : '400'}
              tone={d === today ? 'ink' : 'ink2'}
              style={styles.weekDay}
            >
              {`${weekdayShort(d)} ${dayNumber(d)}`}
            </T>
            <FeelingBox score={days[d]?.feeling ?? null} showNumber selected={selected === d} style={styles.weekBox} />
            <T variant="subhead" tone="ink2" style={styles.weekName} numberOfLines={1}>
              {f?.name ?? ''}
            </T>
          </Pressable>
        );
        return future ? (
          row
        ) : (
          <DayLink key={d} date={d}>
            {row}
          </DayLink>
        );
      })}
    </View>
  );
}

function MonthGrid({ month, selected, today }: { month: MonthId; selected: ISODate | null; today: ISODate }) {
  const days = useJournal((s) => s.days);
  const weeks = weeksOfMonth(month);
  return (
    <View style={styles.monthGrid}>
      <View style={styles.monthLabels}>
        <View style={styles.colHead} />
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <View key={d} style={styles.monthLabelCell}>
            <T variant="caption" tone="ink2">
              {d}
            </T>
          </View>
        ))}
      </View>
      {weeks.map((w) => (
        <View key={w} style={styles.monthCol}>
          <View style={styles.colHead}>
            <T variant="caption" weight="600" tone="ink2" center chrome>{`W${weekIndexInMonth(w)}`}</T>
          </View>
          {weekDates(w).map((d) => {
            const outside = monthOf(d) !== month;
            const future = d > today;
            const score = days[d]?.feeling ?? null;
            const cell = (
              <Pressable
                key={d}
                disabled={future}
                accessibilityRole="button"
                accessibilityLabel={`${formatShort(d)}: ${feeling(score) ? `${score}, ${feeling(score)!.name}` : 'no feeling'}`}
                accessibilityHint={future ? undefined : 'Opens the day'}
                style={styles.monthCell}
              >
                <FeelingBox
                  score={score}
                  label={String(dayNumber(d))}
                  dim={outside}
                  selected={selected === d}
                  style={styles.fill}
                />
              </Pressable>
            );
            // A tap zooms the box open into its day; touch and hold peeks at it.
            return future ? (
              cell
            ) : (
              <DayLink key={d} date={d} zoom>
                {cell}
              </DayLink>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function MonthStats({ month }: { month: MonthId }) {
  const days = useJournal((s) => s.days);
  const logged = Object.values(days).filter((d) => monthOf(d.date) === month && d.feeling != null);
  if (!logged.length) return null;
  const avg = logged.reduce((n, d) => n + (d.feeling ?? 0), 0) / logged.length;
  const max = Math.max(...logged.map((d) => d.feeling!));
  const min = Math.min(...logged.map((d) => d.feeling!));
  const list = (v: number) =>
    logged
      .filter((d) => d.feeling === v)
      .map((d) => dayNumber(d.date))
      .sort((a, b) => a - b)
      .join(', ');
  return (
    <Section title={`${monthName(month)}, ${logged.length} days logged`}>
      <View style={styles.stats}>
        <View style={styles.statRow}>
          <T variant="body" tone="ink2" style={styles.flex}>
            Average
          </T>
          <T variant="title3" style={styles.tabular}>
            {avg.toFixed(1)}
          </T>
        </View>
        {[
          ['Best', max],
          ['Lowest', min],
        ].map(([label, v]) => (
          <View key={label} style={styles.statRow}>
            <T variant="body" tone="ink2" style={styles.flex}>{`${label} day`}</T>
            <View style={[styles.statSwatch, { backgroundColor: feeling(v as number)!.color }]} />
            <T variant="body" weight="600">{`${list(v as number)} ${monthName(month).slice(0, 3)}`}</T>
          </View>
        ))}
      </View>
    </Section>
  );
}

function YearGrid({
  year,
  selected,
  onSelect,
  today,
}: {
  year: string;
  selected: ISODate | null;
  onSelect: (d: ISODate) => void;
  today: ISODate;
}) {
  const days = useJournal((s) => s.days);
  const { width } = useWindowDimensions();
  const labelW = 20;
  const cell = Math.floor((width - GUTTER * 2 - labelW - 11 * 3) / 12);
  const h = Math.max(10, Math.round(cell * 0.55));
  return (
    <View>
      <View style={styles.yearRow}>
        <View style={{ width: labelW }} />
        {MONTHS.map((m) => (
          <T key={m} variant="caption" weight="600" tone="ink2" center style={{ width: cell }} chrome>
            {m[0]}
          </T>
        ))}
      </View>
      {Array.from({ length: 31 }, (_, i) => i + 1).map((dn) => (
        <View key={dn} style={[styles.yearRow, { height: h + 3 }]}>
          <T variant="caption" tone="ink2" style={[styles.yearLabel, { width: labelW }]} chrome>
            {dn === 1 || dn % 5 === 1 ? String(dn) : ''}
          </T>
          {Array.from({ length: 12 }, (_, mi) => {
            const month = `${year}-${String(mi + 1).padStart(2, '0')}`;
            if (dn > daysInMonth(month)) return <View key={mi} style={{ width: cell }} />;
            const d = toISO(Number(year), mi + 1, dn);
            const future = d > today;
            const score = days[d]?.feeling ?? null;
            return (
              <Pressable
                key={mi}
                disabled={future}
                onPress={() => onSelect(d)}
                accessibilityRole="button"
                accessibilityLabel={`${formatShort(d)}: ${feeling(score) ? `${score}, ${feeling(score)!.name}` : 'no feeling'}`}
                hitSlop={2}
              >
                <FeelingBox
                  score={score}
                  selected={selected === d}
                  style={{ width: cell, height: h, borderRadius: 3, opacity: future ? 0.35 : 1 }}
                />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export default function Feelings() {
  const today = useToday();
  const [scope, setScope] = useState<Scope>('month');
  const [week, setWeek] = useState<WeekId>(weekOf(today));
  const [month, setMonth] = useState<MonthId>(monthOf(today));
  const [year, setYear] = useState(today.slice(0, 4));
  const [selected, setSelected] = useState<ISODate | null>(null);

  const select = (d: ISODate) => {
    haptic.select();
    if (selected === d) router.push(`/day/${d}`);
    else setSelected(d);
  };

  const pager = useMemo(() => {
    switch (scope) {
      case 'week':
        return {
          title: `Week ${weekIndexInMonth(week)}`,
          sub: `${formatWeekRange(week)}, ${monthName(monthOf(weekDates(week)[6]))}`,
          prev: () => setWeek(addWeeks(week, -1)),
          next: () => setWeek(addWeeks(week, 1)),
          canNext: weekMonday(addWeeks(week, 1)) <= today,
        };
      case 'month':
        return {
          title: monthName(month),
          sub: month.slice(0, 4),
          prev: () => setMonth(addMonths(month, -1)),
          next: () => setMonth(addMonths(month, 1)),
          canNext: addMonths(month, 1) <= monthOf(today),
        };
      case 'year':
        return {
          title: year,
          sub: undefined,
          prev: () => setYear(String(Number(year) - 1)),
          next: () => setYear(String(Number(year) + 1)),
          canNext: Number(year) < Number(today.slice(0, 4)),
        };
    }
  }, [scope, week, month, year, today]);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Feelings', headerLargeTitleEnabled: true }} />
      <Segmented
        options={[
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
          { value: 'year', label: 'Year' },
        ]}
        value={scope}
        onChange={(v) => {
          setScope(v);
          setSelected(null);
        }}
      />
      <Pager title={pager.title} sub={pager.sub} onPrev={pager.prev} onNext={pager.next} canNext={pager.canNext} />
      {scope === 'week' ? <WeekView week={week} selected={selected} today={today} /> : null}
      {scope === 'month' ? <MonthGrid month={month} selected={selected} today={today} /> : null}
      {scope === 'year' ? <YearGrid year={year} selected={selected} onSelect={select} today={today} /> : null}
      {scope === 'year' ? (
        <Selection date={selected} />
      ) : (
        <T variant="footnote" tone="ink2" center>
          Tap a day to open it. Touch and hold to look without opening.
        </T>
      )}
      {scope === 'month' ? <MonthStats month={month} /> : null}
      {scope === 'month' ? (
        <T variant="footnote" tone="ink2">
          Dimmed boxes belong to the neighbouring month.
        </T>
      ) : null}
      <View style={styles.scale}>
        <T variant="overline" tone="ink2">
          Scale
        </T>
        <FeelingScale />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  pager: { flexDirection: 'row', alignItems: 'center', marginVertical: space.xs },
  pagerMid: { flex: 1 },
  pageBtn: {
    width: TARGET,
    height: TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: TARGET / 2,
    backgroundColor: colors.accentSoft,
  },
  selection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    padding: space.m,
    borderRadius: radius.section,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  selSwatch: { width: 32, height: 32, borderRadius: radius.s },
  selEmpty: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.boxBorder },
  weekList: { gap: space.s },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 56 },
  weekDay: { width: 64 },
  weekBox: { flex: 1, height: 56, borderRadius: radius.control },
  weekName: { width: 104 },
  monthGrid: { flexDirection: 'row', gap: 6 },
  monthLabels: { width: 32, gap: 6 },
  monthLabelCell: { height: 50, justifyContent: 'center' },
  monthCol: { flex: 1, gap: 6 },
  colHead: { height: 18, justifyContent: 'center' },
  monthCell: { height: 50 },
  stats: { gap: space.m },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  statSwatch: { width: 22, height: 22, borderRadius: 5 },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  // iOS's smallest text style (caption 2, 11 pt); every fifth day only, so it has room.
  yearLabel: { fontSize: 11, lineHeight: 13, textAlign: 'right', paddingRight: 3 },
  scale: { gap: space.s, marginTop: space.s },
});
