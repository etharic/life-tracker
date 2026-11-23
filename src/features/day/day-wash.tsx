import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, useColorScheme } from 'react-native';
import Animated from 'react-native-reanimated';

import { feeling } from '@/domain/feelings';
import type { ISODate } from '@/domain/types';
import { useDay } from '@/features/hooks';
import { enterSoft, exitSoft } from '@/ui/motion';
import { GUTTER } from '@/ui/theme';

/** How strongly the day's colour shows at the very top: a tint, never a fill. */
const STRENGTH = { light: '33', dark: '47' } as const;

/**
 * The day's own colour. Once the feeling is set, the top of Today takes it on: a soft wash from
 * that colour into the paper, behind the date. The app reflects the day back; until then the page
 * is plain paper. It scrolls with the page and sits behind everything.
 */
export function DayWash({ date }: { date: ISODate }) {
  const f = feeling(useDay(date).feeling);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  if (!f) return null;
  return (
    <Animated.View key={f.score} entering={enterSoft} exiting={exitSoft} pointerEvents="none" style={styles.wash}>
      <LinearGradient
        colors={[`${f.color}${STRENGTH[scheme]}`, `${f.color}00`]}
        locations={[0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Reaches past the side gutters and up under the status bar, so the colour has no edges.
  wash: { position: 'absolute', top: -240, left: -GUTTER, right: -GUTTER, height: 560 },
});
