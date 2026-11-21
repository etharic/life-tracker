import { Text, type TextProps } from 'react-native';

import { colors, type, type TypeVariant } from './theme';

type Tone = 'ink' | 'ink2' | 'ink3' | 'accent' | 'onAccent';

interface Props extends TextProps {
  variant?: TypeVariant;
  tone?: Tone;
  weight?: '400' | '500' | '600' | '700';
  center?: boolean;
  /** Custom chrome (buttons, pills) bounds Dynamic Type; body text scales freely. */
  chrome?: boolean;
}

export function T({ variant = 'body', tone = 'ink', weight, center, chrome, style, ...rest }: Props) {
  return (
    <Text
      maxFontSizeMultiplier={chrome ? 1.4 : undefined}
      style={[
        type[variant],
        { color: colors[tone] },
        weight ? { fontWeight: weight } : null,
        center ? { textAlign: 'center' } : null,
        style,
      ]}
      {...rest}
    />
  );
}
