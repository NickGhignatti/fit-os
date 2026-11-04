/** A calendar day as ISO text, "2026-10-17". Timezone-free, like java.time.LocalDate. */
export type LocalDate = string;

/** 1 = Monday … 7 = Sunday (ISO), as java.time.DayOfWeek. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** 0 = the only part of a daily plan, otherwise the weekday. Same encoding as the database keys. */
export type PlanDay = 0 | Weekday;

export const EVERY_DAY: PlanDay = 0;

export type Recurrence = 'daily' | 'weekly';

/** Weekday names, Monday first: index [day - 1] for a [Weekday]. */
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

const MS_PER_DAY = 86_400_000;

const toUtc = (date: LocalDate): number => Date.parse(`${date}T00:00:00Z`);

export const addDays = (date: LocalDate, days: number): LocalDate =>
  new Date(toUtc(date) + days * MS_PER_DAY).toISOString().slice(0, 10);

export const weekdayOf = (date: LocalDate): Weekday => {
  const sundayFirst = new Date(toUtc(date)).getUTCDay();
  return (sundayFirst === 0 ? 7 : sundayFirst) as Weekday;
};

export const mondayOnOrBefore = (date: LocalDate): LocalDate => addDays(date, -(weekdayOf(date) - 1));

const WEEK: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

/** The days a plan with this recurrence is made of, Monday first. */
export const daysOf = (recurrence: Recurrence): readonly PlanDay[] =>
  recurrence === 'daily' ? [EVERY_DAY] : WEEK;

/** The part of a plan that applies on [date]. */
export const planDayOn = (recurrence: Recurrence, date: LocalDate): PlanDay =>
  recurrence === 'daily' ? EVERY_DAY : weekdayOf(date);
