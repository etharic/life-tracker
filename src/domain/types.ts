/** Local calendar date, YYYY-MM-DD. Never a UTC timestamp. */
export type ISODate = string;
/** Calendar month, YYYY-MM. */
export type MonthId = string;
/** ISO week (Monday to Sunday), YYYY-Www. */
export type WeekId = string;

export const GOAL_CATEGORIES = ['health', 'wealth', 'wise', 'versatility'] as const;
export const HOBBY_CATEGORIES = ['intellectual', 'physical', 'creative', 'social'] as const;
export const CHECK_KEYS = ['check_1', 'check_2', 'check_3'] as const;

export type GoalCategory = (typeof GOAL_CATEGORIES)[number];
export type HobbyCategory = (typeof HOBBY_CATEGORIES)[number];
export type Category = GoalCategory | HobbyCategory;
export type CheckKey = (typeof CHECK_KEYS)[number];
export type BankKind = 'goals' | 'hobbies';

export const CATEGORY_LABEL: Record<Category, string> = {
  health: 'Healthy',
  wealth: 'Wealthy',
  wise: 'Wise',
  versatility: 'Versatile',
  intellectual: 'Intellectual',
  physical: 'Physical',
  creative: 'Creative',
  social: 'Social',
};

export function isGoalCategory(c: string): c is GoalCategory {
  return (GOAL_CATEGORIES as readonly string[]).includes(c);
}
export function isHobbyCategory(c: string): c is HobbyCategory {
  return (HOBBY_CATEGORIES as readonly string[]).includes(c);
}
export function kindOf(c: Category): BankKind {
  return isGoalCategory(c) ? 'goals' : 'hobbies';
}

export interface MediaRef {
  kind: 'photo' | 'audio' | 'video';
  /** Relative to the month folder, e.g. media/2026-11-19-1.jpg */
  path: string;
}

export interface DayEntry {
  date: ISODate;
  title: string;
  feeling: number | null;
  goals: Record<GoalCategory, boolean>;
  hobbies: Record<HobbyCategory, boolean>;
  /** Time on a ticked hobby when it was more than the hour a tick stands for. */
  hobbyHours: Partial<Record<HobbyCategory, number>>;
  prioritiesDone: string[];
  /** Free writing without the media links. */
  writing: string;
  media: MediaRef[];
  /** Frontmatter keys this version does not know, kept on save. */
  extra: Record<string, unknown>;
}

export interface Choice {
  text: string;
  bankId: string;
}

export interface MonthSetup {
  goals: Record<GoalCategory, Choice>;
  hobbies: Record<HobbyCategory, Choice>;
  priority: GoalCategory;
  priorityKind: 'build' | 'break';
  skill: HobbyCategory;
  weeklyChecks: Record<CheckKey, string>;
  outlook: string;
  extremeThing: string;
}

export interface Priority {
  text: string;
  done: boolean;
  /** Copied forward from the previous week. */
  carried?: boolean;
  /** An ordinary commitment for the week, not a priority (no star). Absent means a priority. */
  plain?: boolean;
}

export interface WeekRecord {
  checks: Record<CheckKey, boolean>;
  highlight: string;
  priorities: Priority[];
  /** The Monday card was completed. */
  started: boolean;
  /** The Sunday card was completed. */
  closed: boolean;
}

export interface ExtremeIncident {
  date: ISODate;
  title: string;
  mark: 'positive' | 'negative';
}

export interface MonthClose {
  closedOn: ISODate;
  keepPriority: boolean;
  keepSkill: boolean;
  keepLineup: boolean;
}

export interface MonthRecord {
  month: MonthId;
  setup: MonthSetup | null;
  extremeDone: boolean | null;
  /** The day Kevin's Rule was marked done, when it was marked from Today. */
  extremeDoneOn: ISODate | null;
  /** Outlook items marked complete during the month, by their text. */
  outlookDone: string[];
  weeks: Record<WeekId, WeekRecord>;
  extremeIncident: ExtremeIncident | null;
  close: MonthClose | null;
  /** The month's highlight, chosen at month close (often one of its week highlights). */
  highlight: string;
  /** The week whose highlight it was, while the text still matches it. */
  highlightFromWeek: WeekId | null;
  /** Week id -> the day whose title became that week's highlight (while it still matches). */
  weekHighlightFrom: Record<WeekId, ISODate>;
  /** Kevin's Rule taken from a challenge list. */
  kevinLink: ListLink | null;
  /** Prompt id -> note written when it was skipped. */
  skipped: Record<string, string>;
  extra: Record<string, unknown>;
}

/** A link from a misogi or Kevin's Rule to the challenge-list item it came from. */
export interface ListLink {
  kind: 'rejections' | 'bucket';
  id: string;
  /** The one-tap "Mark it active?" question: answered yes, no, or not asked yet. */
  confirmed: boolean | null;
  /** The one-tap question asked when it was judged: answered (true or false) or not yet (null). */
  outcomeConfirmed: boolean | null;
}

/** The challenge committed at a year's review for the following year. */
export interface NextMisogi {
  text: string;
  link: ListLink | null;
  /** Judged at the following year's review (or earlier, when done early). */
  done: boolean | null;
  doneOn: ISODate | null;
}

/** A voice note to the future self, locked in the app until its date. */
export interface SealedNote {
  /** Relative to the year folder, e.g. media/sealed-2026.m4a */
  path: string;
  sealedUntil: ISODate;
}

export interface DefiningIncident {
  text: string;
  source: 'extreme_thing' | 'extreme_incident' | 'custom';
  month: MonthId | null;
  date: ISODate | null;
}

export interface YearRecord {
  year: string;
  /** The defining moment: what defined the year. Its date (optional) is defining.date. */
  defining: DefiningIncident | null;
  /** The month whose highlight became the defining moment, while the text still matches. */
  definingFrom: MonthId | null;
  /** Next year's misogi, committed at this year's review. */
  nextMisogi: NextMisogi | null;
  /** A voice note sealed at this year's review. */
  sealedNote: SealedNote | null;
  /** The day the review sitting was held. */
  reviewedOn: ISODate | null;
  /** Notes written with the defining moment, and its photos and voice notes. */
  notes: string;
  media: MediaRef[];
  /** The year-end review (25 December) was confirmed. */
  reviewed: boolean;
  skipped: string | null;
  extra: Record<string, unknown>;
}

export interface BankEntry {
  id: string;
  text: string;
  added: ISODate;
  retired: boolean;
}

export interface Bank {
  goals: Record<GoalCategory, BankEntry[]>;
  hobbies: Record<HobbyCategory, BankEntry[]>;
}

export interface Achievement {
  /** 'hours': total time on one hobby, across every month it was chosen. */
  kind: 'priority' | 'skill' | 'hours';
  bankId: string;
  text: string;
  category: Category;
  months: MonthId[];
  percent: number;
  /** For 'hours': the milestone reached (100, 250, 500 or 1000). */
  hours?: number;
  earned: ISODate;
}

/** The lists under Look back > Challenges. */
export type ChallengeKind = 'rejections' | 'bucket' | 'experiments';
export const CHALLENGE_KINDS: readonly ChallengeKind[] = ['rejections', 'bucket', 'experiments'];

/** open: not concluded yet; failed: rejected (or did not happen); succeeded: accepted (or done). */
export type ChallengeOutcome = 'open' | 'failed' | 'succeeded';

/** One item on a challenge list: logged, then started (active), then concluded either way. */
export interface ChallengeItem {
  id: string;
  title: string;
  /** When it was done or is planned (optional). */
  date: ISODate | null;
  /** Started: an active challenge. */
  started: boolean;
  outcome: ChallengeOutcome;
  notes: string;
  /** The day it was logged, for ordering. */
  added: ISODate;
}

export function challengeCounts(list: ChallengeItem[]): {
  total: number;
  active: number;
  failed: number;
  succeeded: number;
} {
  return {
    total: list.length,
    active: list.filter((r) => r.outcome === 'open' && r.started).length,
    failed: list.filter((r) => r.outcome === 'failed').length,
    succeeded: list.filter((r) => r.outcome === 'succeeded').length,
  };
}

export function emptyChallenges(): Record<ChallengeKind, ChallengeItem[]> {
  return { rejections: [], bucket: [], experiments: [] };
}

/** A daily reminder to write, at a local time ("21:00"). */
export interface Reminder {
  time: string;
  on: boolean;
}

export interface Settings {
  dayStartHour: number;
  noteToReaders: string;
  /** The last backup confirmed as saved off the phone (a text ZIP or the full ZIP). */
  lastBackup: ISODate | null;
  /** The last full ZIP (with photos, audio and video) confirmed as saved off the phone. */
  lastFullBackup: ISODate | null;
  firstUse: ISODate | null;
  /** Up to three daily reminders to write. */
  reminders: Reminder[];
}

export const MAX_REMINDERS = 3;

export const DEFAULT_SETTINGS: Settings = {
  dayStartHour: 4,
  noteToReaders: '',
  lastBackup: null,
  lastFullBackup: null,
  firstUse: null,
  reminders: [],
};

export function emptyGoals(): Record<GoalCategory, boolean> {
  return { health: false, wealth: false, wise: false, versatility: false };
}
export function emptyHobbies(): Record<HobbyCategory, boolean> {
  return { intellectual: false, physical: false, creative: false, social: false };
}
export function emptyChecks(): Record<CheckKey, boolean> {
  return { check_1: false, check_2: false, check_3: false };
}

export function emptyDay(date: ISODate): DayEntry {
  return {
    date,
    title: '',
    feeling: null,
    goals: emptyGoals(),
    hobbies: emptyHobbies(),
    hobbyHours: {},
    prioritiesDone: [],
    writing: '',
    media: [],
    extra: {},
  };
}

export function emptyMonth(month: MonthId): MonthRecord {
  return {
    month,
    setup: null,
    extremeDone: null,
    extremeDoneOn: null,
    outlookDone: [],
    weeks: {},
    extremeIncident: null,
    close: null,
    highlight: '',
    highlightFromWeek: null,
    weekHighlightFrom: {},
    kevinLink: null,
    skipped: {},
    extra: {},
  };
}

export function emptyWeek(): WeekRecord {
  return { checks: emptyChecks(), highlight: '', priorities: [], started: false, closed: false };
}

export function emptyBank(): Bank {
  return {
    goals: { health: [], wealth: [], wise: [], versatility: [] },
    hobbies: { intellectual: [], physical: [], creative: [], social: [] },
  };
}

/**
 * The outlook as separate items: one per line, or separated by commas or semicolons.
 * A leading "and" and a trailing full stop are dropped, so a written sentence still reads as a list.
 */
export function outlookItems(outlook: string): string[] {
  const out: string[] = [];
  for (const raw of outlook.split(/[\n;,]+/)) {
    const t = raw
      .trim()
      .replace(/^(and|&)\s+/i, '')
      .replace(/[.\s]+$/, '')
      .trim();
    if (t && !out.includes(t)) out.push(t.charAt(0).toUpperCase() + t.slice(1));
  }
  return out;
}

/** One tick of a hobby stands for an hour; more can be recorded for the day. */
export const HOUR_PER_TICK = 1;

export function hobbyHours(day: DayEntry | undefined, c: HobbyCategory): number {
  if (!day?.hobbies[c]) return 0;
  return day.hobbyHours[c] ?? HOUR_PER_TICK;
}

/** "1 h", "2.5 h", "120 h". */
export function formatHours(h: number): string {
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}

export function emptyYear(year: string): YearRecord {
  return {
    year,
    defining: null,
    definingFrom: null,
    nextMisogi: null,
    sealedNote: null,
    reviewedOn: null,
    notes: '',
    media: [],
    reviewed: false,
    skipped: null,
    extra: {},
  };
}
