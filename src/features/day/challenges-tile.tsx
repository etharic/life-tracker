import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/ui/icon';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, space, TARGET } from '@/ui/theme';

import type { ActiveChallenge } from './today-board';

/**
 * Challenges on Today: one row, made like the journal row under it (a round symbol, the name, a
 * line of what is there, a chevron). A tap opens the challenges screen, where they are logged.
 */
export function ChallengesRow({ active }: { active: ActiveChallenge[] }) {
  const n = active.length;
  return (
    <View style={styles.bare}>
      <Press
        feedback="highlight"
        onPress={() => router.push('/challenges')}
        accessibilityLabel={`Challenges, ${n ? `${n} under way` : 'none under way'}`}
        accessibilityHint="Opens your challenges"
      >
        <View style={styles.row}>
          <View style={styles.icon}>
            <Icon name="flag.fill" size={15} color={colors.accent} />
          </View>
          <View style={styles.flex}>
            <T variant="headline">Challenges</T>
            <T variant="footnote" tone="ink2">
              {n ? `${n} under way` : 'Nothing under way'}
            </T>
          </View>
          <Icon name="chevron.right" size={13} color={colors.ink3} weight="semibold" />
        </View>
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // On the paper, as the journal row is: the row reaches the screen gutter.
  bare: { marginHorizontal: -space.l },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l, minHeight: TARGET + 16 },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
