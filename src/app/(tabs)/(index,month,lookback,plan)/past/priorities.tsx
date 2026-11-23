import { Stack } from 'expo-router';

import { PrioritiesList } from '@/features/past/lists';

export default function Screen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Weekly commitments', headerLargeTitleEnabled: true }} />
      <PrioritiesList />
    </>
  );
}
