import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { Stack } from 'expo-router';
import { Linking, StyleSheet, Switch, useColorScheme, View } from 'react-native';

import { MAX_REMINDERS, type Reminder } from '@/domain/types';
import { applyReminders, askReminderPermission, useReminderState } from '@/reminders/scheduler';
import { useJournal } from '@/state/journal';
import { TextAction } from '@/ui/controls';
import { Divider, Explainer, Screen, Section } from '@/ui/layout';
import { T } from '@/ui/text';
import { palette, space, TARGET } from '@/ui/theme';

const pad = (n: number) => String(n).padStart(2, '0');
const toDate = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};
const fromDate = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Up to three daily reminders to write. Silent on days already written. */
export default function RemindersScreen() {
  const reminders = useJournal((s) => s.settings.reminders);
  const { permission, error } = useReminderState();
  const scheme = useColorScheme();
  const p = palette[scheme === 'dark' ? 'dark' : 'light'];

  const save = (next: Reminder[]) => {
    useJournal.getState().updateSettings((s) => void (s.reminders = next));
    void applyReminders();
  };
  const turnOn = async (next: Reminder[]) => {
    // The system asks once; after a no, the switch stays off and the line below says where to change it.
    if (!(await askReminderPermission())) {
      save(next.map((r) => ({ ...r, on: false })));
      return;
    }
    save(next);
  };
  const set = (i: number, patch: Partial<Reminder>) => {
    const next = reminders.map((r, k) => (k === i ? { ...r, ...patch } : r));
    if (patch.on) void turnOn(next);
    else save(next);
  };
  const add = () => void turnOn([...reminders, { time: reminders.length ? '12:00' : '21:00', on: true }]);
  const remove = (i: number) => save(reminders.filter((_, k) => k !== i));

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Reminders', headerLargeTitleEnabled: true }} />
      <Explainer>
        A gentle reminder to write, at the times you choose. It stays silent on days you have already written.
      </Explainer>
      {reminders.length ? (
        <Section flush>
          {reminders.map((r, i) => (
            <View key={i}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.row}>
                <Switch
                  value={r.on}
                  onValueChange={(on) => set(i, { on })}
                  trackColor={{ true: p.accent }}
                  accessibilityLabel={`Reminder at ${r.time}`}
                />
                <View style={styles.flex}>
                  <DateTimePicker
                    value={toDate(r.time)}
                    mode="time"
                    display="compact"
                    accentColor={p.accent}
                    onValueChange={(_, d) => set(i, { time: fromDate(d) })}
                  />
                </View>
                <TextAction title="Remove" tone="ink2" onPress={() => remove(i)} />
              </View>
            </View>
          ))}
        </Section>
      ) : null}
      {reminders.length < MAX_REMINDERS ? (
        <TextAction title={reminders.length ? 'Add another time' : 'Add a reminder'} onPress={add} />
      ) : null}
      {permission === 'denied' ? (
        <View style={styles.note}>
          <T variant="subhead" tone="ink2">
            Notifications are off for Life-Tracker. Turn them on in Settings.
          </T>
          <TextAction title="Open Settings" onPress={() => void Linking.openSettings()} />
        </View>
      ) : null}
      {error ? (
        <View style={styles.note}>
          <T variant="subhead" tone="ink2">
            {error}
          </T>
          <TextAction title="Try again" onPress={() => void applyReminders()} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: TARGET, padding: space.m },
  flex: { flex: 1, alignItems: 'flex-start' },
  note: { gap: space.s },
});
