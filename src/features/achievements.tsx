import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { achievementSentence } from '@/domain/achievements';
import { formatMonth } from '@/domain/dates';
import type { Achievement } from '@/domain/types';
import { Burst } from '@/ui/burst';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/icon';
import { enterPop, SETTLE } from '@/ui/motion';
import { T } from '@/ui/text';
import { colors, radius, space } from '@/ui/theme';

export function AchievementBanner({
  a,
  fresh,
  showText = true,
}: {
  a: Achievement;
  fresh?: boolean;
  showText?: boolean;
}) {
  // A new achievement springs in, its star turns once, and the phone answers with a success tap.
  const turn = useSharedValue(0);
  useEffect(() => {
    if (!fresh) return;
    haptic.success();
    turn.set(withDelay(200, withSpring(1, SETTLE)));
  }, [fresh, turn]);
  const star = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.get() * 144}deg` }, { scale: 1 + Math.sin(turn.get() * Math.PI) * 0.25 }],
  }));
  return (
    <Animated.View
      entering={fresh ? enterPop : undefined}
      style={styles.banner}
      accessible
      accessibilityLabel={`${fresh ? 'New achievement' : 'Achievement'}: ${a.text}, ${achievementSentence(a)}`}
    >
      <View style={styles.badgeWrap}>
        {fresh ? <Burst play /> : null}
        <Animated.View style={[styles.badge, star]}>
          <Icon name="star.fill" size={16} color={colors.onAccent} />
        </Animated.View>
      </View>
      <View style={styles.flex}>
        <T variant="headline" tone="accent">
          {fresh ? 'New achievement' : 'Achievement'}
        </T>
        <T variant="subhead">{showText ? `${a.text}: ${achievementSentence(a)}` : achievementSentence(a)}</T>
        <T variant="footnote" tone="ink2">
          {fresh ? 'Added to your Achievements list.' : `Earned end of ${formatMonth(a.earned.slice(0, 7))}`}
        </T>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  banner: {
    flexDirection: 'row',
    gap: space.m,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.section,
    padding: space.l,
  },
  badgeWrap: { width: 34, height: 34 },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
