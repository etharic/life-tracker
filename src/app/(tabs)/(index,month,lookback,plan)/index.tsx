import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActionSheetIOS, AppState, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { formatTitle, monthOf } from '@/domain/dates';
import { JournalGroup, NoSetupNote, TodayGroup, WeekGroup } from '@/features/day/day-layout';
import { DayWash } from '@/features/day/day-wash';
import { useDay, useMonth, usePrompts, useStreaks, useToday } from '@/features/hooks';
import { PromptCard } from '@/features/prompts/prompt-card';
import { useJournal } from '@/state/journal';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { Press } from '@/ui/press';
import { Screen, TopBar } from '@/ui/layout';
import { T } from '@/ui/text';
import { colors, space } from '@/ui/theme';
import { useBump } from '@/ui/use-pop';

/** The streak in the navigation bar: a flame and a number, bumping when it grows. */
function Streak({ days }: { days: number }) {
  const bump = useBump(days);
  if (days < 2) return null;
  return (
    <Animated.View style={[styles.streak, bump]} accessible accessibilityLabel={`${days}-day streak`}>
      <Icon name="flame.fill" size={14} color={colors.flame} />
      <T variant="subhead" weight="700" style={[styles.tabular, styles.streakText]} chrome>
        {String(days)}
      </T>
    </Animated.View>
  );
}

/**
 * The day's shortcuts: Kevin's Rule done today (stamped on the Month page), and this year's
 * Misogi Ritual achieved today (opens its editor, kept in Look back).
 */
function DayMenu() {
  const today = useToday();
  const monthId = monthOf(today);
  const month = useMonth(monthId);
  const rule = month.setup?.extremeThing;
  const done = month.extremeDone === true;
  const open = () => {
    const options = [
      ...(rule ? [done ? 'Kevin’s Rule: not done after all' : 'Kevin’s Rule done today'] : []),
      'Misogi Ritual achieved today',
      'Cancel',
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: rule ? `Kevin’s Rule: ${rule}` : undefined,
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: rule && done ? 0 : undefined,
      },
      (i) => {
        if (rule && i === 0) {
          useJournal.getState().updateMonth(monthId, (m) => {
            m.extremeDone = done ? null : true;
            m.extremeDoneOn = done ? null : today;
          });
          if (done) haptic.select();
          else haptic.success();
        } else if (i === options.length - 2) {
          router.push(`/year-close/${today.slice(0, 4)}?mode=edit&date=${today}`);
        }
      },
    );
  };
  return (
    <Press onPress={open} hitSlop={10} accessibilityLabel="More for today" style={styles.more}>
      <Icon name="ellipsis" size={18} color={colors.ink} weight="semibold" />
    </Press>
  );
}

/**
 * Today: the date is the title. Below it: what is due (a prompt card, only when something is), the
 * journal entry, today's goals and hobbies, then the week.
 */
/** From 5 pm until the new day starts (04:00 by default), the day is closing. */
function isEvening(hour: number): boolean {
  return hour >= 17 || hour < 4;
}

/** The current hour, checked again every few minutes and whenever the app comes back. */
function useHour(): number {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const tick = () => setHour(new Date().getHours());
    const t = setInterval(tick, 5 * 60 * 1000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && tick());
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, []);
  return hour;
}

export default function TodayScreen() {
  const today = useToday();
  const prompts = usePrompts();
  const { current } = useStreaks();
  const month = useMonth(monthOf(today));
  const setupSkipped = !month.setup && !prompts.some((p) => p.kind === 'setup');
  const day = useDay(today);
  const written = !!(day.title || day.writing || day.media.length || day.feeling != null);
  const hour = useHour();
  const evening = written || isEvening(hour);

  return (
    <Screen topInset>
      <DayWash date={today} />
      <TopBar
        title={formatTitle(today)}
        trailing={
          <View style={styles.trailing}>
            <Streak days={current} />
            <DayMenu />
          </View>
        }
      />
      <PromptCard prompts={prompts} />
      {setupSkipped ? <NoSetupNote date={today} /> : null}
      {/*
        What comes first follows the day: in daytime the quick ticks lead and the day's entry waits
        at the end; from late afternoon, or once the day is written, its entry leads.
      */}
      <View style={styles.groups}>
        {evening ? <JournalGroup date={today} isToday titled={false} /> : null}
        <TodayGroup date={today} />
        <WeekGroup date={today} />
        {evening ? null : <JournalGroup date={today} isToday titled={false} />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  groups: { gap: space.xxl },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  more: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakText: { color: colors.flame },
  tabular: { fontVariant: ['tabular-nums'] },
});
