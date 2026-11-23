import { ActionSheetIOS } from 'react-native';

import type { ListAnswer, ListQuestion } from '@/domain/misogi';

/**
 * Shows a one-tap list question as an action sheet. Resolves with the answer, or null when it
 * was cancelled (nothing is recorded then, so it is asked again next time).
 */
export function askList(q: ListQuestion): Promise<ListAnswer | null> {
  return new Promise((resolve) => {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: q.title, options: [...q.answers.map((a) => a.label), 'Cancel'], cancelButtonIndex: q.answers.length },
      (i) => resolve(i < q.answers.length ? q.answers[i] : null),
    );
  });
}
