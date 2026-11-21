import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { CATEGORY_LABEL, GOAL_CATEGORIES, HOBBY_CATEGORIES, type BankEntry, type Category } from '@/domain/types';
import { usageCounts, usageLabel } from '@/features/setup/usage';
import { Group, Line, ListScreen } from '@/features/past/lists';
import { useMonthsMap } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { Pill } from '@/ui/controls';

/** Goals and hobbies archive: every idea that was ever on a monthly list. */
export default function Archive() {
  const bank = useJournal((s) => s.bank);
  const achievements = useJournal((s) => s.achievements);
  const months = useMonthsMap();
  const counts = useMemo(() => usageCounts(months), [months]);
  const groups: [Category, BankEntry[]][] = [
    ...GOAL_CATEGORIES.map((c) => [c, bank.goals[c]] as [Category, BankEntry[]]),
    ...HOBBY_CATEGORIES.map((c) => [c, bank.hobbies[c]] as [Category, BankEntry[]]),
  ]
    .map(([c, list]) => [c, list.filter((e) => counts.get(e.id))] as [Category, BankEntry[]])
    .filter(([, list]) => list.length);

  return (
    <>
      <Stack.Screen options={{ title: 'Goals and hobbies', headerLargeTitleEnabled: true }} />
      <ListScreen
        explainer="Every goal and hobby you have used. Tap one to see each month it was on your list."
        empty={groups.length ? null : 'Nothing used yet'}
      >
        {groups.map(([c, list]) => (
          <View key={c}>
            <Group label={`${GOAL_CATEGORIES.includes(c as never) ? 'Goal' : 'Hobby'} · ${CATEGORY_LABEL[c]}`}>
              {list
                .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
                .map((e) => (
                  <Line
                    key={e.id}
                    title={e.text}
                    sub={usageLabel(counts.get(e.id) ?? 0)}
                    trailing={
                      achievements.some((a) => a.bankId === e.id) ? (
                        <Pill icon="star.fill" label="Achievement" />
                      ) : undefined
                    }
                    onPress={() => router.push(`/past/item/${e.id}`)}
                  />
                ))}
            </Group>
          </View>
        ))}
      </ListScreen>
    </>
  );
}
