import { useEffect, useRef, type ReactNode } from 'react';
import {
  ScrollView,
  Settings,
  StyleSheet,
  View,
  type ScrollViewInstance,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './icon';
import { Press } from './press';
import { T } from './text';
import { colors, elevation, GUTTER, radius, space, TARGET } from './theme';

// ---------- Screen ----------

interface ScreenProps extends ScrollViewProps {
  children: ReactNode;
  /** Tab roots draw their own header below the status bar; pushed screens sit under a native header. */
  topInset?: boolean;
  footer?: ReactNode;
}

export function Screen({ children, topInset, footer, contentContainerStyle, ...rest }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const ref = useRef<ScrollViewInstance>(null);
  // Simulator check only: `-LTScroll 700` scrolls down that far, so screenshots reach lower parts.
  useEffect(() => {
    const y = Number(Settings.get('LTScroll'));
    if (!y) return;
    const t = setTimeout(() => ref.current?.scrollTo({ y, animated: false }), 2000);
    return () => clearTimeout(t);
  }, []);
  return (
    <View style={styles.screen}>
      <ScrollView
        ref={ref}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topInset ? space.xs : space.s,
            paddingBottom: footer ? space.l : insets.bottom + space.huge,
          },
          contentContainerStyle,
        ]}
        {...rest}
      >
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + space.m }]}>{footer}</View> : null}
    </View>
  );
}

// ---------- Header (tab roots and flows) ----------

/** The top of a tab: one line, the title in the serif face, a quiet accessory on the right. */
export function TopBar({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <View style={styles.topBar}>
      <T variant="display" accessibilityRole="header" style={styles.flex} numberOfLines={1} adjustsFontSizeToFit>
        {title}
      </T>
      {trailing}
    </View>
  );
}

export function ScreenHeader({
  overline,
  title,
  trailing,
  children,
}: {
  overline?: string;
  title: string;
  trailing?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <T variant="pageTitle" accessibilityRole="header" style={styles.headerTitle} numberOfLines={2}>
          {title}
        </T>
        {trailing}
      </View>
      {/* What the title belongs to (a date, a list) reads underneath it, not as a label above. */}
      {overline ? (
        <T variant="subhead" tone="ink2">
          {overline}
        </T>
      ) : null}
      {children}
    </View>
  );
}

// ---------- Sections ----------

export function SectionLabel({ children, trailing }: { children: string; trailing?: ReactNode }) {
  return (
    <View style={styles.sectionLabel}>
      <T variant="overline" tone="ink2" accessibilityRole="header">
        {children}
      </T>
      {trailing}
    </View>
  );
}

interface SectionProps {
  title?: string;
  count?: string;
  action?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Content runs edge to edge (rows draw their own padding). */
  flush?: boolean;
  tone?: 'surface' | 'accent';
}

/** A grouped section: a white card on paper with a hairline and a very soft shadow. */
export function Section({ title, count, action, children, style, flush, tone = 'surface' }: SectionProps) {
  // The shadow lives on an outer layer: a view that clips its corners cannot cast one.
  return (
    <View style={[styles.sectionShadow, tone === 'accent' && styles.flat, style]}>
      <View style={[styles.section, tone === 'accent' && styles.sectionAccent]}>
        {title || count || action ? (
          <View style={[styles.sectionHead, flush && styles.sectionHeadFlush]}>
            {title ? (
              <T
                variant="subhead"
                weight="600"
                tone={tone === 'accent' ? 'accent' : 'ink2'}
                accessibilityRole="header"
                style={styles.flex}
              >
                {title}
              </T>
            ) : (
              <View style={styles.flex} />
            )}
            {count ? (
              <T variant="subhead" tone="ink2" style={styles.tabular}>
                {count}
              </T>
            ) : null}
            {action}
          </View>
        ) : null}
        <View style={flush ? undefined : styles.sectionBody}>{children}</View>
      </View>
    </View>
  );
}

export function Divider({ inset = space.l }: { inset?: number }) {
  return <View style={[styles.divider, { marginLeft: inset }]} />;
}

// ---------- Rows ----------

interface RowProps {
  title: string;
  detail?: string;
  value?: string;
  onPress?: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  accessibilityLabel?: string;
}

export function Row({
  title,
  detail,
  value,
  onPress,
  leading,
  trailing,
  chevron = !!onPress,
  accessibilityLabel,
}: RowProps) {
  const body = (
    <View style={styles.row}>
      {leading}
      <View style={styles.flex}>
        <T variant="body" numberOfLines={2}>
          {title}
        </T>
        {detail ? (
          <T variant="footnote" tone="ink2" numberOfLines={2}>
            {detail}
          </T>
        ) : null}
      </View>
      {value ? (
        <T variant="body" tone="ink2" style={styles.tabular}>
          {value}
        </T>
      ) : null}
      {trailing}
      {chevron ? <Icon name="chevron.right" size={13} color={colors.ink3} weight="semibold" /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Press
      feedback="highlight"
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? [title, value, detail].filter(Boolean).join(', ')}
    >
      {body}
    </Press>
  );
}

/** Rows separated by inset hairlines; with leading icons, the line starts where the text does (iOS). */
export function Rows({ children, inset }: { children: ReactNode[]; inset?: number }) {
  const items = children.filter(Boolean);
  return (
    <View>
      {items.map((c, i) => (
        <View key={i}>
          {i > 0 ? <Divider inset={inset} /> : null}
          {c}
        </View>
      ))}
    </View>
  );
}

// ---------- Empty and quiet states ----------

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <T variant="headline" center>
        {title}
      </T>
      {body ? (
        <T variant="subhead" tone="ink2" center>
          {body}
        </T>
      ) : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

/** One quiet line under a section or screen title: what this screen is. */
export function Explainer({ children }: { children: string }) {
  return (
    <T variant="subhead" tone="ink2" style={styles.explainer}>
      {children}
    </T>
  );
}

export const layout = StyleSheet.create({
  stack: { gap: space.l },
  stackLoose: { gap: space.xxl },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: GUTTER, gap: space.l },
  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: space.m,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  header: { gap: 2, marginBottom: space.xs },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 44 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.m },
  headerTitle: { flexShrink: 1 },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.s,
    marginBottom: -space.xs,
    // iOS aligns a grouped section's header with the text inside its rows.
    paddingHorizontal: space.l,
  },
  sectionShadow: { borderRadius: radius.section, backgroundColor: colors.surface, ...elevation.card },
  flat: { shadowOpacity: 0, elevation: 0, backgroundColor: colors.accentSoft },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.section,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  sectionAccent: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.l,
    paddingTop: space.m + 2,
    paddingBottom: space.xs,
  },
  sectionHeadFlush: { paddingBottom: space.xs },
  sectionBody: { padding: space.l, paddingTop: space.s },
  flex: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    minHeight: TARGET + 6,
    paddingVertical: space.s + 2,
    paddingHorizontal: space.l,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s,
    paddingVertical: space.huge,
    paddingHorizontal: space.xxl,
  },
  emptyAction: { marginTop: space.m },
  explainer: { marginTop: -space.s },
});
