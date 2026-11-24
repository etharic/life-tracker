import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { monthOf } from '@/domain/dates';
import { checkRates, hobbyBalance } from '@/domain/progress';
import { CATEGORY_LABEL, HOBBY_CATEGORIES } from '@/domain/types';
import { useToday } from '@/features/hooks';
import { useJournal } from '@/state/journal';
import { Group } from '@/ui/group';
import { Divider, Section } from '@/ui/layout';
import { T } from '@/ui/text';
import { colors, radius, space } from '@/ui/theme';

function Bar({ share }: { share: number }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.round(Math.min(1, share) * 100)}%` }]} />
    </View>
  );
}

/** How the weekly checks held over the last 12 closed weeks. Hidden until a check has 4 weeks. */
export function CheckRates() {
  const months = useJournal((s) => s.months);
  const today = useToday();
  const rows = useMemo(() => checkRates(Object.values(months), today), [months, today]);
  if (!rows.length) return null;
  return (
    <Group title="Weekly checks">
      <Section flush>
        {rows.map((r, i) => (
          <View key={r.label}>
            {i > 0 ? <Divider /> : null}
            <View
              style={styles.row}
              accessible
              accessibilityLabel={`${r.label}: done ${r.done} of the last ${r.weeks} weeks`}
            >
              <View style={styles.line}>
                <T variant="body" style={styles.flex} numberOfLines={2}>
                  {r.label}
                </T>
                <T variant="body" tone="ink2">{`${r.done} of ${r.weeks}`}</T>
              </View>
              <Bar share={r.done / r.weeks} />
            </View>
          </View>
        ))}
      </Section>
    </Group>
  );
}

const fmt = (h: number) => (Number.isInteger(h) ? `${h} h` : `${h.toFixed(1)} h`);

/** This month's hobby hours across the four kinds. Hidden while nothing is ticked. */
export function HobbyBalance() {
  const days = useJournal((s) => s.days);
  const today = useToday();
  const hours = useMemo(() => hobbyBalance(monthOf(today), today, (d) => days[d]), [days, today]);
  const max = Math.max(...HOBBY_CATEGORIES.map((c) => hours[c]));
  if (!max) return null;
  return (
    <Group title="Hobby balance this month">
      <Section flush>
        {HOBBY_CATEGORIES.map((c, i) => (
          <View key={c}>
            {i > 0 ? <Divider /> : null}
            <View style={styles.row} accessible accessibilityLabel={`${CATEGORY_LABEL[c]}: ${fmt(hours[c])}`}>
              <View style={styles.line}>
                <T variant="body" style={styles.flex}>
                  {CATEGORY_LABEL[c]}
                </T>
                <T variant="body" tone="ink2">
                  {fmt(hours[c])}
                </T>
              </View>
              <Bar share={hours[c] / max} />
            </View>
          </View>
        ))}
      </Section>
    </Group>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.s, paddingVertical: space.m, paddingHorizontal: space.l },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  flex: { flex: 1 },
  track: { height: 6, borderRadius: radius.s, backgroundColor: colors.fill, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.s, backgroundColor: colors.accent },
});
