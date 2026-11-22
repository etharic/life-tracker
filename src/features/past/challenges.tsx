import { router, type Href } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
import { useMemo, useRef } from 'react';
import { ActionSheetIOS, StyleSheet, View } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';

import { formatFull } from '@/domain/dates';
import { challengeCounts, type ChallengeItem, type ChallengeKind, type ChallengeOutcome } from '@/domain/types';
import { useJournal } from '@/state/journal';
import { Button } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { Divider, Empty, Explainer, Screen, Section, SectionLabel } from '@/ui/layout';
import { enterPop } from '@/ui/motion';
import { Press } from '@/ui/press';
import { SwipeRow } from '@/ui/swipe-row';
import { T } from '@/ui/text';
import { colors, radius, space } from '@/ui/theme';

/** The words of each list. */
export const CHALLENGE_COPY: Record<
  ChallengeKind,
  {
    title: string;
    icon: SFSymbol;
    noun: string;
    add: string;
    failed: string;
    succeeded: string;
    question: string;
    placeholder: string;
    explainer: string;
    empty: string;
    emptyBody: string;
  }
> = {
  rejections: {
    title: 'Rejection list',
    icon: 'xmark.seal',
    noun: 'attempt',
    add: 'Log an attempt',
    failed: 'Rejected',
    succeeded: 'Successful',
    question: 'What are you going for?',
    placeholder: 'Applied to the summer internship at…',
    explainer:
      'Go for the things you expect to be turned down for. Tap the box when you go for one, then swipe: right for a yes, left for a no.',
    empty: 'Nothing logged yet',
    emptyBody: 'An application, an email, an ask: anything you expect a no for.',
  },
  bucket: {
    title: 'Bucket list',
    icon: 'list.star',
    noun: 'item',
    add: 'Add to the list',
    failed: 'Failed',
    succeeded: 'Done',
    question: 'What do you want to do?',
    placeholder: 'See the northern lights',
    explainer:
      'Everything you want to do in your life. Tap the box when you start one, then swipe: right when it is done, left if it failed.',
    empty: 'Nothing on the list yet',
    emptyBody: 'Places to see, things to learn, things to try once.',
  },
};

/** Where each list lives. A new list needs a kind, its words above, a file and this route. */
export const CHALLENGE_ROUTE: Record<ChallengeKind, Href> = {
  rejections: '/past/rejections',
  bucket: '/past/bucket',
};

/** Newest first: by the date given, or the day it was logged. */
function newestFirst(a: ChallengeItem, b: ChallengeItem): number {
  const da = a.date ?? a.added;
  const db = b.date ?? b.added;
  return da === db ? (a.added < b.added ? 1 : -1) : da < db ? 1 : -1;
}

function Stat({ value, label, color }: { value: number; label: string; color: typeof colors.ink }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <T variant="title" style={[styles.number, { color }]}>
        {String(value)}
      </T>
      <T variant="footnote" tone="ink2" center numberOfLines={1}>
        {label}
      </T>
    </View>
  );
}

/** The totals, with a thin bar of how the list stands. */
function Totals({ kind, list }: { kind: ChallengeKind; list: ChallengeItem[] }) {
  const copy = CHALLENGE_COPY[kind];
  const { total, active, failed, succeeded } = challengeCounts(list);
  const rest = total - active - failed - succeeded;
  return (
    <Section>
      <View style={styles.totals}>
        <View style={styles.stats}>
          <Stat value={total} label={kind === 'bucket' ? 'On the list' : 'Logged'} color={colors.ink} />
          <View style={styles.rule} />
          <Stat value={active} label="Active" color={colors.ink} />
          <View style={styles.rule} />
          <Stat value={failed} label={copy.failed} color={colors.accent} />
          <View style={styles.rule} />
          <Stat value={succeeded} label={copy.succeeded} color={colors.good} />
        </View>
        {total ? (
          <View style={styles.bar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {failed ? <View style={{ flex: failed, backgroundColor: colors.accent }} /> : null}
            {succeeded ? <View style={{ flex: succeeded, backgroundColor: colors.good }} /> : null}
            {active ? <View style={{ flex: active, backgroundColor: colors.boxBorder }} /> : null}
            {rest ? <View style={{ flex: rest }} /> : null}
          </View>
        ) : null}
      </View>
    </Section>
  );
}

/**
 * The box in front of each item: empty until it is started, a flame while it is active, and the
 * cross or tick once it has ended either way.
 */
function StatusBox({ item, kind, onPress }: { item: ChallengeItem; kind: ChallengeKind; onPress: () => void }) {
  const copy = CHALLENGE_COPY[kind];
  const state =
    item.outcome === 'failed'
      ? copy.failed
      : item.outcome === 'succeeded'
        ? copy.succeeded
        : item.started
          ? 'Active'
          : 'Not started';
  const box =
    item.outcome === 'failed'
      ? styles.boxFailed
      : item.outcome === 'succeeded'
        ? styles.boxSucceeded
        : item.started
          ? styles.boxActive
          : null;
  return (
    <Press
      onPress={onPress}
      hitSlop={10}
      colorTransition
      style={[styles.box, box]}
      accessibilityRole="button"
      accessibilityLabel={`${state}. ${item.title}`}
      accessibilityHint={
        item.outcome === 'open' ? (item.started ? 'Marks it not started' : 'Marks it active') : undefined
      }
    >
      <LayoutAnimationConfig skipEntering>
        <Animated.View key={`${item.outcome}-${item.started}`} entering={enterPop}>
          {item.outcome === 'failed' ? (
            <Icon name="xmark" size={14} weight="bold" color={colors.onAccent} />
          ) : item.outcome === 'succeeded' ? (
            <Icon name="checkmark" size={14} weight="bold" color={colors.onAccent} />
          ) : item.started ? (
            <Icon name="flame.fill" size={14} color={colors.accent} />
          ) : null}
        </Animated.View>
      </LayoutAnimationConfig>
    </Press>
  );
}

/**
 * One item: the status box, then the title. Swipe right for a success, left for a failure; tap to
 * edit; long press for Edit or Delete. `caption` names its list where items from several lists meet.
 */
export function ChallengeRow({ item, kind, caption }: { item: ChallengeItem; kind: ChallengeKind; caption?: string }) {
  const copy = CHALLENGE_COPY[kind];
  const swiped = useRef(0);
  const save = (patch: Partial<ChallengeItem>) => useJournal.getState().saveChallenge(kind, { ...item, ...patch });

  const conclude = (outcome: ChallengeOutcome) => {
    if (item.outcome === outcome) {
      // The same swipe again takes it back: active, not ended.
      haptic.select();
      save({ outcome: 'open', started: true });
      return;
    }
    if (outcome === 'succeeded') haptic.success();
    else haptic.commit();
    save({ outcome, started: true });
  };

  const toggleStarted = () => {
    if (item.outcome !== 'open') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `${item.outcome === 'failed' ? copy.failed : copy.succeeded}: ${item.title}`,
          options: ['Make it active again', 'Cancel'],
          cancelButtonIndex: 1,
        },
        (i) => {
          if (i === 0) {
            haptic.select();
            save({ outcome: 'open', started: true });
          }
        },
      );
      return;
    }
    haptic.select();
    save({ started: !item.started });
  };

  const open = () => {
    if (Date.now() - swiped.current < 500) return;
    router.push(`/challenge/${kind}/${item.id}`);
  };

  const menu = () => {
    haptic.select();
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: item.title,
        options: ['Edit', `Delete ${copy.noun}`, 'Cancel'],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
      },
      (i) => {
        if (i === 0) router.push(`/challenge/${kind}/${item.id}`);
        if (i === 1) useJournal.getState().removeChallenge(kind, item.id);
      },
    );
  };

  const sub = [caption, item.date ? formatFull(item.date) : null].filter(Boolean).join(', ') || null;
  return (
    <SwipeRow
      right={{
        label: item.outcome === 'succeeded' ? 'Undo' : copy.succeeded,
        icon: item.outcome === 'succeeded' ? 'arrow.uturn.backward' : 'checkmark',
        color: colors.good,
      }}
      left={{
        label: item.outcome === 'failed' ? 'Undo' : copy.failed,
        icon: item.outcome === 'failed' ? 'arrow.uturn.backward' : 'xmark',
        color: colors.accent,
      }}
      onSwipe={(d) => conclude(d === 'right' ? 'succeeded' : 'failed')}
      onSwipeStart={() => (swiped.current = Date.now())}
    >
      <View
        style={styles.item}
        accessible={false}
        accessibilityActions={[
          { name: 'succeeded', label: copy.succeeded },
          { name: 'failed', label: copy.failed },
          { name: 'delete', label: 'Delete' },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'delete') useJournal.getState().removeChallenge(kind, item.id);
          else conclude(e.nativeEvent.actionName as ChallengeOutcome);
        }}
      >
        <StatusBox item={item} kind={kind} onPress={toggleStarted} />
        <View style={styles.itemCell}>
          <Press
            feedback="highlight"
            onPress={open}
            onLongPress={menu}
            style={styles.itemText}
            accessibilityLabel={[item.title, sub].filter(Boolean).join(', ')}
            accessibilityHint="Opens it to edit. Swipe right or left to mark how it went."
          >
            <T variant="body" weight="500" numberOfLines={2} tone={item.outcome === 'open' ? 'ink' : 'ink2'}>
              {item.title}
            </T>
            {sub || item.notes ? (
              <View style={styles.subRow}>
                {sub ? (
                  <T variant="footnote" tone="ink2">
                    {sub}
                  </T>
                ) : (
                  // No date: the first line of the notes says more than an icon would.
                  <T variant="footnote" tone="ink2" numberOfLines={1} style={styles.notesLine}>
                    {item.notes.split('\n')[0]}
                  </T>
                )}
                {sub && item.notes ? <Icon name="text.alignleft" size={11} color={colors.ink3} /> : null}
              </View>
            ) : null}
          </Press>
        </View>
      </View>
    </SwipeRow>
  );
}

function Block({ label, items, kind }: { label: string; items: ChallengeItem[]; kind: ChallengeKind }) {
  if (!items.length) return null;
  return (
    <View style={styles.block}>
      <SectionLabel>{label}</SectionLabel>
      <Section flush>
        {items.map((it, i) => (
          <View key={it.id}>
            {i > 0 ? <Divider inset={space.l + 30 + space.m} /> : null}
            <ChallengeRow item={it} kind={kind} />
          </View>
        ))}
      </Section>
    </View>
  );
}

/** Look back > Challenges: one list, grouped as active, not started yet, and ended. */
export function ChallengeList({ kind }: { kind: ChallengeKind }) {
  const copy = CHALLENGE_COPY[kind];
  const items = useJournal((s) => s.challenges[kind]);
  const groups = useMemo(() => {
    const sorted = [...items].sort(newestFirst);
    return {
      active: sorted.filter((r) => r.outcome === 'open' && r.started),
      todo: sorted.filter((r) => r.outcome === 'open' && !r.started),
      ended: sorted.filter((r) => r.outcome !== 'open'),
    };
  }, [items]);
  return (
    <Screen>
      <Explainer>{copy.explainer}</Explainer>
      <Totals kind={kind} list={items} />
      <Button title={copy.add} icon="plus" onPress={() => router.push(`/challenge/${kind}/new`)} />
      {items.length ? (
        <>
          <Block label="Active" items={groups.active} kind={kind} />
          <Block label="Not started" items={groups.todo} kind={kind} />
          <Block label={kind === 'bucket' ? 'Finished' : 'Answered'} items={groups.ended} kind={kind} />
        </>
      ) : (
        <Empty title={copy.empty} body={copy.emptyBody} />
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
  block: { gap: space.s },
  item: { flexDirection: 'row', alignItems: 'center', paddingLeft: space.l },
  itemCell: { flex: 1, minWidth: 0 },
  itemText: { paddingLeft: space.m, paddingRight: space.l, paddingVertical: space.m, gap: 2 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  notesLine: { flexShrink: 1 },
  box: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.boxBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  boxFailed: { borderColor: colors.accent, backgroundColor: colors.accent },
  boxSucceeded: { borderColor: colors.good, backgroundColor: colors.good },
});
