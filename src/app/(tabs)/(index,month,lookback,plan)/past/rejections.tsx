import { Stack } from 'expo-router';

import { ChallengeList } from '@/features/past/challenges';

export default function Screen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Rejection list', headerLargeTitleEnabled: true }} />
      <ChallengeList kind="rejections" />
    </>
  );
}
