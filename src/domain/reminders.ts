import { logicalDate } from './dates';
import { MAX_REMINDERS, type DayEntry, type ISODate, type Settings } from './types';

/**
 * Which reminders to schedule. iOS keeps at most 64 pending notifications, and a repeating one
 * cannot start later than today (it would ring on written days too), so only dated ones are used:
 * as many days ahead as fit in 63 (63 days for one reminder time, 21 for three). The schedule is
 * rebuilt at launch, on return to the app and after every save, so it moves forward with use.
 */
export const MAX_PENDING = 63;
export const MIN_DAYS_AHEAD = 21;

export interface PlannedReminder {
  at: Date;
  /** The journal day the reminder is about (the day containing that moment). */
  day: ISODate;
  time: string;
}

export function enabledTimes(settings: Settings): string[] {
  return [...new Set(settings.reminders.filter((r) => r.on).map((r) => r.time))].sort().slice(0, MAX_REMINDERS);
}

/** A day counts as written once it has a title or any writing. */
export function isWritten(day: DayEntry | undefined): boolean {
  return !!day && (day.title.trim().length > 0 || day.writing.trim().length > 0);
}

export function reminderSchedule(
  settings: Settings,
  days: Record<ISODate, DayEntry | undefined>,
  now: Date,
): PlannedReminder[] {
  const times = enabledTimes(settings);
  if (!times.length) return [];
  const ahead = Math.max(MIN_DAYS_AHEAD, Math.floor(MAX_PENDING / times.length));
  const out: PlannedReminder[] = [];
  for (let i = 0; i <= ahead && out.length < MAX_PENDING; i++) {
    for (const time of times) {
      const [h, m] = time.split(':').map(Number);
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h, m, 0, 0);
      if (at.getTime() <= now.getTime()) continue;
      // A 01:00 reminder belongs to the evening before when the day starts at 04:00.
      const day = logicalDate(at, settings.dayStartHour);
      if (isWritten(days[day])) continue;
      out.push({ at, day, time });
      if (out.length === MAX_PENDING) break;
    }
  }
  return out;
}

export const REMINDER_TITLE = 'Life-Tracker';
export const REMINDER_BODY = 'How was today? A few lines are enough.';
