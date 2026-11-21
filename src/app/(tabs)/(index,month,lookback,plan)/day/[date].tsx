import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { formatTitle, isISODate, monthOf } from '@/domain/dates';
import { JournalGroup, NoSetupNote, TodayGroup, WeekGroup } from '@/features/day/day-layout';
import { useMonth, useToday } from '@/features/hooks';
import { Button } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Empty, Screen } from '@/ui/layout';
import { space } from '@/ui/theme';

/** Any day. A past one is read-only until Edit is chosen and confirmed; fixing a tick then recomputes
 * rings, streaks and achievements. */
export default function DayScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const today = useToday();
  const valid = isISODate(date);
  const month = useMonth(monthOf(valid ? date : today));
  const [editing, setEditing] = useState(false);

  if (!valid || date > today) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '' }} />
        <Empty title="This day has not come yet" />
      </Screen>
    );
  }

  const past = date < today;
  const locked = past && !editing;
  const askToEdit = () =>
    Alert.alert(
      `Edit ${formatTitle(date)}?`,
      'Changes to a past day also update your rings, streaks and achievements.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Edit',
          onPress: () => {
            haptic.select();
            setEditing(true);
          },
        },
      ],
    );

  // A past day reads like an entry first: the journal, then that day's goals and hobbies, then its week.
  // It is shown as it was; Edit at the bottom, once confirmed, opens it for changes.
  return (
    <Screen>
      <Stack.Screen options={{ title: formatTitle(date) }} />
      {!month.setup && !locked ? <NoSetupNote date={date} /> : null}
      <View style={styles.groups}>
        <JournalGroup date={date} isToday={date === today} full locked={locked} />
        <TodayGroup date={date} locked={locked} />
        <WeekGroup date={date} locked={locked} />
      </View>
      {past ? (
        <Button
          title={editing ? 'Done editing' : 'Edit this day'}
          kind={editing ? 'primary' : 'secondary'}
          icon={editing ? 'checkmark' : 'pencil'}
          onPress={editing ? () => setEditing(false) : askToEdit}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  groups: { gap: space.xxl },
});
