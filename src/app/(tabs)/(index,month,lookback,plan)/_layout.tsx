import { Stack } from 'expo-router/stack';
import { useColorScheme } from 'react-native';

import { colors, palette, SERIF } from '@/ui/theme';

export const unstable_settings = {
  index: { anchor: 'index' },
  month: { anchor: 'month' },
  lookback: { anchor: 'lookback' },
  plan: { anchor: 'plan' },
};

const TITLES: Record<string, string> = { index: 'Today', month: 'Month', lookback: 'Look back', plan: 'Plan' };

/**
 * One stack per tab, sharing the pushed screens (any day, any month, Look back lists),
 * so the tab bar stays visible everywhere.
 */
export default function TabStack({ segment }: { segment: string }) {
  const root = segment.match(/\((.*)\)/)?.[1] ?? 'index';
  // The native navigation bar takes plain colours, so it gets the palette of the current appearance.
  const p = palette[useColorScheme() === 'dark' ? 'dark' : 'light'];
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.bg },
        headerStyle: { backgroundColor: p.bg },
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerLargeStyle: { backgroundColor: p.bg },
        headerTintColor: p.accent,
        // Every page title in the app's serif, like the tab pages' own titles (New York on iOS).
        headerTitleStyle: { color: p.ink, fontFamily: SERIF, fontWeight: '600' },
        headerLargeTitleStyle: { color: p.ink, fontFamily: SERIF, fontWeight: '600' },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      {/* Tab screens draw one compact title line themselves: no empty bar above it. Pushed screens keep the native bar. */}
      <Stack.Screen name={root} options={{ title: TITLES[root] ?? '', headerShown: false }} />
    </Stack>
  );
}
