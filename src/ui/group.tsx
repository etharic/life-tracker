import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { T } from './text';
import { space } from './theme';

/**
 * The building blocks of every main screen: a group is a plain title on the paper (no box, said once),
 * and its content sits in one flat card.
 */

export function GroupHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <View style={styles.header}>
      <T variant="headline" accessibilityRole="header" style={styles.flex} numberOfLines={1}>
        {title}
      </T>
      {trailing}
    </View>
  );
}

export function Group({ title, trailing, children }: { title?: string; trailing?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.group}>
      {title ? <GroupHeader title={title} trailing={trailing} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.m,
    paddingHorizontal: space.xs,
    marginTop: space.xs,
  },
  group: { gap: space.m },
});
