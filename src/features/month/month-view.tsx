import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatFull, monthName, weekIndexInMonth, weeksOfMonth, weekOf } from '@/domain/dates';
import { weekScore } from '@/domain/progress';
import { waitingPrompts } from '@/domain/prompts';
import { outlookItems, type MonthId } from '@/domain/types';
import { useDayLookup, useMonth, useMonthRings, usePromptInput, useToday } from '@/features/hooks';
import { promptHref } from '@/features/prompts/prompt-card';
import { useJournal } from '@/state/journal';
import { Button, CheckRow, Field, TextAction } from '@/ui/controls';
import { Divider, Empty, Row, Rows, Section } from '@/ui/layout';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, radius, space } from '@/ui/theme';
import { Group, Panel } from '@/ui/group';

import { DoneStamp, STAMP_ROOM } from './done-stamp';
import { RingGroup } from './rings';

/**
 * A month, from the summary down to the detail:
 *   Goals, Hobbies   the eight rings, on an ember and a sage band
 *   (untitled)       the extreme thing, and the outlook as a checklist ticked off during the month
 *   Weeks            one strip of weeks, each with its score
 * Prompts that were skipped wait at the top, because they want something done.
 */

/** A labelled line in a card: the label small, the content in the person's own words. */
function PlanRow({
  label,
  text,
  note,
  lines,
  onPress,
}: {
  label: string;
  text: string;
  note?: string;
  lines?: number;
  onPress?: () => void;
}) {
  const body = (
    <View style={styles.planRow}>
      <T variant="footnote" weight="600" tone="ink2">
        {label}
      </T>
      <T variant="journalBody" weight="600" numberOfLines={lines}>
        {text}
      </T>
      {note ? (
        <T variant="footnote" tone="ink2">
          {note}
        </T>
      ) : null}
    </View>
  );
  return onPress ? (
    <Press feedback="highlight" onPress={onPress} accessibilityLabel={`${label}: ${text}`}>
      {body}
    </Press>
  ) : (
    body
  );
}

/** The month's plan in one card: the extreme thing, the outlook (tap to edit), the incident once chosen. */
function PlanGroup({ month }: { month: MonthId }) {
  const rec = useMonth(month);
  const today = useToday();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  if (!rec.setup) return null;
  const setup = rec.setup;
  const inc = rec.extremeIncident;
  const status = rec.extremeDone === false ? 'Not done this time' : undefined;
  const items = outlookItems(setup.outlook);
  const done = new Set(rec.outlookDone);
  const toggle = (item: string) =>
    useJournal.getState().updateMonth(month, (m) => {
      m.outlookDone = m.outlookDone.includes(item) ? m.outlookDone.filter((x) => x !== item) : [...m.outlookDone, item];
    });
  const edit = () => {
    setDraft(setup.outlook);
    setEditing(true);
  };
  const save = () => {
    useJournal.getState().updateMonth(month, (m) => {
      if (m.setup) m.setup.outlook = draft.trim();
    });
    setEditing(false);
  };

  return (
    <Group>
      <Panel>
        <View style={rec.extremeDone === true ? styles.stampRoom : undefined}>
          <PlanRow label="Kevin’s Rule" text={setup.extremeThing || 'Not set'} note={status} />
          {rec.extremeDone === true ? <DoneStamp date={rec.extremeDoneOn} fresh={rec.extremeDoneOn === today} /> : null}
        </View>
        <Divider />
        {editing ? (
          <View style={styles.planRow}>
            <T variant="footnote" weight="600" tone="ink2">
              Outlook
            </T>
            <Field value={draft} onChangeText={setDraft} multiline autoFocus minHeight={110} />
            <View style={styles.actions}>
              <TextAction title="Done" onPress={save} />
            </View>
          </View>
        ) : items.length ? (
          <View style={styles.planRow}>
            <View style={styles.labelRow}>
              <T variant="footnote" weight="600" tone="ink2" style={styles.flex}>
                Outlook
              </T>
              <TextAction title="Edit" onPress={edit} />
            </View>
            {/* The same checklist as the week's commitments: tick, grey, crossed through. */}
            <View style={styles.outlook}>
              {items.map((item) => (
                <CheckRow key={item} label={item} strike checked={done.has(item)} onToggle={() => toggle(item)} />
              ))}
            </View>
          </View>
        ) : (
          <PlanRow label="Outlook" text="Tap to write the outlook for the month" onPress={edit} />
        )}
        {inc ? (
          <>
            <Divider />
            <PlanRow
              label={`Extreme incident, ${inc.mark}`}
              text={inc.title || formatFull(inc.date)}
              note={formatFull(inc.date)}
              onPress={() => router.push(`/day/${inc.date}`)}
            />
          </>
        ) : null}
      </Panel>
    </Group>
  );
}

/**
 * The weeks in one card: one pill per week with its score (see weekScore). The current week is
 * filled; weeks still to come show a dash. The detail of a week lives on Today and in Look back.
 */
function WeeksGroup({ month }: { month: MonthId }) {
  const rec = useMonth(month);
  const today = useToday();
  const lookup = useDayLookup();
  const weeks = useMemo(() => weeksOfMonth(month), [month]);
  if (!rec.setup) return null;
  const skill = rec.setup.skill;
  const current = weekOf(today);

  return (
    <Group title="Weeks">
      <Panel>
        <View style={styles.weekPills}>
          {weeks.map((wk) => {
            const score = weekScore(wk, today, lookup, rec.weeks[wk], skill);
            const on = wk === current;
            const color = on ? colors.bg : score == null ? colors.ink3 : colors.ink;
            return (
              <View
                key={wk}
                style={[styles.flex, styles.weekPill, on ? styles.weekPillOn : styles.weekPillOff]}
                accessible
                accessibilityLabel={`Week ${weekIndexInMonth(wk)}${score == null ? ', not started' : `, ${score} percent`}`}
              >
                <T variant="footnote" weight="600" chrome style={{ color }}>
                  {`W${weekIndexInMonth(wk)}`}
                </T>
                <T variant="headline" chrome style={[styles.tabular, { color }]}>
                  {score == null ? '–' : `${score}%`}
                </T>
              </View>
            );
          })}
        </View>
      </Panel>
    </Group>
  );
}

function Waiting({ month }: { month: MonthId }) {
  const input = usePromptInput();
  const waiting = waitingPrompts(month, input);
  if (!waiting.length) return null;
  const rec = input.months.get(month);
  return (
    <Section title="Waiting for you" flush tone="accent">
      <Rows>
        {waiting.map((p) => (
          <Row
            key={p.id}
            title={p.title}
            detail={rec?.skipped[p.id] ? `Skipped: ${rec.skipped[p.id]}` : 'Skipped'}
            onPress={() => router.push(promptHref(p))}
          />
        ))}
      </Rows>
    </Section>
  );
}

export function MonthView({ month }: { month: MonthId }) {
  const rec = useMonth(month);
  const rings = useMonthRings(month);

  if (!rec.setup) {
    return (
      <View style={styles.groups}>
        <Waiting month={month} />
        <Section>
          <Empty
            title={`${monthName(month)} is not set up`}
            body="Choose four goals, four hobbies, three weekly commitments and Kevin’s Rule."
            action={
              <Button title={`Set up ${monthName(month)}`} compact onPress={() => router.push(`/setup/${month}`)} />
            }
          />
        </Section>
      </View>
    );
  }
  return (
    <View style={styles.groups}>
      <Waiting month={month} />
      <View style={styles.bands}>
        <RingGroup label="Goals" kind="goal" setup={rec.setup} stats={rings.goals} />
        <RingGroup label="Hobbies" kind="hobby" setup={rec.setup} stats={rings.hobbies} />
      </View>
      <PlanGroup month={month} />
      <WeeksGroup month={month} />
    </View>
  );
}

const styles = StyleSheet.create({
  stampRoom: { paddingRight: STAMP_ROOM },
  flex: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  groups: { gap: space.xxl },
  bands: { gap: space.s },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  planRow: { gap: space.xs, paddingHorizontal: space.l, paddingVertical: space.m + 2 },
  weekPills: { flexDirection: 'row', gap: space.xs, padding: space.s },
  weekPill: { alignItems: 'center', gap: 5, paddingVertical: space.s, borderRadius: radius.control },
  weekPillOn: { backgroundColor: colors.ink },
  weekPillOff: { backgroundColor: colors.fill },
  // Rows reach the card's edges: the box lines up with the label above it.
  outlook: { marginHorizontal: -space.l },
});
