import { router, Stack } from 'expo-router';

import { AchievementBanner } from '@/features/achievements';
import { ListScreen } from '@/features/past/lists';
import { useJournal } from '@/state/journal';
import { Press } from '@/ui/press';

export default function Achievements() {
  const list = useJournal((s) => s.achievements);
  const sorted = [...list].sort((a, b) => (a.earned < b.earned ? 1 : -1));
  return (
    <>
      <Stack.Screen options={{ title: 'Achievements', headerLargeTitleEnabled: true }} />
      <ListScreen
        explainer="The same priority goal or skill for three months in a row, on more than 80% of the days. Never taken away."
        empty={sorted.length ? null : 'No achievements yet'}
      >
        {sorted.map((a) => (
          <Press key={`${a.kind}-${a.bankId}-${a.earned}`} onPress={() => router.push(`/past/item/${a.bankId}`)}>
            <AchievementBanner a={a} />
          </Press>
        ))}
      </ListScreen>
    </>
  );
}
