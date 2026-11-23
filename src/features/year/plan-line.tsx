import { router } from 'expo-router';
import { ActionSheetIOS, StyleSheet, View } from 'react-native';

import { planLine } from '@/domain/misogi';
import { misogiOf } from '@/domain/names';
import { usePrompts, useToday } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, space, TARGET } from '@/ui/theme';
import { judgeMisogi } from './commit';

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/**
 * The year's intention at the top of Plan: "Misogi 2027", the challenge in the serif, and where
 * it stands. During its year a tap offers "Done it?"; once its year is over, "Did you do it?"
 * opens the year page. Hidden while the year-review card is showing, so it is never asked twice.
 */
export function MisogiLine() {
  const today = useToday();
  const years = useJournal((s) => s.years);
  const cardShowing = usePrompts().some((p) => p.kind === 'year-close');
  const line = planLine(years, today, cardShowing);
  if (!line) return null;

  const status =
    line.state === 'upcoming'
      ? 'Starts 1 January'
      : line.state === 'active'
        ? `${days(line.daysLeft)} left`
        : line.state === 'done'
          ? 'Done'
          : 'Did you do it?';
  const yearPage = () => router.push(`/past/year/${line.year}`);
  const onPress = () => {
    if (line.state !== 'active') return yearPage();
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: misogiOf(line.year),
        message: line.text,
        options: ['Done it', 'Open the year', 'Cancel'],
        cancelButtonIndex: 2,
      },
      (i) => {
        if (i === 0) {
          haptic.success();
          void judgeMisogi(line.year, true, today);
        } else if (i === 1) yearPage();
      },
    );
  };

  return (
    <Press
      feedback="highlight"
      onPress={onPress}
      accessibilityLabel={`${misogiOf(line.year)}: ${line.text}. ${status}`}
      accessibilityHint={line.state === 'active' ? 'Mark it done, or open the year' : 'Opens the year'}
      style={styles.wrap}
    >
      <View style={styles.flex}>
        <T variant="footnote" tone="ink2">
          {misogiOf(line.year)}
        </T>
        <T variant="journalTitle">{line.text}</T>
        <T variant="footnote" tone={line.state === 'ask' ? 'accent' : 'ink2'}>
          {status}
        </T>
      </View>
      <Icon name="chevron.right" size={13} color={colors.ink3} weight="semibold" />
    </Press>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: TARGET, paddingVertical: space.xs },
  flex: { flex: 1, gap: 2 },
});
