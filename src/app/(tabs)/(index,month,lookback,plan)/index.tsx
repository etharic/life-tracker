import { router } from 'expo-router';
import { ActionSheetIOS, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { formatTitle, monthOf } from '@/domain/dates';
import { unjudgedMisogi } from '@/domain/misogi';
import { misogiOf, NAMES } from '@/domain/names';
import { JournalGroup, NoSetupNote, TodayGroup, useActiveChallenges, WeekGroup } from '@/features/day/day-layout';
import { ChallengeStack } from '@/features/day/today-board';
import { useMonth, usePrompts, useStreaks, useToday } from '@/features/hooks';
import { PromptCard, UpkeepRow } from '@/features/prompts/prompt-card';
import { judgeMisogi } from '@/features/year/commit';
import { useJournal } from '@/state/journal';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { Press } from '@/ui/press';
import { Screen, TopBar } from '@/ui/layout';
import { colors, space } from '@/ui/theme';
import { useBump } from '@/ui/use-pop';
import { RollingText } from '@/ui/rolling-text';

/** The streak in the navigation bar: a flame and a number, bumping when it grows. */
function Streak({ days }: { days: number }) {
  const bump = useBump(days);
  if (days < 2) return null;
  return (
    <Pressable
      onPress={() => router.push('/streak?view=1')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${days}-day streak`}
      accessibilityHint="Shows this week and your record"
    >
      <Animated.View style={[styles.streak, bump]}>
        <Icon name="flame.fill" size={14} color={colors.flame} />
        <RollingText
          variant="subhead"
          weight="700"
          style={[styles.tabular, styles.streakText]}
          chrome
          text={String(days)}
        />
      </Animated.View>
    </Pressable>
  );
}

/**
 * The day's shortcuts: Kevin's Rule done today (stamped on the Month page), this year's defining
 * moment happened today (opens its editor, kept in Look back), and, while this year's misogi is
 * not yet judged, "Misogi done today" (the same action as Plan's "Done it?").
 */
function DayMenu() {
  const today = useToday();
  const monthId = monthOf(today);
  const month = useMonth(monthId);
  const years = useJournal((s) => s.years);
  const rule = month.setup?.extremeThing;
  const done = month.extremeDone === true;
  const misogi = unjudgedMisogi(years, today);
  const open = () => {
    type Action = { label: string; run: () => void };
    const actions: Action[] = [];
    if (rule)
      actions.push({
        label: done ? `${NAMES.kevin}: not done after all` : `${NAMES.kevin} done today`,
        run: () => {
          useJournal.getState().updateMonth(monthId, (m) => {
            m.extremeDone = done ? null : true;
            m.extremeDoneOn = done ? null : today;
          });
          if (done) haptic.select();
          else haptic.success();
        },
      });
    if (misogi)
      actions.push({
        label: `${NAMES.misogi} done today`,
        run: () => {
          haptic.success();
          void judgeMisogi(misogi.year, true, today);
        },
      });
    actions.push({
      label: `${NAMES.defining} today`,
      run: () => router.push(`/year-close/${today.slice(0, 4)}?mode=edit&date=${today}`),
    });
    const options = [...actions.map((a) => a.label), 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: rule ? `${NAMES.kevin}: ${rule}` : undefined,
        message: misogi ? `${misogiOf(misogi.year)}: ${misogi.misogi.text}` : undefined,
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: rule && done ? 0 : undefined,
      },
      (i) => {
        if (i < actions.length) actions[i].run();
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
 * Today, in the order a day is lived and looked at: what is due (a prompt card, only when
 * something is), the eight goal and hobby circles in one line, the challenges under way, the
 * journal, then this week's commitments.
 */
export default function TodayScreen() {
  const today = useToday();
  const prompts = usePrompts();
  const { current } = useStreaks();
  const month = useMonth(monthOf(today));
  const setupSkipped = !month.setup && !prompts.some((p) => p.kind === 'setup');
  const challenges = useActiveChallenges();

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
        <TodayGroup date={today} />
        {challenges.length ? <ChallengeStack active={challenges} /> : null}
        <JournalGroup date={today} isToday />
        <WeekGroup date={today} />
        <UpkeepRow prompts={prompts} />
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
