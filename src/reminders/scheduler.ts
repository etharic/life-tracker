import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { enabledTimes, REMINDER_BODY, REMINDER_TITLE, reminderSchedule } from '../domain/reminders';
import { SETTINGS } from '../format/paths';
import { onLocalWrite, useJournal } from '../state/journal';
import { logError } from '../storage/error-log';
import { serialQueue } from './queue';

/**
 * Daily reminders to write, as local notifications only (no server, no push entitlement). The
 * whole schedule is rebuilt from the journal: at launch, on return to the app, when the app goes
 * to the background, and two seconds after a day or the settings are saved.
 */

export type ReminderPermission = 'granted' | 'denied' | 'undetermined';

interface ReminderState {
  permission: ReminderPermission;
  /** Set when the system refused to schedule; cleared by the next successful rebuild. */
  error: string | null;
}

export const useReminderState = create<ReminderState>()(() => ({ permission: 'undetermined', error: null }));

// While the app is open the reminder is not needed: it stays out of the way.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const run = serialQueue();

function permissionOf(p: Notifications.NotificationPermissionsStatus): ReminderPermission {
  if (p.granted) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

async function rebuild(): Promise<void> {
  const { settings, days } = useJournal.getState();
  try {
    const times = enabledTimes(settings);
    const perm = permissionOf(await Notifications.getPermissionsAsync());
    useReminderState.setState({ permission: perm });
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!times.length || perm !== 'granted') {
      useReminderState.setState({ error: null });
      return;
    }
    for (const r of reminderSchedule(settings, days, new Date())) {
      await Notifications.scheduleNotificationAsync({
        content: { title: REMINDER_TITLE, body: REMINDER_BODY },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at },
      });
    }
    useReminderState.setState({ error: null });
  } catch (e) {
    logError(e, 'background');
    useReminderState.setState({ error: 'Reminders could not be set. Try again.' });
  }
}

/** Rebuilds the schedule, after any rebuild already running. */
export function applyReminders(): Promise<void> {
  return run(rebuild);
}

/** Asks for permission (the system asks only once). Resolves with whether reminders may show. */
export async function askReminderPermission(): Promise<boolean> {
  const p = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  const perm = permissionOf(p);
  useReminderState.setState({ permission: perm });
  return perm === 'granted';
}

const isDay = (path: string) => /\/\d{4}-\d{2}-\d{2}\.md$/.test(path);

/** Keeps the schedule current. Returns a stop function. */
export function startReminders(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    void applyReminders();
  };
  void applyReminders();
  const stopWrites = onLocalWrite((path) => {
    if (!isDay(path) && path !== SETTINGS) return;
    clearTimeout(timer);
    timer = setTimeout(flush, 2000);
  });
  const sub = AppState.addEventListener('change', (s) => {
    // Leaving the app right after a save: rebuild now, so tonight's reminder knows the day is written.
    if (s === 'background' || s === 'active') flush();
  });
  return () => {
    clearTimeout(timer);
    stopWrites();
    sub.remove();
  };
}
