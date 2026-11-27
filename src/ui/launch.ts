import { Settings } from 'react-native';

/**
 * Simulator screenshots only: `-LTStep <n>` opens a step-by-step ritual (month setup, Close month,
 * the year review) straight at step n, past its recap cards, so every step can be captured.
 * Unset on a phone, where it returns undefined and the flows start at their beginning.
 */
export function launchStep(): number | undefined {
  const v = Number(Settings.get('LTStep'));
  return Number.isInteger(v) && v >= 0 ? v : undefined;
}
