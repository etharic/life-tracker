import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { formatFull } from '@/domain/dates';
import { forwardWindowOpen, isSealed, misogiFor } from '@/domain/misogi';
import { misogiOf, NAMES } from '@/domain/names';
import { emptyYear } from '@/domain/types';
import { MediaStrip } from '@/features/day/media';
import { useToday } from '@/features/hooks';
import { judgeMisogi } from '@/features/year/commit';
import { SealedCard } from '@/features/year/sealed-card';
import { useJournal } from '@/state/journal';
import { Button, TextAction } from '@/ui/controls';
import { Group } from '@/ui/group';
import { Icon } from '@/ui/icon';
import { Row, Screen, Section } from '@/ui/layout';
import { T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

/**
 * A year's page: what defined it, the misogi set for it and whether it was done, the misogi it
 * set for the next year, and the voice note sealed at its review. Anything missing from the
 * sitting can be set here afterwards (the safety net), so nothing is lost to a skipped step.
 */
export default function YearPage() {
  const params = useLocalSearchParams<{ year: string }>();
  const y = typeof params.year === 'string' && /^\d{4}$/.test(params.year) ? params.year : '';
  const today = useToday();
  const years = useJournal((s) => s.years);
  const rec = years[y] ?? emptyYear(y || '2000');
  const next = String(Number(y) + 1);
  if (!y) return null;

  const mine = misogiFor(years, y);
  const thisYear = today.slice(0, 4);
  const ended = today >= `${y}-12-26` || thisYear > y;
  const windowOpen = rec.reviewed && forwardWindowOpen(rec, y, today);
  const canSetNext = rec.reviewed && !rec.nextMisogi && today <= `${next}-12-31`;
  const editableNote = !!rec.sealedNote && windowOpen && isSealed(rec.sealedNote, today);

  return (
    <>
      <Stack.Screen options={{ title: y, headerLargeTitleEnabled: true }} />
      <Screen>
        <View style={styles.groups}>
          <Group
            title={NAMES.defining}
            trailing={
              rec.defining && y <= thisYear ? (
                <TextAction title="Edit" onPress={() => router.push(`/year-close/${y}?mode=edit`)} />
              ) : undefined
            }
          >
            {rec.defining ? (
              <Section>
                <View style={styles.gap}>
                  {rec.defining.date ? (
                    <T variant="footnote" tone="ink2">
                      {formatFull(rec.defining.date)}
                    </T>
                  ) : null}
                  <T variant="journalTitle">{rec.defining.text}</T>
                  {rec.notes ? <T variant="journalBody">{rec.notes}</T> : null}
                  <MediaStrip date={y} media={rec.media} />
                </View>
              </Section>
            ) : y <= thisYear ? (
              <Section flush>
                <Row
                  leading={<Icon name="plus.circle.fill" size={20} color={colors.accent} />}
                  title={`Record ${y}’s ${NAMES.defining.toLowerCase()}`}
                  onPress={() => router.push(`/year-close/${y}?mode=edit`)}
                />
              </Section>
            ) : null}
          </Group>

          {mine ? (
            <Group title={misogiOf(y)}>
              <Section>
                <View style={styles.gap}>
                  <T variant="journalTitle">{mine.text}</T>
                  {mine.done === true ? (
                    <View style={styles.row}>
                      <T variant="subhead" tone="accent" style={styles.flex}>
                        {mine.doneOn ? `Done, ${formatFull(mine.doneOn)}` : 'Done'}
                      </T>
                      <TextAction title="Not done" tone="ink2" onPress={() => void judgeMisogi(y, false)} />
                    </View>
                  ) : mine.done === false ? (
                    <View style={styles.row}>
                      <T variant="subhead" tone="ink2" style={styles.flex}>
                        Not this time
                      </T>
                      <TextAction title="It was done" onPress={() => void judgeMisogi(y, true)} />
                    </View>
                  ) : y > thisYear ? (
                    <T variant="subhead" tone="ink2">
                      Starts 1 January
                    </T>
                  ) : ended ? (
                    <View style={styles.gap}>
                      <T variant="subhead" weight="600" tone="ink2">
                        Did you do it?
                      </T>
                      <View style={styles.buttons}>
                        <View style={styles.flex}>
                          <Button title="Done" compact onPress={() => void judgeMisogi(y, true)} />
                        </View>
                        <View style={styles.flex}>
                          <Button
                            title="Not this time"
                            kind="secondary"
                            compact
                            onPress={() => void judgeMisogi(y, false)}
                          />
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.row}>
                      <T variant="subhead" tone="ink2" style={styles.flex}>
                        In progress
                      </T>
                      <TextAction title="Done it?" onPress={() => void judgeMisogi(y, true, today)} />
                    </View>
                  )}
                </View>
              </Section>
            </Group>
          ) : null}

          {rec.nextMisogi || canSetNext ? (
            <Group
              title={misogiOf(next)}
              trailing={
                // The misogi can be changed at any time, not only during the review window.
                rec.nextMisogi ? <TextAction title="Change" onPress={() => router.push(`/misogi/${y}`)} /> : undefined
              }
            >
              {rec.nextMisogi ? (
                <Section>
                  <View style={styles.gap}>
                    <T variant="journalTitle">{rec.nextMisogi.text}</T>
                    <T variant="footnote" tone="ink2">{`Set at the review of ${y}.`}</T>
                  </View>
                </Section>
              ) : (
                <Section flush>
                  <Row
                    leading={<Icon name="flag.checkered" size={20} color={colors.accent} />}
                    title="Set next year’s misogi"
                    onPress={() => router.push(`/misogi/${y}`)}
                  />
                </Section>
              )}
            </Group>
          ) : null}

          {rec.sealedNote ? (
            <Group title="Sealed note">
              <SealedCard year={y} note={rec.sealedNote} today={today} editable={editableNote} />
            </Group>
          ) : windowOpen ? (
            <Group title="Sealed note">
              <Section flush>
                <Row
                  leading={<Icon name="mic.fill" size={20} color={colors.accent} />}
                  title="Seal a voice note"
                  value={`Opens 25 Dec ${next}`}
                  onPress={() => router.push(`/record/sealed-${y}`)}
                />
              </Section>
            </Group>
          ) : null}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  groups: { gap: space.xxl },
  gap: { gap: space.s },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  buttons: { flexDirection: 'row', gap: space.m },
});
