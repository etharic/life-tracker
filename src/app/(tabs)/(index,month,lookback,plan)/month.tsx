import { StyleSheet } from 'react-native';

import { daysInMonth, monthName, monthOf } from '@/domain/dates';
import { daysPassed } from '@/domain/progress';
import { useToday } from '@/features/hooks';
import { MonthView } from '@/features/month/month-view';
import { Screen, TopBar } from '@/ui/layout';
import { T } from '@/ui/text';

export default function MonthScreen() {
  const today = useToday();
  const month = monthOf(today);
  return (
    <Screen topInset>
      <TopBar
        title={monthName(month)}
        trailing={
          <T variant="subhead" tone="ink2" chrome style={styles.tabular}>
            {`Day ${daysPassed(month, today)} of ${daysInMonth(month)}`}
          </T>
        }
      />
      <MonthView month={month} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ['tabular-nums'] },
});
