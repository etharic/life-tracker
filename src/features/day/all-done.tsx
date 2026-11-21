import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { ISODate } from '@/domain/types';
import { Burst } from '@/ui/burst';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { enterRow, exitSoft } from '@/ui/motion';
import { T } from '@/ui/text';
import { colors, radius, space } from '@/ui/theme';
import { usePop } from '@/ui/use-pop';

/** Days already celebrated in this session: the moment happens once, not on every visit. */
const celebrated = new Set<ISODate>();

/**
 * "All done for today": appears when every goal and hobby is ticked. The first time that happens
 * on a day, while the app is open, it rises in with a short burst and a success tap.
 */
export function AllDone({ date, done, streak }: { date: ISODate; done: boolean; streak: number }) {
  const was = useRef(done);
  const [moment, setMoment] = useState(false);
  useEffect(() => {
    const becameDone = done && !was.current;
    was.current = done;
    if (!becameDone || celebrated.has(date)) return;
    celebrated.add(date);
    haptic.success();
    const t = setTimeout(() => setMoment(true), 0);
    return () => clearTimeout(t);
  }, [done, date]);
  const pop = usePop(moment, 0.3);

  if (!done) return null;
  return (
    <Animated.View
      entering={moment ? enterRow : undefined}
      exiting={exitSoft}
      style={styles.wrap}
      accessibilityRole="text"
    >
      <View style={styles.badgeWrap}>
        <Burst play={moment} />
        <Animated.View style={[styles.badge, pop]}>
          <Icon name="checkmark" size={18} color={colors.onAccent} weight="bold" />
        </Animated.View>
      </View>
      <T variant="headline" center>
        All done for today
      </T>
      <T variant="subhead" tone="ink2" center>
        {streak > 1 ? `Every goal and hobby ticked. Day ${streak} in a row.` : 'Every goal and hobby ticked.'}
      </T>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.xs, paddingVertical: space.l },
  badgeWrap: { width: 120, height: 64, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  badge: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
