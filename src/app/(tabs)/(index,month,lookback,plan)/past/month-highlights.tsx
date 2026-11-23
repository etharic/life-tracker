import { Stack } from 'expo-router';

import { MonthHighlightsList } from '@/features/past/lists';

export default function Screen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Month highlights', headerLargeTitleEnabled: true }} />
      <MonthHighlightsList />
    </>
  );
}
