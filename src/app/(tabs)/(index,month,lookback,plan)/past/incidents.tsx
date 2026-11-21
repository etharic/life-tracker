import { Stack } from 'expo-router';

import { IncidentsList } from '@/features/past/lists';

export default function Screen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Extreme incidents', headerLargeTitleEnabled: true }} />
      <IncidentsList />
    </>
  );
}
