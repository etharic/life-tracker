import { DynamicColorIOS, Platform, useColorScheme, type ColorValue, type TextStyle } from 'react-native';

/**
 * Ink on paper. A journal is written with a pen: day paper and pen ink, one deep pen-blue for
 * everything that can be acted on, a leaf green for a yes and a muted brick for a no. Blue is calm
 * on purpose (the evening ritual, decades of use); warm colours are left to the day itself, whose
 * feeling colour tints Today (src/domain/feelings.ts). Every text pairing is at least 4.5:1.
 */
const light = {
  bg: '#F7F7F4', // day paper
  surface: '#FFFFFF',
  fill: '#ECEDEA', // inputs, pills, segmented track
  ink: '#15181C',
  ink2: '#55595F', // secondary text
  ink3: '#6E7278', // placeholders and quiet hints
  hairline: '#E2E3DF',
  track: '#E2E3DF', // empty ring track, missed strip cells
  boxBorder: '#B6B9BE', // unticked checkbox
  accent: '#2B4C7E', // pen blue: actions, selection, rings
  accentText: '#2B4C7E', // blue words (8:1 on paper)
  accentStrong: '#2B4C7E', // fill behind white words
  accentSoft: '#E6ECF5', // pen-blue wash: done, chosen
  hobby: '#7A3E8E', // plum: hobbies, beside the pen-blue goals
  hobbySoft: '#F2E8F5',
  onAccent: '#FFFFFF',
  good: '#2F7A4A', // a yes
  goodStrong: '#2F7A4A',
  goodSoft: '#E3F0E7',
  bad: '#A8432F', // a no, a rejection: muted brick, never alarm red
  badStrong: '#A8432F',
  flame: '#B3591F', // the streak's flame
  scrim: 'rgba(21,24,28,0.05)',
  edge: 'rgba(21,24,28,0.08)', // the thin edge around colour swatches
};

/** Night: blue-black paper, lighter ink, the pen-blue lifted so it reads on dark. */
const dark: typeof light = {
  bg: '#12161C',
  surface: '#1A2028',
  fill: '#232A33',
  ink: '#ECEEF1',
  ink2: '#AEB4BC',
  ink3: '#8C939C',
  hairline: '#2A313A',
  track: '#2E3540',
  boxBorder: '#4C545E',
  accent: '#93B4E8',
  accentText: '#93B4E8',
  accentStrong: '#93B4E8',
  accentSoft: '#1E2A3B',
  hobby: '#D2A6E2',
  hobbySoft: '#2C2234',
  onAccent: '#0E1726', // dark words on the light night blue
  good: '#7CC495',
  goodStrong: '#7CC495',
  goodSoft: '#1D3126',
  bad: '#E8907F',
  badStrong: '#E8907F',
  flame: '#E9A15F',
  scrim: 'rgba(236,238,241,0.07)',
  edge: 'rgba(236,238,241,0.12)',
};

export type ColorName = keyof typeof light;
export const palette = { light, dark };

/**
 * The plain colours of the current appearance. Animated colour changes need these: the animation
 * library cannot blend the self-switching colours in `colors` and throws if it is asked to.
 */
export function usePalette(): typeof light {
  return palette[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

/**
 * Each colour follows the system appearance by itself (DynamicColorIOS), so every StyleSheet
 * stays static and switches between light and dark without re-rendering the app.
 * Places that need a plain string (SVG strokes) use `palette[scheme]` instead.
 */
export const colors = Object.fromEntries(
  (Object.keys(light) as ColorName[]).map((k) => [
    k,
    Platform.OS === 'ios' ? DynamicColorIOS({ light: light[k], dark: dark[k] }) : light[k],
  ]),
) as Record<ColorName, ColorValue>;

export const space = {
  xxs: 2,
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

/** Screen side padding, locked app-wide. */
export const GUTTER = 20;

export const radius = {
  s: 6,
  control: 10,
  section: 16,
  pill: 999,
} as const;

/** Minimum touch target (HIG). */
export const TARGET = 44;

/**
 * New York, Apple's serif, for the person's own words (titles, highlights, writing);
 * the interface stays in SF Pro. iOS resolves 'ui-serif' to New York.
 */
export const SERIF = 'ui-serif';

/** Surfaces are flat, as in Claude: a hairline edge, no shadow. (Kept as a token so one change restores depth.) */
export const elevation = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
} as const;

type Variant =
  | 'largeTitle'
  | 'title'
  | 'title3'
  | 'headline'
  | 'body'
  | 'callout'
  | 'subhead'
  | 'footnote'
  | 'caption'
  | 'overline'
  | 'number'
  | 'display'
  | 'pageTitle'
  | 'journalTitle'
  | 'journalBody';

/** iOS text styles, system font (SF Pro). */
export const type: Record<Variant, TextStyle> = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.37 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: 0.36 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: 0.38 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.41 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.41 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.32 },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.24 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: -0.08 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  /** A small group label inside a list, in sentence case like the rest of the interface. */
  overline: { fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: -0.08 },
  number: { fontSize: 17, lineHeight: 22, fontWeight: '600', fontVariant: ['tabular-nums'] },
  display: { fontFamily: SERIF, fontSize: 30, lineHeight: 36, fontWeight: '500', letterSpacing: -0.2 },
  /** The title of a pushed screen or a flow: large-title size, in the serif the tabs use. */
  pageTitle: { fontFamily: SERIF, fontSize: 34, lineHeight: 41, fontWeight: '600' },
  journalTitle: { fontFamily: SERIF, fontSize: 21, lineHeight: 27, fontWeight: '600' },
  journalBody: { fontFamily: SERIF, fontSize: 18, lineHeight: 27, fontWeight: '400' },
};

export type TypeVariant = Variant;
