import { SegmentedControl } from '@expo/ui/community/segmented-control';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { haptic } from './haptics';
import { Icon } from './icon';
import { colorEase, POP, RM } from './motion';
import { Press } from './press';
import { T } from './text';
import { colors, radius, space, TARGET, type, usePalette } from './theme';
import { usePop } from './use-pop';

// ---------- Checkbox ----------

export function CheckBox({ checked, size = 26, dashed }: { checked: boolean; size?: number; dashed?: boolean }) {
  // The box pops and the check springs in when ticked; unticking is quiet.
  const pop = usePop(checked, 0.12);
  const p = usePalette();
  const mark = useSharedValue(checked ? 1 : 0);
  useEffect(() => {
    mark.set(checked ? withSpring(1, POP) : withTiming(0, { duration: 120, reduceMotion: RM }));
  }, [checked, mark]);
  const markStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, mark.get() * 1.4),
    transform: [{ scale: 0.7 + mark.get() * 0.3 }],
  }));
  return (
    <Animated.View
      style={[
        styles.box,
        { width: size, height: size, borderRadius: size * 0.27 },
        dashed && !checked ? styles.boxDashed : null,
        colorEase,
        checked
          ? { backgroundColor: p.accent, borderColor: p.accent }
          : dashed
            ? { backgroundColor: 'transparent', borderColor: p.boxBorder }
            : { backgroundColor: p.surface, borderColor: p.boxBorder },
        pop,
      ]}
    >
      <Animated.View style={markStyle}>
        <Icon name="checkmark" size={size * 0.55} color={colors.onAccent} weight="bold" />
      </Animated.View>
    </Animated.View>
  );
}

interface CheckRowProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
  caption?: string;
  strike?: boolean;
  trailing?: ReactNode;
  disabled?: boolean;
  onLongPress?: () => void;
  /** When set, the row opens something and only the box ticks. */
  onPressRow?: () => void;
  expanded?: boolean;
  /** Shown as it is, not changed (a past day before Edit is chosen). */
  readOnly?: boolean;
}

/** A tickable line: priorities, goals, weekly checks. */
/**
 * A small round "+" that sits at the end of a list's last line instead of taking a line of its
 * own: it opens the list for adding or editing.
 */
export function AddButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Press
      onPress={() => {
        haptic.select();
        onPress();
      }}
      hitSlop={10}
      accessibilityLabel={label}
      style={styles.addButton}
    >
      <Icon name="plus" size={14} color={colors.accent} weight="bold" />
    </Press>
  );
}

export function CheckRow({
  checked,
  onToggle,
  label,
  caption,
  strike,
  trailing,
  disabled,
  onLongPress,
  onPressRow,
  expanded,
  readOnly,
}: CheckRowProps) {
  const toggle = () => {
    haptic.select();
    onToggle();
  };
  const text = (
    <View style={styles.checkText}>
      {caption ? (
        <T variant="overline" tone="ink2" style={styles.caption}>
          {caption}
        </T>
      ) : null}
      <T variant="body" tone={strike && checked ? 'ink2' : 'ink'} style={strike && checked ? styles.strike : undefined}>
        {label}
      </T>
    </View>
  );
  if (readOnly) {
    return (
      <View
        style={styles.checkRow}
        accessible
        accessibilityLabel={`${caption ? `${caption}: ` : ''}${label}${checked ? ', done' : ', not done'}`}
      >
        <CheckBox checked={checked} />
        {text}
        {trailing}
      </View>
    );
  }
  return (
    <Press
      feedback="highlight"
      disabled={disabled}
      onLongPress={onLongPress}
      accessibilityRole={onPressRow ? 'button' : 'checkbox'}
      accessibilityState={onPressRow ? { expanded, disabled } : { checked, disabled }}
      accessibilityLabel={caption ? `${caption}: ${label}` : label}
      onPress={onPressRow ?? toggle}
      style={styles.checkRow}
    >
      {onPressRow ? (
        <Press
          onPress={toggle}
          hitSlop={12}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel={`Done: ${label}`}
        >
          <CheckBox checked={checked} />
        </Press>
      ) : (
        <CheckBox checked={checked} />
      )}
      {text}
      {trailing}
    </Press>
  );
}

// ---------- Buttons ----------

type ButtonKind = 'primary' | 'secondary' | 'plain';

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  icon,
  compact,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  icon?: Parameters<typeof Icon>[0]['name'];
  compact?: boolean;
  accessibilityLabel?: string;
}) {
  const fg = kind === 'primary' ? colors.onAccent : colors.accent;
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? title}
      style={[
        styles.button,
        compact && styles.buttonCompact,
        kind === 'primary' && styles.primary,
        kind === 'secondary' && styles.secondary,
        kind === 'plain' && styles.plain,
      ]}
    >
      {icon ? <Icon name={icon} size={16} color={fg} weight="semibold" /> : null}
      <T variant="headline" chrome style={{ color: fg }}>
        {title}
      </T>
    </Press>
  );
}

/** Small text action in a section header or row ("Edit", "Keep"). */
export function TextAction({
  title,
  onPress,
  tone = 'accent',
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  tone?: 'accent' | 'ink2';
  /** When the visible words need context ("Remove" which reminder). */
  accessibilityLabel?: string;
}) {
  return (
    <Press onPress={onPress} hitSlop={12} style={styles.textAction} accessibilityLabel={accessibilityLabel ?? title}>
      <T variant="subhead" weight="600" tone={tone} chrome>
        {title}
      </T>
    </Press>
  );
}

// ---------- Pill ----------

export function Pill({
  label,
  icon,
  tone = 'accent',
}: {
  label: string;
  icon?: Parameters<typeof Icon>[0]['name'];
  tone?: 'accent' | 'neutral';
}) {
  const fg = tone === 'accent' ? colors.accent : colors.ink2;
  return (
    <View style={[styles.pill, tone === 'accent' ? styles.pillAccent : styles.pillNeutral]}>
      {icon ? <Icon name={icon} size={11} color={fg} weight="semibold" /> : null}
      <T variant="footnote" weight="600" chrome style={{ color: fg }}>
        {label}
      </T>
    </View>
  );
}

// ---------- Segmented (native) ----------

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  // -1 when nothing is chosen yet (a question not answered), so no segment looks selected.
  const index = options.findIndex((o) => o.value === value);
  return (
    <SegmentedControl
      values={options.map((o) => o.label)}
      selectedIndex={index}
      onChange={(e) => {
        const next = options[e.nativeEvent.selectedSegmentIndex];
        if (next && next.value !== value) {
          haptic.select();
          onChange(next.value);
        }
      }}
      style={styles.segmented}
    />
  );
}

// ---------- Text field ----------

interface FieldProps extends TextInputProps {
  label?: string;
  limit?: number;
  multiline?: boolean;
  minHeight?: number;
}

export function Field({ label, limit, multiline, minHeight, value, style, ...rest }: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      {label ? (
        <T variant="subhead" weight="600" tone="ink2">
          {label}
        </T>
      ) : null}
      <TextInput
        value={value}
        multiline={multiline}
        maxLength={limit}
        placeholderTextColor={colors.ink3}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.field, multiline && { minHeight: minHeight ?? 120, paddingTop: 12 }, style]}
        {...rest}
      />
      {limit ? (
        <T variant="caption" tone="ink3" style={styles.counter}>
          {`${value?.length ?? 0} / ${limit}`}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  boxDashed: { backgroundColor: 'transparent', borderColor: colors.boxBorder, borderStyle: 'dashed' },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    minHeight: TARGET + 4,
    paddingVertical: space.s,
    paddingHorizontal: space.l,
  },
  checkText: { flex: 1, gap: 1 },
  caption: { fontSize: 11, lineHeight: 13 },
  strike: { textDecorationLine: 'line-through' },
  button: {
    flexDirection: 'row',
    gap: space.s,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: space.xl,
    borderRadius: radius.section,
  },
  buttonCompact: { minHeight: TARGET, paddingHorizontal: space.l, borderRadius: radius.pill },
  primary: { backgroundColor: colors.accentStrong },
  secondary: { backgroundColor: colors.accentSoft },
  plain: { backgroundColor: 'transparent' },
  textAction: { minHeight: 28, justifyContent: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillAccent: { backgroundColor: colors.accentSoft },
  pillNeutral: { backgroundColor: colors.fill },
  segmented: { height: 34 },
  fieldWrap: { gap: space.s },
  field: {
    ...type.body,
    color: colors.ink,
    backgroundColor: colors.fill,
    borderRadius: radius.control,
    paddingHorizontal: space.l,
    paddingVertical: space.m,
    minHeight: TARGET + 4,
  },
  counter: { alignSelf: 'flex-end', fontVariant: ['tabular-nums'] },
});
