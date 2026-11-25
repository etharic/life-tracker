import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { monthDates, monthOf } from '@/domain/dates';
import { checkRates, hobbyBalance } from '@/domain/progress';
import { CATEGORY_LABEL, HOBBY_CATEGORIES } from '@/domain/types';
import { useToday } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { Bar } from '@/ui/bar';
import { Group } from '@/ui/group';
import { Divider, Section } from '@/ui/layout';
import { T } from '@/ui/text';
import { space } from '@/ui/theme';

/** Hobby bars wait for a few ticked days, so one tick never reads as a verdict. */
export const HOBBY_MIN_DAYS = 3;

const fmt = (h: number) => (Number.isInteger(h) ? `${h} h` : `${h.toFixed(1)} h`);

function Line({ name, value, share, label }: { name: string; value: string; share: number; label: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={label}>
      <View style={styles.line}>
        <T variant="body" style={styles.flex} numberOfLines={2}>
          {name}
        </T>
        <T variant="body" tone="ink2">
          {value}
        </T>
      </View>
      <Bar share={share} />
    </View>
  );
}

/**
 * How it's going, beside the month setup it informs: how often each weekly check held over the
 * last 12 closed weeks (from 4 weeks), and this month's hobby hours (from 3 ticked days).
 * The group is left out while neither has enough to show.
 */
export function HowItsGoing() {
  const months = useJournal((s) => s.months);
  const days = useJournal((s) => s.days);
  const today = useToday();
  const month = monthOf(today);
  const rates = useMemo(() => checkRates(Object.values(months), today), [months, today]);
  const hours = useMemo(() => hobbyBalance(month, today, (d) => days[d]), [month, today, days]);
  const tickedDays = useMemo(
    () => monthDates(month).filter((d) => d <= today && HOBBY_CATEGORIES.some((c) => days[d]?.hobbies[c])).length,
    [month, today, days],
  );
  const max = Math.max(...HOBBY_CATEGORIES.map((c) => hours[c]));
  const showHobbies = tickedDays >= HOBBY_MIN_DAYS && max > 0;
  if (!rates.length && !showHobbies) return null;
  return (
    <Group title="How it’s going">
      {rates.length ? (
        <View style={styles.part}>
          <T variant="subhead" weight="600" tone="ink2" style={styles.label}>
            Weekly checks, last 12 weeks
          </T>
          <Section flush>
            {rates.map((r, i) => (
              <View key={r.label}>
                {i > 0 ? <Divider /> : null}
                <Line
                  name={r.label}
                  value={`${r.done} of ${r.weeks}`}
                  share={r.done / r.weeks}
                  label={`${r.label}: done ${r.done} of the last ${r.weeks} weeks`}
                />
              </View>
            ))}
          </Section>
        </View>
      ) : null}
      {showHobbies ? (
        <View style={styles.part}>
          <T variant="subhead" weight="600" tone="ink2" style={styles.label}>
            Hobby hours this month
          </T>
          <Section flush>
            {HOBBY_CATEGORIES.map((c, i) => (
              <View key={c}>
                {i > 0 ? <Divider /> : null}
                <Line
                  name={CATEGORY_LABEL[c]}
                  value={fmt(hours[c])}
                  share={hours[c] / max}
                  label={`${CATEGORY_LABEL[c]}: ${fmt(hours[c])} this month`}
                />
              </View>
            ))}
          </Section>
        </View>
      ) : null}
    </Group>
  );
}

const styles = StyleSheet.create({
  part: { gap: space.s },
  label: { paddingHorizontal: space.xs },
  row: { gap: space.s, paddingVertical: space.m, paddingHorizontal: space.l },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  flex: { flex: 1 },
});
