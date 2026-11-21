import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { colors } from './theme';

interface Props {
  name: SFSymbol;
  size?: number;
  color?: ColorValue;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
}

/** SF Symbols only: one icon family across the app. */
export function Icon({ name, size = 17, color = colors.ink, weight = 'regular' }: Props) {
  return <SymbolView name={name} size={size} tintColor={color} weight={weight} style={{ width: size, height: size }} />;
}
