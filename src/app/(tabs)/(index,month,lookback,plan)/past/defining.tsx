import { Stack } from 'expo-router';

import { DefiningList } from '@/features/past/lists';

export default function Screen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Misogi Rituals', headerLargeTitleEnabled: true }} />
      <DefiningList />
    </>
  );
}
