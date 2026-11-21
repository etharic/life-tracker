import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatFull } from '@/domain/dates';
import { rejectionCounts, type Rejection, type RejectionOutcome } from '@/domain/types';
import { useJournal } from '@/state/journal';
import { Button } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { Divider, Empty, Explainer, Screen, Section } from '@/ui/layout';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, radius, space } from '@/ui/theme';

/** Newest first: by the date it was done, or the day it was logged. */
export function sortRejections(list: Rejection[]): Rejection[] {
  return [...list].sort((a, b) => {
    const da = a.date ?? a.added;
    const db = b.date ?? b.added;
    return da === db ? (a.added < b.added ? 1 : -1) : da < db ? 1 : -1;
  });
}

function Stat({ value, label, color }: { value: number; label: string; color: typeof colors.ink }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <T variant="largeTitle" style={[styles.number, { color }]}>
        {String(value)}
      </T>
      <T variant="footnote" tone="ink2" center>
        {label}
      </T>
    </View>
  );
}

/** The three totals, with a thin bar of how the answers split (waiting stays empty track). */
function Totals({ list }: { list: Rejection[] }) {
  const { total, rejected, accepted } = rejectionCounts(list);
  return (
    <Section>
      <View style={styles.totals}>
        <View style={styles.stats}>
          <Stat value={total} label="Logged" color={colors.ink} />
          <View style={styles.rule} />
          <Stat value={rejected} label="Rejected" color={colors.accent} />
          <View style={styles.rule} />
          <Stat value={accepted} label="Successful" color={colors.good} />
        </View>
        {total ? (
          <View style={styles.bar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {rejected ? <View style={{ flex: rejected, backgroundColor: colors.accent }} /> : null}
            {accepted ? <View style={{ flex: accepted, backgroundColor: colors.good }} /> : null}
            {total - rejected - accepted ? <View style={{ flex: total - rejected - accepted }} /> : null}
          </View>
        ) : null}
      </View>
    </Section>
  );
}

function Mark({
  kind,
  on,
  onPress,
  title,
}: {
  kind: 'rejected' | 'accepted';
  on: boolean;
  onPress: () => void;
  title: string;
}) {
  const tint = kind === 'rejected' ? colors.accent : colors.good;
  return (
    <Press
      onPress={onPress}
      hitSlop={4}
      style={[styles.mark, on ? { backgroundColor: tint, borderColor: tint } : null]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${kind === 'rejected' ? 'Rejected' : 'Successful'}: ${title}`}
    >
      <Icon
        name={kind === 'rejected' ? 'xmark' : 'checkmark'}
        size={15}
        weight="bold"
        color={on ? colors.onAccent : colors.ink3}
      />
    </Press>
  );
}

function Item({ r }: { r: Rejection }) {
  const set = (outcome: RejectionOutcome) => {
    const next = r.outcome === outcome ? 'waiting' : outcome;
    if (next === 'accepted') haptic.success();
    else haptic.select();
    useJournal.getState().saveRejection({ ...r, outcome: next });
  };
  const sub = [r.date ? formatFull(r.date) : null, r.outcome === 'waiting' ? 'Waiting' : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={styles.item}>
      <View style={styles.itemCell}>
        <Press
          feedback="highlight"
          onPress={() => router.push(`/rejection/${r.id}`)}
          style={styles.itemText}
          accessibilityLabel={[r.title, sub].filter(Boolean).join(', ')}
          accessibilityHint="Opens the notes"
        >
          <T variant="body" weight="500" numberOfLines={2}>
            {r.title}
          </T>
          {sub || r.notes ? (
            <View style={styles.subRow}>
              {sub ? (
                <T variant="footnote" tone="ink2">
                  {sub}
                </T>
              ) : null}
              {r.notes ? <Icon name="text.alignleft" size={11} color={colors.ink3} /> : null}
            </View>
          ) : null}
        </Press>
      </View>
      <View style={styles.marks}>
        <Mark kind="rejected" on={r.outcome === 'rejected'} onPress={() => set('rejected')} title={r.title} />
        <Mark kind="accepted" on={r.outcome === 'accepted'} onPress={() => set('accepted')} title={r.title} />
      </View>
    </View>
  );
}

/** Challenges > Rejection list: chase the no. Log every attempt, then mark how it went. */
export function RejectionList() {
  const rejections = useJournal((s) => s.rejections);
  const list = useMemo(() => sortRejections(rejections), [rejections]);
  return (
    <Screen>
      <Explainer>
        Go for the things you expect to be turned down for. Log each attempt, then mark it: a cross for a no, a tick for
        a yes.
      </Explainer>
      <Totals list={list} />
      <Button title="Log an attempt" icon="plus" onPress={() => router.push('/rejection/new')} />
      {list.length ? (
        <Section flush>
          {list.map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <Divider /> : null}
              <Item r={r} />
            </View>
          ))}
        </Section>
      ) : (
        <Empty title="Nothing logged yet" body="An application, an email, an ask: anything you expect a no for." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  totals: { gap: space.m },
  stats: { flexDirection: 'row', alignItems: 'stretch' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  number: { fontVariant: ['tabular-nums'] },
  rule: { width: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginVertical: space.xs },
  bar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.track,
  },
  item: { flexDirection: 'row', alignItems: 'center', paddingRight: space.l },
  itemCell: { flex: 1, minWidth: 0 },
  itemText: { paddingLeft: space.l, paddingRight: space.m, paddingVertical: space.m, gap: 2 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  marks: { flexDirection: 'row', gap: space.s, flexShrink: 0 },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
