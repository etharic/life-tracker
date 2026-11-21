import { Stack } from 'expo-router';

import { RejectionList } from '@/features/past/rejections';

export default function Screen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Rejection list', headerLargeTitleEnabled: true }} />
      <RejectionList />
    </>
  );
}
