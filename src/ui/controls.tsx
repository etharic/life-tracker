import { SegmentedControl } from '@expo/ui/community/segmented-control';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { haptic } from './haptics';
import { Icon } from './icon';
import { colorEase, POP, RM } from './motion';
import { Press } from './press';
import { T } from './text';
import { colors, radius, space, TARGET, type } from './theme';
import { usePop } from './use-pop';

const boxAnim = colorEase;

// ---------- Checkbox ----------

export function CheckBox({ checked, size = 26, dashed }: { checked: boolean; size?: number; dashed?: boolean }) {
  // The box pops and the check springs in when ticked; unticking is quiet.
  const pop = usePop(checked, 0.12);
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
        boxAnim,
        { width: size, height: size, borderRadius: size * 0.27 },
        checked ? styles.boxOn : dashed ? styles.boxDashed : styles.boxOff,
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

// ---------- Chip (hobby ticks) ----------

export function Chip({
  label,
  selected,
  onPress,
  onLongPress,
  starred,
  starLabel = 'skill hobby',
  readOnly,
  wrap,
  accessibilityHint,
}: {
  label: string;
  selected: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  starred?: boolean;
  /** What the star means, for VoiceOver. */
  starLabel?: string;
  /** Shown as it is, not toggled (a week that has passed). */
  readOnly?: boolean;
  /** Long text wraps instead of being cut. */
  wrap?: boolean;
  accessibilityHint?: string;
}) {
  const pop = usePop(selected, 0.1);
  const content = (
    <>
      {selected ? (
        <Icon name="checkmark" size={14} color={colors.onAccent} weight="bold" />
      ) : starred ? (
        <Icon name="star.fill" size={13} color={colors.accent} />
      ) : null}
      <T
        variant="callout"
        weight="500"
        tone={selected ? 'onAccent' : 'ink'}
        numberOfLines={wrap ? undefined : 1}
        chrome
        style={styles.chipText}
      >
        {label}
      </T>
      {selected && starred ? <Icon name="star.fill" size={12} color={colors.onAccent} /> : null}
    </>
  );
  const style = [styles.chip, wrap && styles.chipWrap, selected ? styles.chipOn : styles.chipOff];
  if (readOnly || !onPress) {
    return (
      <View style={style} accessible accessibilityLabel={`${label}${selected ? ', done' : ''}`}>
        {content}
      </View>
    );
  }
  return (
    <Animated.View style={pop}>
      <Press
        onPress={() => {
          haptic.select();
          onPress();
        }}
        onLongPress={onLongPress}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={starred ? `${label}, ${starLabel}` : label}
        accessibilityHint={accessibilityHint}
        colorTransition
        style={style}
      >
        {content}
      </Press>
    </Animated.View>
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
}: {
  title: string;
  onPress: () => void;
  tone?: 'accent' | 'ink2';
}) {
  return (
    <Press onPress={onPress} hitSlop={12} style={styles.textAction} accessibilityLabel={title}>
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
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
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
  box: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  boxOff: { backgroundColor: colors.surface, borderColor: colors.boxBorder },
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
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: TARGET,
    paddingHorizontal: space.m,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipOff: { backgroundColor: colors.surface, borderColor: colors.hairline },
  chipText: { flexShrink: 1 },
  chipWrap: { paddingVertical: space.s },
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
  primary: { backgroundColor: colors.accent },
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
