import { isISODate } from '../domain/dates';
import {
  DEFAULT_SETTINGS,
  emptyBank,
  GOAL_CATEGORIES,
  HOBBY_CATEGORIES,
  isGoalCategory,
  isHobbyCategory,
  MAX_REMINDERS,
  type Achievement,
  type Bank,
  type BankEntry,
  type Category,
  type DefiningIncident,
  type ChallengeItem,
  type ChallengeKind,
  type Settings,
  type YearRecord,
} from '../domain/types';
import { joinBody, splitBody } from './day';
import { parseNextMisogi, parseSealedNote, serializeNextMisogi, serializeSealedNote } from './links';
import { arr, bool, extras, FORMAT, obj, parseFrontmatter, serializeFrontmatter, str } from './frontmatter';

// ---------- year.md ----------

export function parseYear(text: string, fallback: string): YearRecord {
  const { data, body } = parseFrontmatter(text);
  const year = /^\d{4}$/.test(str(data.year)) ? str(data.year) : fallback;
  const d = obj(data.defining_incident);
  const source = str(d.source);
  const defining: DefiningIncident | null = str(d.text).trim()
    ? {
        text: str(d.text).trim(),
        source: source === 'extreme_thing' || source === 'extreme_incident' ? source : 'custom',
        month: /^\d{4}-\d{2}$/.test(str(d.month)) ? str(d.month) : null,
        date: isISODate(d.date) ? d.date : null,
      }
    : null;
  const { writing, media } = splitBody(body);
  const from = str(obj(data.defining_from).month_highlight);
  return {
    year,
    defining,
    definingFrom: defining && /^\d{4}-\d{2}$/.test(from) ? from : null,
    nextMisogi: parseNextMisogi(data.next_misogi),
    sealedNote: parseSealedNote(data.sealed_note),
    reviewedOn: isISODate(data.reviewed_on) ? data.reviewed_on : null,
    notes: writing === `The defining incident of ${year}.` ? '' : writing,
    // The sealed note's file sits in media/ but is never an attachment line.
    media,
    // Files from before the review existed: a recorded one counts as reviewed.
    reviewed: 'reviewed' in data ? bool(data.reviewed) : !!defining,
    skipped: typeof data.skipped === 'string' ? data.skipped : null,
    extra: extras(data, [
      'format',
      'year',
      'defining_incident',
      'defining_from',
      'next_misogi',
      'sealed_note',
      'reviewed_on',
      'reviewed',
      'skipped',
    ]),
  };
}

export function serializeYear(y: YearRecord): string {
  const data: Record<string, unknown> = { format: FORMAT, year: y.year };
  if (y.defining) {
    data.defining_incident = {
      text: y.defining.text,
      source: y.defining.source,
      ...(y.defining.month ? { month: y.defining.month } : {}),
      ...(y.defining.date ? { date: y.defining.date } : {}),
    };
  }
  // New keys are top level, so versions that rebuild nested keys still keep them.
  if (y.defining && y.definingFrom) data.defining_from = { month_highlight: y.definingFrom };
  if (y.nextMisogi) data.next_misogi = serializeNextMisogi(y.nextMisogi);
  if (y.sealedNote) data.sealed_note = serializeSealedNote(y.sealedNote);
  data.reviewed = y.reviewed;
  if (y.reviewedOn) data.reviewed_on = y.reviewedOn;
  if (y.skipped != null) data.skipped = y.skipped;
  Object.assign(data, y.extra);
  return serializeFrontmatter(
    data,
    joinBody(
      y.notes,
      y.media.filter((m) => m.path !== y.sealedNote?.path),
    ),
  );
}

// ---------- bank.md ----------

function entries(v: unknown): BankEntry[] {
  return arr(v)
    .map((e) => {
      const o = obj(e);
      return {
        id: str(o.id),
        text: str(o.text).trim(),
        added: isISODate(o.added) ? o.added : '2000-01-01',
        retired: bool(o.retired),
      };
    })
    .filter((e) => e.id && e.text);
}

export function parseBank(text: string): Bank {
  const { data } = parseFrontmatter(text);
  const bank = emptyBank();
  const g = obj(data.goals);
  const h = obj(data.hobbies);
  for (const c of GOAL_CATEGORIES) bank.goals[c] = entries(g[c]);
  for (const c of HOBBY_CATEGORIES) bank.hobbies[c] = entries(h[c]);
  return bank;
}

export function serializeBank(bank: Bank): string {
  const list = (es: BankEntry[]) =>
    es.map((e) => ({ id: e.id, text: e.text, added: e.added, ...(e.retired ? { retired: true } : {}) }));
  const data = {
    format: FORMAT,
    goals: Object.fromEntries(GOAL_CATEGORIES.map((c) => [c, list(bank.goals[c])])),
    hobbies: Object.fromEntries(HOBBY_CATEGORIES.map((c) => [c, list(bank.hobbies[c])])),
  };
  return serializeFrontmatter(
    data,
    'Ideas for daily goals and monthly hobbies, by category. Month files link to these by `id`.',
  );
}

// ---------- achievements.md ----------

export function parseAchievements(text: string): Achievement[] {
  const { data } = parseFrontmatter(text);
  return arr(data.achievements)
    .map((a): Achievement | null => {
      const o = obj(a);
      const cat = str(o.category);
      const category: Category | null = isGoalCategory(cat) || isHobbyCategory(cat) ? cat : null;
      if (!category || !isISODate(o.earned)) return null;
      return {
        kind: str(o.kind) === 'skill' ? 'skill' : str(o.kind) === 'hours' ? 'hours' : 'priority',
        bankId: str(o.bank_id),
        text: str(o.text),
        category,
        months: arr(o.months)
          .map((m) => str(m))
          .filter((m) => /^\d{4}-\d{2}$/.test(m)),
        percent: Number(o.percent) || 0,
        ...(Number(o.hours) > 0 ? { hours: Number(o.hours) } : {}),
        earned: o.earned,
      };
    })
    .filter((a): a is Achievement => a !== null);
}

export function serializeAchievements(list: Achievement[]): string {
  const data = {
    format: FORMAT,
    achievements: [...list]
      .sort((a, b) => (a.earned < b.earned ? -1 : 1))
      .map((a) => ({
        earned: a.earned,
        kind: a.kind,
        text: a.text,
        category: a.category,
        bank_id: a.bankId,
        months: a.months,
        percent: a.percent,
        ...(a.hours ? { hours: a.hours } : {}),
      })),
  };
  return serializeFrontmatter(
    data,
    'Achievements: the same priority goal or skill hobby for 3 months in a row, on more than 80% of days. Never taken away.',
  );
}

// ---------- settings.md ----------

export function parseSettings(text: string): Settings {
  const { data } = parseFrontmatter(text);
  const hour = Number(data.day_starts_at_hour);
  return {
    dayStartHour: Number.isInteger(hour) && hour >= 0 && hour <= 8 ? hour : DEFAULT_SETTINGS.dayStartHour,
    noteToReaders: str(data.note_to_future_readers),
    lastBackup: isISODate(data.last_backup) ? data.last_backup : null,
    // Before 1.18 every backup was the full ZIP, so an older file's last backup was a full one.
    lastFullBackup: isISODate(data.last_full_backup)
      ? data.last_full_backup
      : isISODate(data.last_backup)
        ? data.last_backup
        : null,
    firstUse: isISODate(data.first_use) ? data.first_use : null,
    reminders: parseReminders(data.reminders),
  };
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function parseReminders(v: unknown): Settings['reminders'] {
  return arr(v)
    .map((x) => obj(x))
    .filter((o) => typeof o.time === 'string' && TIME.test(o.time))
    .map((o) => ({ time: o.time as string, on: o.on !== false }))
    .slice(0, MAX_REMINDERS);
}

export function serializeSettings(s: Settings): string {
  return serializeFrontmatter({
    format: FORMAT,
    day_starts_at_hour: s.dayStartHour,
    first_use: s.firstUse,
    last_backup: s.lastBackup,
    last_full_backup: s.lastFullBackup,
    note_to_future_readers: s.noteToReaders,
    reminders: s.reminders.map((r) => ({ time: r.time, on: r.on })),
  });
}

// ---------- challenges/*.md ----------

const CHALLENGE_NOTE: Record<ChallengeKind, string> = {
  rejections: 'Rejection list: things done expecting to be turned down.',
  bucket: 'Bucket list: things to do in a lifetime.',
  experiments: 'Experiments: things tried on oneself, with dated observations in the notes.',
};

export function parseChallenges(text: string): ChallengeItem[] {
  const { data } = parseFrontmatter(text);
  return arr(data.items)
    .map((x): ChallengeItem | null => {
      const o = obj(x);
      if (!str(o.id) || !str(o.title).trim()) return null;
      const raw = str(o.outcome);
      // 1.10 wrote waiting / rejected / accepted.
      const outcome =
        raw === 'failed' || raw === 'rejected'
          ? 'failed'
          : raw === 'succeeded' || raw === 'accepted'
            ? 'succeeded'
            : 'open';
      return {
        id: str(o.id),
        title: str(o.title).trim(),
        date: isISODate(o.date) ? o.date : null,
        // Before the active box existed, everything logged had been attempted.
        started: 'started' in o ? bool(o.started) : true,
        outcome,
        notes: str(o.notes),
        added: isISODate(o.added) ? o.added : '2000-01-01',
      };
    })
    .filter((r): r is ChallengeItem => r !== null);
}

export function serializeChallenges(kind: ChallengeKind, list: ChallengeItem[]): string {
  const data = {
    format: FORMAT,
    items: list.map((r) => ({
      id: r.id,
      title: r.title,
      ...(r.date ? { date: r.date } : {}),
      started: r.started,
      outcome: r.outcome,
      added: r.added,
      ...(r.notes.trim() ? { notes: r.notes.trim() } : {}),
    })),
  };
  return serializeFrontmatter(
    data,
    `${CHALLENGE_NOTE[kind]} started: an active challenge. outcome: open, failed or succeeded.`,
  );
}
