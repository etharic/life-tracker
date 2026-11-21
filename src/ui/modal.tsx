import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './icon';
import { Press } from './press';
import { T } from './text';
import { colors, GUTTER, space, TARGET } from './theme';

/** Header of a sheet or full-screen flow: explicit close, centred title. */
export function ModalHeader({
  title,
  subtitle,
  onClose,
  closeIcon = 'xmark',
  trailing,
  fullScreen,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  closeIcon?: 'xmark' | 'chevron.left';
  trailing?: ReactNode;
  /** Full-screen flows sit under the status bar; sheets do not. */
  fullScreen?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, fullScreen && { paddingTop: insets.top + space.xs }]}>
      <Press
        onPress={onClose}
        hitSlop={10}
        style={styles.side}
        accessibilityLabel={closeIcon === 'xmark' ? 'Close' : 'Back'}
      >
        <Icon name={closeIcon} size={20} color={colors.ink} weight="medium" />
      </Press>
      <View style={styles.center}>
        <T variant="headline" center numberOfLines={1} accessibilityRole="header" chrome>
          {title}
        </T>
        {subtitle ? (
          <T variant="footnote" tone="ink2" center numberOfLines={1} chrome>
            {subtitle}
          </T>
        ) : null}
      </View>
      <View style={[styles.side, styles.right]}>{trailing}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: GUTTER - 8,
    paddingTop: space.m,
    paddingBottom: space.s,
    backgroundColor: colors.bg,
  },
  side: { width: TARGET + 16, height: TARGET, justifyContent: 'center', paddingLeft: 8 },
  right: { alignItems: 'flex-end', paddingRight: 8, paddingLeft: 0 },
  center: { flex: 1 },
});
