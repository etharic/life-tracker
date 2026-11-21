import { Stack } from 'expo-router';

import { HighlightsList } from '@/features/past/lists';

export default function Screen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Weekly highlights', headerLargeTitleEnabled: true }} />
      <HighlightsList />
    </>
  );
}
