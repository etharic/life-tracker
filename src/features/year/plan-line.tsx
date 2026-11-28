import { router } from 'expo-router';
import { ActionSheetIOS, StyleSheet, View } from 'react-native';

import { misogiRibbon } from '@/domain/misogi';
import { misogiOf } from '@/domain/names';
import { useToday } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { AddButton } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { Divider } from '@/ui/layout';
import { Press } from '@/ui/press';
import { Ribbon } from '@/ui/ribbon';
import { T } from '@/ui/text';
import { colors, space, TARGET } from '@/ui/theme';

import { judgeMisogi } from './commit';

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
const prev = (y: string) => String(Number(y) - 1);

/**
 * The misogi on Plan, all year round: a ribbon with this year's one hard thing in the serif and
 * where it stands. It can be set, changed or marked done at any time, not only at the year review.
 * A misogi for year Y is kept on year Y-1's record (it is chosen at that review), so setting or
 * changing it opens that year's editor. Last year's, while still not judged, and next year's, once
 * chosen, show under it.
 */
export function MisogiRibbon() {
  const today = useToday();
  const years = useJournal((s) => s.years);
  const { year: Y, current: cur, last, upcoming } = misogiRibbon(years, today);
  const edit = (forYear: string) => router.push(`/misogi/${prev(forYear)}`);
  const status = !cur
    ? ''
    : cur.status === 'done'
      ? 'done'
      : cur.status === 'not-this-time'
        ? 'not this time'
        : cur.status === 'ask'
          ? 'did you do it?'
          : `${days(cur.days)} left`;

  const open = () => {
    if (!cur) return edit(Y);
    type Action = { label: string; run: () => void };
    const actions: Action[] = [];
    if (cur.status === 'active' || cur.status === 'ask')
      actions.push({
        label: 'Done it',
        run: () => {
          haptic.success();
          void judgeMisogi(Y, true, today);
        },
      });
    actions.push({ label: 'Change it', run: () => edit(Y) });
    actions.push({ label: 'Open the year', run: () => router.push(`/past/year/${prev(Y)}`) });
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: misogiOf(Y),
        message: cur.text,
        options: [...actions.map((a) => a.label), 'Cancel'],
        cancelButtonIndex: actions.length,
      },
      (i) => {
        if (i < actions.length) actions[i].run();
      },
    );
  };

  return (
    <Ribbon label="Misogi" tint={colors.accent} soft={colors.fill}>
      {cur ? (
        <Press
          feedback="highlight"
          onPress={open}
          accessibilityLabel={`${misogiOf(Y)}: ${cur.text}. ${status}`}
          accessibilityHint="Mark it done, change it, or open the year"
          style={styles.line}
        >
          <View style={styles.flex}>
            <T variant="journalTitle">{cur.text}</T>
            <T variant="footnote" tone={cur.status === 'ask' ? 'accent' : 'ink2'}>
              {`${Y}, ${status}`}
            </T>
          </View>
          <Icon name="chevron.right" size={13} color={colors.ink3} weight="semibold" />
        </Press>
      ) : (
        <View style={styles.line}>
          <T variant="body" tone="ink2" style={styles.flex}>
            {`No misogi for ${Y} yet: one hard thing to do this year.`}
          </T>
          <AddButton onPress={() => edit(Y)} label={`Set the misogi for ${Y}`} />
        </View>
      )}
      {last ? (
        <>
          <Divider inset={space.s} />
          <Press
            feedback="highlight"
            onPress={() => router.push(`/past/year/${prev(prev(Y))}`)}
            accessibilityLabel={`${misogiOf(prev(Y))}: ${last.text}. Did you do it?`}
            style={styles.line}
          >
            <View style={styles.flex}>
              <T variant="body">{last.text}</T>
              <T variant="footnote" tone="accent">{`${prev(Y)}, did you do it?`}</T>
            </View>
            <Icon name="chevron.right" size={13} color={colors.ink3} weight="semibold" />
          </Press>
        </>
      ) : null}
      {upcoming ? (
        <>
          <Divider inset={space.s} />
          <Press
            feedback="highlight"
            onPress={() => router.push(`/misogi/${Y}`)}
            accessibilityLabel={`${misogiOf(String(Number(Y) + 1))}: ${upcoming.text}. Starts 1 January. Change it`}
            style={styles.line}
          >
            <View style={styles.flex}>
              <T variant="body">{upcoming.text}</T>
              <T variant="footnote" tone="ink2">{`${Number(Y) + 1}, starts 1 January`}</T>
            </View>
            <Icon name="chevron.right" size={13} color={colors.ink3} weight="semibold" />
          </Press>
        </>
      ) : null}
    </Ribbon>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    minHeight: TARGET + 8,
    paddingHorizontal: space.s,
    paddingVertical: space.s,
  },
});
