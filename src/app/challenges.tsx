import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActionSheetIOS, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CHALLENGE_KINDS, type ChallengeItem, type ChallengeKind, type ChallengeOutcome } from '@/domain/types';
import { useActiveChallenges } from '@/features/day/day-layout';
import { CHALLENGE_COPY, ChallengeRow } from '@/features/past/challenges';
import { useJournal } from '@/state/journal';
import { AddButton } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Divider, Screen, Section } from '@/ui/layout';
import { ModalHeader } from '@/ui/modal';
import { enterSoft, exitSoft, layoutMove } from '@/ui/motion';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, GUTTER, space, TARGET } from '@/ui/theme';

/** Where the rows' text starts: past the status box. */
const INSET = space.l + 30 + space.m;

/**
 * The challenges screen, opened from Today as the journal is: every active challenge from every
 * list, each row as on its own list (swipe right when it worked, left when it did not, Undo for a
 * few seconds, tap to edit). The + in the page's bottom right corner starts a new one on any list.
 */
export default function ChallengesScreen() {
  const active = useActiveChallenges();
  const insets = useSafeAreaInsets();
  const [ended, setEnded] = useState<{ kind: ChallengeKind; before: ChallengeItem; outcome: ChallengeOutcome } | null>(
    null,
  );
  useEffect(() => {
    if (!ended) return;
    const t = setTimeout(() => setEnded(null), 6000);
    return () => clearTimeout(t);
  }, [ended]);

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
    <View style={styles.fill}>
      <ModalHeader
        title="Challenges"
        subtitle={active.length ? `${active.length} under way` : 'Nothing under way'}
        onClose={() => router.back()}
      />
      <Screen>
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
        <Section flush>
          {active.length ? (
            active.map(({ kind, item }, i) => (
              <Animated.View key={`${kind}/${item.id}`} exiting={exitSoft} layout={layoutMove}>
                {i > 0 ? <Divider inset={INSET} /> : null}
                <ChallengeRow
                  item={item}
                  kind={kind}
                  caption={CHALLENGE_COPY[kind].title}
                  onConcluded={(before, outcome) => setEnded({ kind, before, outcome })}
                />
              </Animated.View>
            ))
          ) : (
            <View style={styles.empty}>
              <T variant="body" tone="ink2">
                Nothing under way. Start one on any list.
              </T>
            </View>
          )}
        </Section>
      </Screen>
      {/* The + waits in the page's bottom right corner. */}
      <View style={[styles.corner, { bottom: insets.bottom + space.l }]}>
        <AddButton onPress={add} label="Start a challenge" size={52} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  corner: { position: 'absolute', right: GUTTER },
  empty: { paddingLeft: space.l, justifyContent: 'center', minHeight: TARGET + 16 },
  undoRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: TARGET, paddingHorizontal: space.xs },
  undo: { minHeight: TARGET, justifyContent: 'center', paddingHorizontal: space.m },
});
