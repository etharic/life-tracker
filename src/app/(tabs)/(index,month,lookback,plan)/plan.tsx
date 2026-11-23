import { router } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
import { ActionSheetIOS, StyleSheet, View } from 'react-native';

import { addMonths, formatShort, monthName, monthOf } from '@/domain/dates';
import { GOAL_CATEGORIES, HOBBY_CATEGORIES } from '@/domain/types';
import { useMonth, useToday } from '@/features/hooks';
import { MisogiLine } from '@/features/year/plan-line';
import { useSync } from '@/sync/scheduler';
import { useJournal } from '@/state/journal';
import { Icon } from '@/ui/icon';
import { Row, Rows, Screen, Section, TopBar } from '@/ui/layout';
import { colors, space } from '@/ui/theme';
import { Group } from '@/ui/group';

const HOURS = [2, 3, 4, 5, 6];
const hour = (h: number) => `${String(h).padStart(2, '0')}:00`;
const INSET = space.l + 18 + space.m;

/**
 * Plan: what you set up, as quiet lists. Each row says what it is once, with its state on the right.
 *   the year's misogi, Months, Ideas, Keep it safe, Settings
 */
export default function PlanScreen() {
  const today = useToday();
  const month = monthOf(today);
  const next = addMonths(month, 1);
  const cur = useMonth(month);
  const nxt = useMonth(next);
  const bank = useJournal((s) => s.bank);
  const settings = useJournal((s) => s.settings);
  const sync = useSync();

  const goalIdeas = GOAL_CATEGORIES.reduce((n, c) => n + bank.goals[c].filter((e) => !e.retired).length, 0);
  const hobbyIdeas = HOBBY_CATEGORIES.reduce((n, c) => n + bank.hobbies[c].filter((e) => !e.retired).length, 0);

  const chooseHour = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'A new day starts at',
        message: 'Anything you enter before this time belongs to the day before.',
        options: [...HOURS.map(hour), 'Cancel'],
        cancelButtonIndex: HOURS.length,
      },
      (i) => {
        if (i < HOURS.length) useJournal.getState().updateSettings((x) => void (x.dayStartHour = HOURS[i]));
      },
    );
  const icon = (name: SFSymbol) => <Icon name={name} size={18} color={colors.accent} />;

  return (
    <Screen topInset>
      <TopBar title="Plan" />
      <View style={styles.groups}>
        <MisogiLine />
        <Group title="Months">
          <Section flush>
            <Rows inset={INSET}>
              <Row
                leading={icon('calendar')}
                title={monthName(month)}
                value={cur.setup ? 'Set up' : 'Set up now'}
                onPress={() => router.push(`/setup/${month}`)}
              />
              <Row
                leading={icon('calendar.badge.plus')}
                title={monthName(next)}
                value={nxt.setup ? 'Ready' : 'Prepare'}
                onPress={() => router.push(`/setup/${next}`)}
              />
            </Rows>
          </Section>
        </Group>

        <Group title="Ideas">
          <Section flush>
            <Rows inset={INSET}>
              <Row
                leading={icon('lightbulb')}
                title="Goal ideas"
                value={String(goalIdeas)}
                onPress={() => router.push('/bank/goals')}
              />
              <Row
                leading={icon('paintpalette')}
                title="Hobby ideas"
                value={String(hobbyIdeas)}
                onPress={() => router.push('/bank/hobbies')}
              />
            </Rows>
          </Section>
        </Group>

        <Group title="Keep it safe">
          <Section flush>
            <Rows inset={INSET}>
              <Row
                leading={icon('arrow.triangle.2.circlepath')}
                title="Google Drive"
                value={
                  sync.conflicts
                    ? `${sync.conflicts} to check`
                    : sync.connected
                      ? sync.lastSync
                        ? sync.lastSyncLabel
                        : 'On'
                      : 'Off'
                }
                onPress={() => router.push('/drive')}
              />
              <Row
                leading={icon('square.and.arrow.up')}
                title="Export and yearly book"
                value={settings.lastBackup ? formatShort(settings.lastBackup) : undefined}
                onPress={() => router.push('/backup')}
              />
            </Rows>
          </Section>
        </Group>

        <Group title="Settings">
          <Section flush>
            <Rows inset={INSET}>
              <Row
                leading={icon('moon.stars')}
                title="New day starts at"
                value={hour(settings.dayStartHour)}
                trailing={<Icon name="chevron.up.chevron.down" size={12} color={colors.ink3} weight="semibold" />}
                chevron={false}
                onPress={chooseHour}
              />
              <Row
                leading={icon('envelope')}
                title="Note to future readers"
                value={settings.noteToReaders ? 'Written' : undefined}
                onPress={() => router.push('/note')}
              />
              <Row leading={icon('folder')} title="Your files" onPress={() => router.push('/files')} />
            </Rows>
          </Section>
        </Group>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  groups: { gap: space.xxl },
});
