/** How the day felt: the only rainbow in the app. A fixed ten-step scale. */
export interface Feeling {
  score: number;
  name: string;
  color: string;
  /** Text colour that stays readable on `color`. */
  on: string;
}

export const FEELINGS: readonly Feeling[] = [
  { score: 0, name: 'Worst day ever', color: '#111111', on: '#FFFFFF' },
  { score: 1, name: 'Terrible', color: '#D32F2F', on: '#FFFFFF' },
  { score: 2, name: 'Damn', color: '#F57C00', on: '#1E1E22' },
  { score: 3, name: 'Bad', color: '#FFA726', on: '#1E1E22' },
  { score: 4, name: 'Below average', color: '#FDD835', on: '#1E1E22' },
  { score: 5, name: 'Neutral', color: '#FFF59D', on: '#1E1E22' },
  { score: 6, name: 'All right', color: '#66BB6A', on: '#1E1E22' },
  { score: 7, name: 'Good', color: '#2E7D32', on: '#FFFFFF' },
  { score: 8, name: 'Great', color: '#1B5E20', on: '#FFFFFF' },
  { score: 9, name: 'Fantastic', color: '#4FC3F7', on: '#1E1E22' },
  { score: 10, name: 'Best day ever', color: '#1E88E5', on: '#FFFFFF' },
];

export function feeling(score: number | null | undefined): Feeling | null {
  if (score == null || !Number.isInteger(score) || score < 0 || score > 10) return null;
  return FEELINGS[score];
}

export function isFeelingScore(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10;
}
