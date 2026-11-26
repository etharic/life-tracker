import { DynamicColorIOS, Platform, useColorScheme, type ColorValue, type TextStyle } from 'react-native';

/**
 * A night by the fire, just before sleep: hearth-brown paper, cream ink, and one ember amber for
 * everything that can be acted on. Hobbies take a quiet sage beside the amber goals. No gradients,
 * no cool blues: warmth comes from the colours themselves. Daytime is the same room with the lamp
 * on: warm paper, brown ink, a deeper ember. Every text pairing is at least 4.5:1.
 */
const light = {
  bg: '#FBF5EC', // lamplit paper
  surface: '#FFFDF9',
  fill: '#F1E8DB', // inputs, pills, segmented track
  ink: '#2A1E16',
  ink2: '#5E4D40', // secondary text
  ink3: '#776555', // placeholders and quiet hints
  hairline: '#EADFD0',
  track: '#E8DCCB', // empty ring track, missed strip cells
  boxBorder: '#BFAD99', // unticked checkbox
  accent: '#A84F1A', // ember: actions, selection, goals
  accentText: '#A84F1A',
  accentStrong: '#A84F1A', // fill behind white words
  accentSoft: '#F7E3D1', // ember wash: done, chosen
  hobby: '#55713D', // sage: hobbies, beside the ember goals
  hobbySoft: '#E6EDDB',
  onAccent: '#FFFFFF',
  good: '#4C7536', // a yes
  goodStrong: '#4C7536',
  goodSoft: '#E5EEDC',
  bad: '#A8432F', // a no, a rejection: muted brick, never alarm red
  badStrong: '#A8432F',
  flame: '#C2571A', // the streak's flame
  scrim: 'rgba(42,30,22,0.05)',
  edge: 'rgba(42,30,22,0.10)', // the thin edge around colour swatches
};

/** Night by the hearth: charred-wood paper, cream ink, the ember glowing. */
const dark: typeof light = {
  bg: '#16110D',
  surface: '#201914',
  fill: '#2A211B',
  ink: '#F3E9DC',
  ink2: '#CDBCA9',
  ink3: '#A08E7C',
  hairline: '#30261E',
  track: '#3A2E25',
  boxBorder: '#5E4D3F',
  accent: '#F0A35E',
  accentText: '#F0A35E',
  accentStrong: '#F0A35E',
  accentSoft: '#3A2617',
  hobby: '#AFC48F',
  hobbySoft: '#252B1C',
  onAccent: '#1E130B', // dark words on the light ember
  good: '#A3C98C',
  goodStrong: '#A3C98C',
  goodSoft: '#22301C',
  bad: '#E8907F',
  badStrong: '#E8907F',
  flame: '#FF9F4A',
  scrim: 'rgba(243,233,220,0.07)',
  edge: 'rgba(243,233,220,0.12)',
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

/**
 * One corner for every box (cards, controls, sheets, tiles): 14. `s` is only for the ends of thin
 * bars and grid cells; circles are circles.
 */
export const radius = {
  s: 6,
  control: 14,
  section: 14,
  pill: 999,
} as const;

/** Minimum touch target (HIG). */
export const TARGET = 44;

/**
 * New York, Apple's serif, for the person's own words (titles, highlights, writing);
 * the interface stays in SF Pro. iOS resolves 'ui-serif' to New York.
 */
export const SERIF = 'ui-serif';

/**
 * SF Pro Rounded for titles and big numbers: soft, warm and very easy to read. The person's own
 * writing stays in the serif.
 */
export const ROUNDED = 'ui-rounded';

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
  display: { fontFamily: ROUNDED, fontSize: 30, lineHeight: 36, fontWeight: '600', letterSpacing: -0.2 },
  /** The title of a pushed screen or a flow: large-title size, rounded like the tabs. */
  pageTitle: { fontFamily: ROUNDED, fontSize: 34, lineHeight: 41, fontWeight: '700' },
  journalTitle: { fontFamily: SERIF, fontSize: 21, lineHeight: 27, fontWeight: '600' },
  journalBody: { fontFamily: SERIF, fontSize: 18, lineHeight: 27, fontWeight: '400' },
};

export type TypeVariant = Variant;
