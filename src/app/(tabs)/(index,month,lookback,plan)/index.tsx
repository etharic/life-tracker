import { router } from 'expo-router';
import { ActionSheetIOS, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { formatTitle, monthOf } from '@/domain/dates';
import { JournalGroup, NoSetupNote, TodayGroup, WeekGroup } from '@/features/day/day-layout';
import { useMonth, usePrompts, useStreaks, useToday } from '@/features/hooks';
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
      <Icon name="flame.fill" size={14} color={colors.accent} />
      <T variant="subhead" weight="700" tone="accent" style={styles.tabular} chrome>
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
export default function TodayScreen() {
  const today = useToday();
  const prompts = usePrompts();
  const { current } = useStreaks();
  const month = useMonth(monthOf(today));
  const setupSkipped = !month.setup && !prompts.some((p) => p.kind === 'setup');

  return (
    <Screen topInset>
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
      <View style={styles.groups}>
        <JournalGroup date={today} isToday titled={false} />
        <TodayGroup date={today} />
        <WeekGroup date={today} />
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
  tabular: { fontVariant: ['tabular-nums'] },
});
