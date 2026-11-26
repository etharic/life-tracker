import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActionSheetIOS, Settings, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { CHALLENGE_KINDS, type ChallengeItem, type ChallengeKind, type ChallengeOutcome } from '@/domain/types';
import { CHALLENGE_COPY, ChallengeRow } from '@/features/past/challenges';
import { useJournal } from '@/state/journal';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { Divider } from '@/ui/layout';
import { enterSoft, exitSoft, layoutMove, RM } from '@/ui/motion';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, radius, space, TARGET } from '@/ui/theme';

import type { ActiveChallenge } from './today-board';

/** Where the rows' text starts: past the status box. */
const INSET = space.l + 30 + space.m;

/**
 * Challenges on Today, folded to one line: its name and how many are under way. A tap opens the
 * tile under it, with every active challenge from every list as on the lists themselves (swipe
 * right when it worked, left when it did not; tap to edit, where an experiment takes its
 * observations) and one row to start a new one on any list.
 */
export function ChallengesTile({ active }: { active: ActiveChallenge[] }) {
  const [open, setOpen] = useState(false);
  // Simulator check only: `-LTOpen challenge` opens the tile, as a tap does. Unused on a phone.
  useEffect(() => {
    const seq: unknown = Settings.get('LTOpen');
    if (typeof seq !== 'string' || !seq.includes('challenge')) return;
    const t = setTimeout(() => setOpen(true), 1600);
    return () => clearTimeout(t);
  }, []);
  const [ended, setEnded] = useState<{ kind: ChallengeKind; before: ChallengeItem; outcome: ChallengeOutcome } | null>(
    null,
  );
  useEffect(() => {
    if (!ended) return;
    const t = setTimeout(() => setEnded(null), 6000);
    return () => clearTimeout(t);
  }, [ended]);
  const turn = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(open ? '180deg' : '0deg', { duration: 220, reduceMotion: RM }) }],
  }));

  const add = () => {
    const kinds = [...CHALLENGE_KINDS];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Start a challenge on',
        options: [...kinds.map((k) => CHALLENGE_COPY[k].title), 'Cancel'],
        cancelButtonIndex: kinds.length,
      },
      (i) => {
        if (i < kinds.length) router.push(`/challenge/${kinds[i]}/new?start=1`);
      },
    );
  };

  return (
    <Animated.View layout={layoutMove} style={styles.wrap}>
      <Press
        feedback="highlight"
        onPress={() => {
          haptic.select();
          setOpen((o) => !o);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Challenges, ${active.length ? `${active.length} under way` : 'none under way'}`}
        style={styles.head}
      >
        <T variant="headline" accessibilityRole="header" style={styles.flex}>
          Challenges
        </T>
        {active.length ? (
          <T variant="subhead" tone="ink2" style={styles.tabular}>
            {`${active.length} under way`}
          </T>
        ) : null}
        <Animated.View style={turn}>
          <Icon name="chevron.down" size={13} color={colors.ink3} weight="semibold" />
        </Animated.View>
      </Press>
      {open ? (
        <Animated.View entering={enterSoft} exiting={exitSoft} style={styles.tile}>
          {ended ? (
            <Animated.View entering={enterSoft} exiting={exitSoft} style={styles.undoRow}>
              <T variant="subhead" tone="ink2" numberOfLines={1} style={styles.flex}>
                {`${ended.outcome === 'failed' ? CHALLENGE_COPY[ended.kind].failed : CHALLENGE_COPY[ended.kind].succeeded}: ${ended.before.title}`}
              </T>
              <Press
                onPress={() => {
                  haptic.select();
                  useJournal.getState().saveChallenge(ended.kind, ended.before);
                  setEnded(null);
                }}
                accessibilityLabel={`Undo, ${ended.before.title}`}
                style={styles.undo}
              >
                <T variant="subhead" weight="600" tone="accent">
                  Undo
                </T>
              </Press>
            </Animated.View>
          ) : null}
          {active.map(({ kind, item }, i) => (
            <Animated.View key={`${kind}/${item.id}`} exiting={exitSoft} layout={layoutMove}>
              {i > 0 || ended ? <Divider inset={INSET} /> : null}
              <ChallengeRow
                item={item}
                kind={kind}
                caption={CHALLENGE_COPY[kind].title}
                onConcluded={(before, outcome) => setEnded({ kind, before, outcome })}
              />
            </Animated.View>
          ))}
          {active.length || ended ? <Divider inset={INSET} /> : null}
          <Press feedback="highlight" onPress={add} accessibilityLabel="Start a new challenge" style={styles.addRow}>
            <View style={styles.addIcon}>
              <Icon name="plus" size={15} color={colors.accent} weight="semibold" />
            </View>
            <T variant="body" tone="accent" style={styles.flex}>
              {active.length ? 'Start another' : 'Start a challenge'}
            </T>
          </Press>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  wrap: { gap: space.s },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    minHeight: TARGET,
    paddingHorizontal: space.xs,
    borderRadius: radius.control,
  },
  tile: {
    borderRadius: radius.section,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  undoRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: TARGET, paddingLeft: space.l },
  undo: { minHeight: TARGET, justifyContent: 'center', paddingHorizontal: space.l },
  addRow: { flexDirection: 'row', alignItems: 'center', minHeight: TARGET + 8, paddingRight: space.l },
  addIcon: { width: INSET, paddingLeft: space.l + 7 },
});
