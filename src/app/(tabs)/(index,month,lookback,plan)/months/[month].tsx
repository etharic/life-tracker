import { Stack, useLocalSearchParams } from 'expo-router';

import { formatMonth } from '@/domain/dates';
import { MonthView } from '@/features/month/month-view';
import { Empty, Screen } from '@/ui/layout';

/** Any month, opened from Look back. */
export default function AnyMonthScreen() {
  const { month } = useLocalSearchParams<{ month: string }>();
  const valid = typeof month === 'string' && /^\d{4}-\d{2}$/.test(month);
  return (
    <Screen>
      <Stack.Screen options={{ title: valid ? formatMonth(month) : '', headerLargeTitleEnabled: true }} />
      {valid ? <MonthView month={month} /> : <Empty title="This month could not be found" />}
    </Screen>
  );
}
