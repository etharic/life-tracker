import { DynamicColorIOS, Platform, type ColorValue, type TextStyle } from 'react-native';

/**
 * Claude's own palette: warm ivory paper and near-black ink by day, warm charcoal by night, and one
 * terracotta accent. The feelings scale keeps its own colours (src/domain/feelings.ts).
 */
const light = {
  bg: '#FAF9F5', // ivory paper
  surface: '#FFFFFF',
  fill: '#F0EEE6', // inputs, pills, segmented track
  ink: '#141413',
  ink2: '#5E5D59', // secondary text
  ink3: '#9C9A92', // placeholders, disabled, decorative only
  hairline: '#E8E6DC',
  track: '#E8E6DC', // empty ring track, missed strip cells
  boxBorder: '#C3C0B6', // unticked checkbox
  accent: '#C96442', // terracotta
  accentPressed: '#B5573A',
  accentSoft: '#F5E9E2',
  onAccent: '#FFFFFF',
  good: '#3F8A4F', // a yes on a challenge list
  goodSoft: '#E5F0E3',
  scrim: 'rgba(20,20,19,0.05)',
  edge: 'rgba(20,20,19,0.08)', // the thin edge around colour swatches
};

/** Night: warm charcoal, slightly raised cards, the brighter terracotta Claude uses in dark mode. */
const dark: typeof light = {
  bg: '#262624',
  surface: '#30302E',
  fill: '#3A3936',
  ink: '#FAF9F5',
  ink2: '#C2C0B6',
  ink3: '#8A8880',
  hairline: '#3E3D3A',
  track: '#45443F',
  boxBorder: '#6B6A64',
  accent: '#D97757',
  accentPressed: '#E38B6E',
  accentSoft: '#45322A',
  onAccent: '#FFFFFF',
  good: '#6DBE7C',
  goodSoft: '#2F3D30',
  scrim: 'rgba(250,249,245,0.07)',
  edge: 'rgba(250,249,245,0.12)',
};

export type ColorName = keyof typeof light;
export const palette = { light, dark };

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
