import { router, Stack, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Settings, StyleSheet, View } from 'react-native';

import { nextDayBoundary } from '@/domain/dates';
import { startSync } from '@/sync/scheduler';
import { useJournal } from '@/state/journal';
import { Empty } from '@/ui/layout';
import { colors } from '@/ui/theme';

void SplashScreen.preventAutoHideAsync();

const modal = { presentation: 'modal', headerShown: false, contentStyle: { backgroundColor: colors.bg } } as const;

export default function RootLayout() {
  const status = useJournal((s) => s.status);
  const error = useJournal((s) => s.error);
  const dayStartHour = useJournal((s) => s.settings.dayStartHour);

  useEffect(() => {
    void useJournal
      .getState()
      .init()
      .finally(() => void SplashScreen.hideAsync());
  }, []);

  useEffect(() => {
    if (status === 'ready') return startSync();
  }, [status]);

  // Simulator screenshots open a screen with the launch argument `-LTRoute /month`
  // (deep links there ask "Open in Life-Tracker?" first). Unused on a phone.
  useEffect(() => {
    if (status !== 'ready') return;
    const route: unknown = Settings.get('LTRoute');
    if (typeof route === 'string' && route.startsWith('/')) {
      const t = setTimeout(() => router.navigate(route as Href), 500);
      return () => clearTimeout(t);
    }
  }, [status]);

  // The journal date changes at the day boundary (04:00 by default), also while the app is open.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      const ms = nextDayBoundary(new Date(), dayStartHour).getTime() - Date.now();
      timer = setTimeout(
        () => {
          useJournal.getState().refreshToday();
          arm();
        },
        Math.min(ms + 1000, 2 ** 31 - 1),
      );
    };
    arm();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        useJournal.getState().refreshToday();
        arm();
      }
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [dayStartHour]);

  if (status === 'loading') return <View style={styles.fill} />;
  if (status === 'error') {
    return (
      <View style={[styles.fill, styles.center]}>
        <Empty title="The journal could not be opened" body={error ?? undefined} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="close-day/[date]" options={modal} />
        <Stack.Screen name="record/[date]" options={modal} />
        <Stack.Screen name="setup/[month]" options={{ ...modal, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="week-close/[week]" options={modal} />
        <Stack.Screen name="week-start/[week]" options={modal} />
        <Stack.Screen name="month-close/[month]" options={{ ...modal, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="year-close/[year]" options={modal} />
        <Stack.Screen name="conflict/[id]" options={modal} />
        <Stack.Screen name="rejection/[id]" options={modal} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center' },
});
