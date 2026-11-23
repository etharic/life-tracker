import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Field } from './controls';
import { haptic } from './haptics';
import { Icon } from './icon';
import { Divider } from './layout';
import { Press } from './press';
import { T } from './text';
import { colors, space } from './theme';

export interface Suggestion {
  key: string;
  text: string;
  /** Where it came from, read under the text ("Wed 12 Nov", "Kevin’s Rule, March"). */
  sub: string;
  /** A feeling colour, shown as a bar. */
  color?: string | null;
  /** Read by VoiceOver after the text, e.g. "felt Good". */
  spoken?: string;
}

/**
 * Suggest, never force: the entries one level below (the week's day titles, the month's week
 * highlights, the year's month highlights) above a field that always takes your own words.
 * Tapping an entry fills the field, which stays editable. With nothing to suggest, only the field.
 */
export function SuggestPicker({
  label,
  items,
  value,
  onChange,
  placeholder,
  heading,
  multiline,
  footer,
}: {
  label: string;
  items: Suggestion[];
  value: string;
  /** The text, and the suggestion it still equals (null once reworded or typed). */
  onChange: (text: string, from: Suggestion | null) => void;
  placeholder?: string;
  heading?: string;
  multiline?: boolean;
  footer?: ReactNode;
}) {
  const match = (t: string) => items.find((i) => i.text.trim() === t.trim()) ?? null;
  return (
    <View style={styles.wrap}>
      <Field
        label={label}
        value={value}
        onChangeText={(t) => onChange(t, match(t))}
        placeholder={placeholder}
        multiline={multiline}
        minHeight={multiline ? 70 : undefined}
        limit={multiline ? undefined : 140}
        returnKeyType={multiline ? undefined : 'done'}
      />
      {items.length ? (
        <View>
          <T variant="footnote" tone="ink2" style={styles.heading} accessibilityRole="header">
            {heading ?? 'Or use one of these'}
          </T>
          <View style={styles.bare}>
            {items.map((s, i) => {
              const selected = value.trim() === s.text.trim();
              return (
                <View key={s.key}>
                  {i > 0 ? <Divider /> : null}
                  <Press
                    feedback="highlight"
                    onPress={() => {
                      haptic.select();
                      onChange(s.text, s);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Use: ${s.text}, ${s.sub}${s.spoken ? `, ${s.spoken}` : ''}`}
                    style={selected ? styles.selected : undefined}
                  >
                    <View style={styles.row}>
                      <View style={[styles.bar, { backgroundColor: s.color ?? colors.track }]} />
                      <View style={styles.flex}>
                        <T variant="body" weight={selected ? '600' : '400'} numberOfLines={2}>
                          {s.text}
                        </T>
                        <T variant="footnote" tone="ink2">
                          {s.sub}
                        </T>
                      </View>
                      {selected ? <Icon name="checkmark" size={16} color={colors.accent} weight="semibold" /> : null}
                    </View>
                  </Press>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.m },
  flex: { flex: 1 },
  heading: { marginBottom: space.xs },
  bare: { marginHorizontal: -space.l },
  selected: { backgroundColor: colors.accentSoft },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.l,
    paddingVertical: space.s,
    minHeight: 48,
  },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
});
