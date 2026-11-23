import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { goodDayPatterns, patternDays, SIGNALS } from '@/domain/patterns';
import { useToday } from '@/features/hooks';
import { EntryRow } from '@/features/past/entry-row';
import { useJournal } from '@/state/journal';
import { Divider, Empty, Explainer, Screen, Section } from '@/ui/layout';

/** The days behind one good-day pattern: those with the habit, in the last 90 days, newest first. */
export default function PatternDays() {
  const { signal } = useLocalSearchParams<{ signal: string }>();
  const today = useToday();
  const days = useJournal((s) => s.days);
  const s = SIGNALS.find((x) => x.id === signal);
  const list = useMemo(() => (s ? patternDays(days, today).filter(s.has) : []), [days, today, s]);
  const pattern = useMemo(() => goodDayPatterns(days, today).find((p) => p.signal === signal), [days, today, signal]);
  return (
    <>
      <Stack.Screen options={{ title: s?.label ?? 'Days', headerLargeTitleEnabled: false }} />
      <Screen>
        <Explainer>
          {pattern ? `${pattern.sentence} A pattern in your own days, not a cause.` : 'The last 90 days.'}
        </Explainer>
        {list.length ? (
          <Section flush>
            {list.map((d, i) => (
              <View key={d.date}>
                {i > 0 ? <Divider /> : null}
                <EntryRow day={d} />
              </View>
            ))}
          </Section>
        ) : (
          <Empty title="No days to show" />
        )}
      </Screen>
    </>
  );
}
