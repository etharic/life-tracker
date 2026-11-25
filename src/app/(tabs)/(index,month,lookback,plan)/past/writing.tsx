import { Stack } from 'expo-router';

import { WritingDetail } from '@/features/past/stats';
import { Empty, Screen } from '@/ui/layout';
import { useJournal } from '@/state/journal';

/** Words written: this year by month, and every year. */
export default function WritingScreen() {
  const any = useJournal((s) => Object.values(s.days).some((d) => d.writing.trim()));
  return (
    <>
      <Stack.Screen options={{ title: 'Your writing', headerLargeTitleEnabled: false }} />
      <Screen>{any ? <WritingDetail /> : <Empty title="Nothing written yet" />}</Screen>
    </>
  );
}
