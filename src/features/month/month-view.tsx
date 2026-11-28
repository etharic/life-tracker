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
import { AddButton, Button, CheckRow, Field, TextAction } from '@/ui/controls';
import { Empty, Row, Rows, Section } from '@/ui/layout';
import { Press } from '@/ui/press';
import { T } from '@/ui/text';
import { colors, radius, space } from '@/ui/theme';
import { Ribbon } from '@/ui/ribbon';

import { DoneStamp, STAMP_ROOM } from './done-stamp';
import { RingGroup } from './rings';

/**
 * A month, from the summary down to the detail:
 *   Goals, Hobbies   the eight rings, on an ember and a sage band
 *   Kevin's Rule, Outlook   ribbons: the extreme thing, and the outlook as a checklist ticked off during the month
 *   Weeks            one ribbon of weeks, each with its score
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

/**
 * The month's plan as ribbons: Kevin's Rule, the Outlook (a checklist, + to add or edit), and the
 * extreme incident once chosen.
 */
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
    <View style={styles.planRibbons}>
      <Ribbon label="Kevin’s Rule" tint={colors.accent} soft={colors.fill}>
        <View style={[styles.ribbonText, rec.extremeDone === true && styles.stampRoom]}>
          <T variant="journalBody" weight="600">
            {setup.extremeThing || 'Not set'}
          </T>
          {status ? (
            <T variant="footnote" tone="ink2">
              {status}
            </T>
          ) : null}
          {rec.extremeDone === true ? <DoneStamp date={rec.extremeDoneOn} fresh={rec.extremeDoneOn === today} /> : null}
        </View>
      </Ribbon>
      <Ribbon label="Outlook" tint={colors.ink2} soft={colors.fill}>
        {editing ? (
          <View style={styles.ribbonText}>
            <Field value={draft} onChangeText={setDraft} multiline autoFocus minHeight={110} />
            <View style={styles.actions}>
              <TextAction title="Done" onPress={save} />
            </View>
          </View>
        ) : items.length ? (
          // The same checklist as the week's commitments; the + sits at the end of the last line.
          <View>
            {items.map((item, i) => (
              <View key={item} style={styles.line}>
                <View style={styles.flex}>
                  <CheckRow label={item} strike checked={done.has(item)} onToggle={() => toggle(item)} />
                </View>
                {i === items.length - 1 ? (
                  <View style={styles.plusEnd}>
                    <AddButton onPress={edit} label="Add to or edit the outlook" />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.line}>
            <T variant="body" tone="ink2" style={[styles.flex, styles.ribbonText]}>
              The outlook for the month
            </T>
            <View style={styles.plusEnd}>
              <AddButton onPress={edit} label="Write the outlook" />
            </View>
          </View>
        )}
      </Ribbon>
      {inc ? (
        <Ribbon label="Highlight" tint={colors.ink2} soft={colors.fill}>
          <PlanRow
            label={`The day that stood out, ${inc.mark}`}
            text={inc.title || formatFull(inc.date)}
            note={formatFull(inc.date)}
            onPress={() => router.push(`/day/${inc.date}`)}
          />
        </Ribbon>
      ) : null}
    </View>
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
    <Ribbon label="Weeks" tint={colors.ink2} soft={colors.fill}>
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
    </Ribbon>
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
      {/* Every ribbon lies on the next, a hairline of paper between them: no gaps. */}
      <View style={styles.ribbons}>
        <RingGroup label="Goals" kind="goal" setup={rec.setup} stats={rings.goals} />
        <RingGroup label="Hobbies" kind="hobby" setup={rec.setup} stats={rings.hobbies} />
        <PlanGroup month={month} />
        <WeeksGroup month={month} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stampRoom: { paddingRight: STAMP_ROOM },
  flex: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  groups: { gap: space.xxl },
  ribbons: { gap: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  planRow: { gap: space.xs, paddingHorizontal: space.l, paddingVertical: space.m + 2 },
  weekPills: { flexDirection: 'row', gap: space.xs },
  weekPill: { alignItems: 'center', gap: 5, paddingVertical: space.s, borderRadius: radius.control },
  weekPillOn: { backgroundColor: colors.ink },
  weekPillOff: { backgroundColor: colors.surface },
  // Rows reach the card's edges: the box lines up with the label above it.
  // Kevin's Rule and the Outlook lie one on the other, a hairline of paper between them.
  planRibbons: { gap: 2 },
  ribbonText: { paddingHorizontal: space.s, paddingVertical: space.s, gap: space.xs },
  line: { flexDirection: 'row', alignItems: 'center' },
  plusEnd: { paddingLeft: space.xs },
});
