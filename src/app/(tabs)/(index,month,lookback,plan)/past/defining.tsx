import { Stack } from 'expo-router';

import { DefiningList } from '@/features/past/lists';
import { NAMES } from '@/domain/names';

export default function Screen() {
  return (
    <>
      <Stack.Screen options={{ title: NAMES.definingPlural, headerLargeTitleEnabled: true }} />
      <DefiningList />
    </>
  );
}
