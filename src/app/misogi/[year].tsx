import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { misogiCandidates } from '@/domain/misogi';
import { misogiOf } from '@/domain/names';
import { commitNextMisogi } from '@/features/year/commit';
import { useJournal } from '@/state/journal';
import { Button } from '@/ui/controls';
import { haptic } from '@/ui/haptics';
import { Screen, ScreenHeader } from '@/ui/layout';
import { ModalHeader } from '@/ui/modal';
import { SuggestPicker } from '@/ui/suggest-picker';
import { T } from '@/ui/text';
import { colors } from '@/ui/theme';

/**
 * The misogi set at year `year`'s review, for the year after: set or changed from Look back
 * (during the edit window, or as the safety net when the sitting ran without it).
 */
export default function SetMisogi() {
  const params = useLocalSearchParams<{ year: string }>();
  const y = typeof params.year === 'string' && /^\d{4}$/.test(params.year) ? params.year : '';
  const rec = useJournal((s) => s.years[y]);
  const bucket = useJournal((s) => s.challenges.bucket);
  const items = useMemo(
    () =>
      misogiCandidates(bucket).map((b) => ({
        key: `bucket:${b.id}`,
        text: b.title,
        sub: b.started ? 'Bucket list, active' : 'Bucket list, not started',
      })),
    [bucket],
  );
  const [text, setText] = useState(rec?.nextMisogi?.text ?? '');
  const [pick, setPick] = useState<string | null>(rec?.nextMisogi?.link?.id ?? null);
  if (!y) return null;
  const next = String(Number(y) + 1);

  const save = async () => {
    await commitNextMisogi(y, text, pick);
    haptic.success();
    router.back();
  };

  return (
    <View style={styles.fill}>
      <ModalHeader title="" onClose={() => router.back()} />
      <Screen footer={<Button title="Save" disabled={!text.trim()} onPress={() => void save()} />}>
        <ScreenHeader overline={`Set at the review of ${y}`} title={misogiOf(next)} />
        <T variant="body">{`One hard thing to do in ${next}. Plan shows it all year.`}</T>
        <SuggestPicker
          label="The challenge"
          items={items}
          value={text}
          onChange={(t, from) => {
            setText(t);
            setPick(from ? from.key.slice('bucket:'.length) : null);
          }}
          placeholder="Climb a 4,000 m peak"
          heading="From your bucket list"
          footer={
            !pick && text.trim() ? (
              <T variant="footnote" tone="ink2">
                It will be added to your bucket list.
              </T>
            ) : null
          }
        />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
});
