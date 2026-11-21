import { Stack } from 'expo-router';

import { ExtremesList } from '@/features/past/lists';

export default function Screen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Kevin’s Rules', headerLargeTitleEnabled: true }} />
      <ExtremesList />
    </>
  );
}
