import { isISODate } from '../domain/dates';
import {
  CHECK_KEYS,
  emptyMonth,
  emptyWeek,
  GOAL_CATEGORIES,
  HOBBY_CATEGORIES,
  isGoalCategory,
  isHobbyCategory,
  type Choice,
  type MonthId,
  type MonthRecord,
  type MonthSetup,
  type WeekRecord,
} from '../domain/types';
import { parseLink, serializeLink } from './links';
import { arr, bool, boolOrNull, extras, FORMAT, obj, parseFrontmatter, serializeFrontmatter, str } from './frontmatter';

const KNOWN = [
  'format',
  'month',
  'goals',
  'hobbies',
  'priority',
  'priority_kind',
  'skill',
  'weekly_checks',
  'outlook',
  'extreme_thing',
  'extreme_done',
  'outlook_done',
  'weeks',
  'extreme_incident',
  'close',
  'skipped',
  'highlight',
  'highlight_from_week',
  'week_highlight_from',
  'kevin_link',
] as const;

function choice(v: unknown): Choice | null {
  const o = obj(v);
  const text = str(o.text).trim();
  if (!text) return null;
  return { text, bankId: str(o.bank_id) };
}

function parseSetup(data: Record<string, unknown>): MonthSetup | null {
  const g = obj(data.goals);
  const h = obj(data.hobbies);
  const goals = Object.fromEntries(GOAL_CATEGORIES.map((c) => [c, choice(g[c])]));
  const hobbies = Object.fromEntries(HOBBY_CATEGORIES.map((c) => [c, choice(h[c])]));
  if (Object.values(goals).some((x) => !x) || Object.values(hobbies).some((x) => !x)) return null;
  const priority = str(data.priority);
  const skill = str(data.skill);
  const checks = obj(data.weekly_checks);
  return {
    goals: goals as MonthSetup['goals'],
    hobbies: hobbies as MonthSetup['hobbies'],
    priority: isGoalCategory(priority) ? priority : 'health',
    priorityKind: str(data.priority_kind) === 'break' ? 'break' : 'build',
    skill: isHobbyCategory(skill) ? skill : 'intellectual',
    weeklyChecks: {
      check_1: str(checks.check_1),
      check_2: str(checks.check_2),
      check_3: str(checks.check_3),
    },
    outlook: str(data.outlook),
    extremeThing: str(obj(data.extreme_thing).text ?? data.extreme_thing),
  };
}

function parseWeek(v: unknown): WeekRecord {
  const o = obj(v);
  const w = emptyWeek();
  const checks = obj(o.checks);
  for (const k of CHECK_KEYS) w.checks[k] = bool(checks[k]);
  w.highlight = str(o.highlight);
  w.priorities = arr(o.priorities)
    .map((p) => {
      const po = obj(p);
      return {
        text: str(po.text).trim(),
        done: bool(po.done),
        ...(bool(po.carried) ? { carried: true } : {}),
        // Written only for an ordinary commitment, so older files read as priorities.
        ...(po.priority === false ? { plain: true } : {}),
      };
    })
    .filter((p) => p.text);
  w.started = bool(o.started);
  w.closed = bool(o.closed);
  return w;
}

export function parseMonth(text: string, fallback: MonthId): MonthRecord {
  const { data } = parseFrontmatter(text);
  const month = typeof data.month === 'string' && /^\d{4}-\d{2}$/.test(data.month) ? data.month : fallback;
  const rec = emptyMonth(month);
  rec.setup = parseSetup(data);
  const et = obj(data.extreme_thing);
  rec.extremeDone = boolOrNull(et.done ?? data.extreme_done);
  rec.extremeDoneOn = rec.extremeDone === true && isISODate(et.done_on) ? et.done_on : null;
  rec.outlookDone = arr(data.outlook_done)
    .map((x) => str(x).trim())
    .filter(Boolean);
  for (const [id, w] of Object.entries(obj(data.weeks))) {
    if (/^\d{4}-W\d{2}$/.test(id)) rec.weeks[id] = parseWeek(w);
  }
  const inc = obj(data.extreme_incident);
  if (isISODate(inc.date)) {
    rec.extremeIncident = {
      date: inc.date,
      title: str(inc.title),
      mark: str(inc.mark) === 'negative' ? 'negative' : 'positive',
    };
  }
  const close = obj(data.close);
  if (isISODate(close.closed_on)) {
    rec.close = {
      closedOn: close.closed_on,
      keepPriority: bool(close.keep_priority),
      keepSkill: bool(close.keep_skill),
      keepLineup: bool(close.keep_lineup),
    };
  }
  for (const [id, note] of Object.entries(obj(data.skipped))) rec.skipped[id] = str(note);
  rec.highlight = str(data.highlight).trim();
  const hw = str(data.highlight_from_week);
  rec.highlightFromWeek = rec.highlight && /^\d{4}-W\d{2}$/.test(hw) ? hw : null;
  for (const [id, d] of Object.entries(obj(data.week_highlight_from)))
    if (/^\d{4}-W\d{2}$/.test(id) && isISODate(d)) rec.weekHighlightFrom[id] = d;
  rec.kevinLink = parseLink(data.kevin_link);
  // An incomplete (hand-edited) setup is kept as written instead of being dropped on save.
  const setupKeys = ['goals', 'hobbies', 'priority', 'priority_kind', 'skill', 'weekly_checks', 'outlook'];
  rec.extra = extras(data, rec.setup ? KNOWN : KNOWN.filter((k) => !setupKeys.includes(k)));
  return rec;
}

export function serializeMonth(rec: MonthRecord): string {
  const data: Record<string, unknown> = { format: FORMAT, month: rec.month };
  const s = rec.setup;
  if (s) {
    data.goals = Object.fromEntries(
      GOAL_CATEGORIES.map((c) => [c, { text: s.goals[c].text, bank_id: s.goals[c].bankId }]),
    );
    data.hobbies = Object.fromEntries(
      HOBBY_CATEGORIES.map((c) => [c, { text: s.hobbies[c].text, bank_id: s.hobbies[c].bankId }]),
    );
    data.priority = s.priority;
    data.priority_kind = s.priorityKind;
    data.skill = s.skill;
    data.weekly_checks = { ...s.weeklyChecks };
    data.outlook = s.outlook;
    data.extreme_thing = {
      text: s.extremeThing,
      done: rec.extremeDone,
      ...(rec.extremeDone === true && rec.extremeDoneOn ? { done_on: rec.extremeDoneOn } : {}),
    };
    if (rec.outlookDone.length) data.outlook_done = [...rec.outlookDone];
  }
  const weekIds = Object.keys(rec.weeks).sort();
  if (weekIds.length) {
    data.weeks = Object.fromEntries(
      weekIds.map((id) => {
        const w = rec.weeks[id];
        return [
          id,
          {
            checks: { ...w.checks },
            highlight: w.highlight,
            priorities: w.priorities.map((p) => ({
              text: p.text,
              done: p.done,
              ...(p.carried ? { carried: true } : {}),
              ...(p.plain ? { priority: false } : {}),
            })),
            started: w.started,
            closed: w.closed,
          },
        ];
      }),
    );
  }
  if (rec.extremeIncident) {
    data.extreme_incident = { ...rec.extremeIncident };
  }
  if (rec.close) {
    data.close = {
      closed_on: rec.close.closedOn,
      keep_priority: rec.close.keepPriority,
      keep_skill: rec.close.keepSkill,
      keep_lineup: rec.close.keepLineup,
    };
  }
  if (Object.keys(rec.skipped).length) data.skipped = { ...rec.skipped };
  // New keys are top level (older versions keep unknown top-level keys, not nested ones).
  if (rec.highlight) data.highlight = rec.highlight;
  if (rec.highlight && rec.highlightFromWeek) data.highlight_from_week = rec.highlightFromWeek;
  const from = Object.keys(rec.weekHighlightFrom).sort();
  if (from.length) data.week_highlight_from = Object.fromEntries(from.map((id) => [id, rec.weekHighlightFrom[id]]));
  if (rec.kevinLink) data.kevin_link = serializeLink(rec.kevinLink);
  Object.assign(data, rec.extra);
  return serializeFrontmatter(data);
}
