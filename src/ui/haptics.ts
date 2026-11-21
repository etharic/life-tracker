import * as Haptics from 'expo-haptics';

/** One per user action, always paired with a visual change. Never on navigation. */
export const haptic = {
  /** A tick, a feeling chosen, a segment changed. */
  select: () => void Haptics.selectionAsync().catch(() => undefined),
  /** Something committed: a card finished, a sheet saved. */
  commit: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined),
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined),
};
