import { mealNutrients, mealsOn, type DietPlan, type Meal } from './diet';
import { addPlannedSet, addSet, markExerciseDone, newTrainingPlan, newWorkout, replaceMeals, updateSet } from './edit';
import { eaten, emptyDay, type FoodLogDay, type FoodLogEntry } from './foodLog';
import { newId } from './id';
import { sum, type Nutrients } from './nutrition';
import { targetsForProfile } from './nutritionTargets';
import { addDays, mondayOnOrBefore, type LocalDate, type PlanDay } from './plan';
import { ageOn, type DailyTargets } from './profile';
import type {
  DietPlanRepository,
  FoodLogRepository,
  ProfileRepository,
  Stream,
  TrainingPlanRepository,
  TransactionRunner,
  WorkoutRepository,
} from './repositories';
import { combine } from './stream';
import { pendingSessionOn, sessionOn, type PendingSession, type TrainingPlan } from './trainingPlan';
import { doneSetsOf, markedDone, setFollowing, toggledDone, totalSetsOf, started, stopped, stopwatchOf, withClock, workoutToPlan, ZERO, type ExerciseSet, type SetPlan, type Workout } from './workout';

// ---- Observing --------------------------------------------------------------

/**
 * A day's agenda: its workouts, the session of every active training plan that has not been started,
 * and the active diet plan's meals. Plans are never copied ahead of time, so switching plan takes
 * effect immediately.
 */
export interface DayAgenda {
  readonly date: LocalDate;
  readonly workouts: readonly Workout[];
  /** One per active plan that has a session today and has not started it. */
  readonly pendingSessions: readonly PendingSession[];
  readonly meals: readonly Meal[];
  readonly hasTrainingPlan: boolean;
  readonly hasDietPlan: boolean;
}

export const observeDayAgenda = (
  repos: { workouts: WorkoutRepository; trainingPlans: TrainingPlanRepository; dietPlans: DietPlanRepository },
  date: LocalDate,
): Stream<DayAgenda> =>
  combine(
    [repos.workouts.observeWorkouts(date), repos.trainingPlans.observeActivePlans(), repos.dietPlans.observeActivePlan()],
    (workouts, trainingPlans, dietPlan): DayAgenda => ({
      date,
      workouts,
      pendingSessions: trainingPlans.flatMap((plan) => pendingSessionOn(plan, date, workouts) ?? []),
      meals: dietPlan ? mealsOn(dietPlan, date) : [],
      hasTrainingPlan: trainingPlans.length > 0,
      hasDietPlan: dietPlan !== undefined,
    }),
  );

/** One meal of a day: what the diet plans for it, if anything, and what was logged under its name. */
export interface MealLog {
  readonly name: string;
  readonly planned: Meal | null;
  readonly entries: readonly FoodLogEntry[];
  readonly eaten: Nutrients;
  /** The planned foods can be logged in one go while nothing has been logged for this meal yet. */
  readonly canLogAsPlanned: boolean;
}

/** A day of eating, meal by meal, next to what the active diet plans. */
export interface CalorieDay {
  readonly date: LocalDate;
  readonly meals: readonly MealLog[];
  readonly hasDietPlan: boolean;
  readonly eaten: Nutrients;
  /** What the diet plans for the day, counting only foods with nutrition data; null when there are none. */
  readonly planned: Nutrients | null;
}

const plannedNutrients = (meals: readonly MealLog[]): Nutrients | null => {
  const known = meals.flatMap((m) => {
    const n = m.planned ? mealNutrients(m.planned) : null;
    return n ? [n] : [];
  });
  return known.length > 0 ? sum(known) : null;
};

/**
 * A day of eating. Meals follow the active diet's plan for that day, or [defaultMeals] without
 * one; anything logged under another name follows, in the order it was first logged.
 */
export const observeCalorieDay = (
  repos: { foodLog: FoodLogRepository; dietPlans: DietPlanRepository },
  date: LocalDate,
  defaultMeals: readonly string[],
): Stream<CalorieDay> =>
  combine([repos.foodLog.observeDay(date), repos.dietPlans.observeActivePlan()], (day, plan): CalorieDay => {
    const plannedMeals = plan ? mealsOn(plan, date) : [];
    const byName = new Map<string, FoodLogEntry[]>();
    for (const entry of day.entries) byName.set(entry.meal, [...(byName.get(entry.meal) ?? []), entry]);
    const seen = new Set<string>();
    const sections: { name: string; planned: Meal | null }[] =
      plannedMeals.length > 0
        ? plannedMeals.filter((m) => !seen.has(m.name) && seen.add(m.name)).map((m) => ({ name: m.name, planned: m }))
        : defaultMeals.map((name) => ({ name, planned: null }));
    const known = new Set(sections.map((s) => s.name));
    for (const name of byName.keys()) if (!known.has(name)) sections.push({ name, planned: null });

    const meals = sections.map(({ name, planned }): MealLog => {
      const entries = byName.get(name) ?? [];
      return {
        name,
        planned,
        entries,
        eaten: eaten(entries),
        canLogAsPlanned: entries.length === 0 && (planned?.foods.some((f) => f.portion !== null) ?? false),
      };
    });
    return { date, meals, hasDietPlan: plan !== undefined, eaten: eaten(day.entries), planned: plannedNutrients(meals) };
  });

/** Sets done, and sets in all. */
export interface SetCount {
  readonly done: number;
  readonly total: number;
}

/** One training day of the current week, how far its workout got, and whether it is fully done. */
export interface TrainingWeekDay {
  readonly date: LocalDate;
  /** Before the session is started every planned set counts, none of them done. */
  readonly sets: SetCount;
  readonly isCompleted: boolean;
  readonly isToday: boolean;
}

/** How one active plan is going this week (Monday to Sunday). */
export interface TrainingWeek {
  readonly plan: TrainingPlan;
  /** The days of the week the plan has a session on. */
  readonly days: readonly TrainingWeekDay[];
  /** Today has a session in the plan that has not been started yet. */
  readonly hasPendingSessionToday: boolean;
  readonly completedCount: number;
  /** Today's sets in this plan; null when the plan has no session today. */
  readonly todaySets: SetCount | null;
}

/**
 * One entry per active plan, sorted by name; empty while none is active. A day is completed for a
 * plan when the workouts started from that plan on that day are all done, so plans do not
 * count each other's work.
 */
export const observeTrainingWeeks = (
  repos: { workouts: WorkoutRepository; trainingPlans: TrainingPlanRepository },
  today: LocalDate,
): Stream<TrainingWeek[]> => {
  const monday = mondayOnOrBefore(today);
  return combine(
    [repos.trainingPlans.observeActivePlans(), repos.workouts.observeWorkoutsBetween(monday, addDays(monday, 6))],
    (plans, week) =>
      plans.map((plan): TrainingWeek => {
        const own = week.filter((w) => w.planId === plan.id);
        const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).flatMap((date): TrainingWeekDay[] => {
          const session = sessionOn(plan, date);
          if (session.length === 0) return [];
          const started = own.filter((w) => w.date === date);
          const sets = started.length === 0
            ? { done: 0, total: session.reduce((n, e) => n + e.sets.length, 0) }
            : { done: started.reduce((n, w) => n + doneSetsOf(w), 0), total: started.reduce((n, w) => n + totalSetsOf(w), 0) };
          return [{ date, sets, isCompleted: started.length > 0 && sets.total > 0 && sets.done === sets.total, isToday: date === today }];
        });
        return {
          plan,
          days,
          hasPendingSessionToday: pendingSessionOn(plan, today, week.filter((w) => w.date === today)) !== null,
          completedCount: days.filter((d) => d.isCompleted).length,
          todaySets: days.find((d) => d.isToday)?.sets ?? null,
        };
      }),
  );
};

/** The daily targets on [today], from the profile and the latest weigh-in; null until enough is known. */
export const observeDailyTargets = (repo: ProfileRepository, today: LocalDate): Stream<DailyTargets | null> =>
  combine([repo.observeProfile(), repo.observeWeights()], (profile, weights) =>
    targetsForProfile(profile, weights.at(-1)?.kg ?? null, ageOn(profile, today)),
  );

// ---- Acting -----------------------------------------------------------------

type WorkoutDeps = { workouts: WorkoutRepository; transaction: TransactionRunner };

/** Loads a workout, applies [change] and saves it; false if the workout no longer exists. */
const editWorkout = (deps: WorkoutDeps, workoutId: string, change: (w: Workout) => Workout): Promise<boolean> =>
  deps.transaction.run(async () => {
    const workout = await deps.workouts.getWorkout(workoutId);
    if (!workout) return false;
    await deps.workouts.save(change(workout));
    return true;
  });

/** Marks a set done (pre-filling actuals from the plan) or not done. */
export const toggleSetDone = (deps: WorkoutDeps, workoutId: string, set: ExerciseSet, now = Date.now()): Promise<boolean> =>
  editWorkout(deps, workoutId, (w) => withClock(updateSet(w, toggledDone(set)), now));

/** Ticks every set of an exercise still to do, keeping the stopwatch in step. */
export const completeExercise = (deps: WorkoutDeps, workoutId: string, exerciseId: string, now = Date.now()): Promise<boolean> =>
  editWorkout(deps, workoutId, (w) => withClock(markExerciseDone(w, exerciseId), now));

/** Starts, stops or zeroes a workout's stopwatch. */
export const setStopwatch = (deps: WorkoutDeps, workoutId: string, action: 'start' | 'stop' | 'reset', now = Date.now()): Promise<boolean> =>
  editWorkout(deps, workoutId, (w) => {
    const clock = stopwatchOf(w);
    return { ...w, ...(action === 'start' ? started(clock, now) : action === 'stop' ? stopped(clock, now) : ZERO) };
  });

/** Saves an edited set; a completed set gets the planned value for any actual left blank. */
export const logSet = (deps: WorkoutDeps, workoutId: string, set: ExerciseSet, now = Date.now()): Promise<boolean> =>
  editWorkout(deps, workoutId, (w) => withClock(updateSet(w, set.done ? markedDone(set) : set), now));

const lastOf = (sets: readonly { reps: number; weight: number | null }[]): SetPlan | null => {
  const last = sets.at(-1);
  return last ? { reps: last.reps, weight: last.weight } : null;
};

/** Appends a set that repeats the last one: the usual "one more set" case. */
export const addSetLikeLast = (deps: WorkoutDeps, workoutId: string, exerciseId: string): Promise<boolean> =>
  editWorkout(deps, workoutId, (w) => {
    const sets = w.exercises.find((e) => e.id === exerciseId)?.sets ?? [];
    return addSet(w, exerciseId, setFollowing(lastOf(sets.map((s) => ({ reps: s.plannedReps, weight: s.plannedWeight })))));
  });

/** Appends a set to a plan's exercise that repeats the last one. */
export const addPlannedSetLikeLast = (
  deps: { trainingPlans: TrainingPlanRepository; transaction: TransactionRunner },
  planId: string,
  exerciseId: string,
): Promise<boolean> =>
  deps.transaction.run(async () => {
    const plan = await deps.trainingPlans.getPlan(planId);
    if (!plan) return false;
    const exercise = Object.values(plan.sessions).flat().find((e) => e.id === exerciseId);
    await deps.trainingPlans.save(addPlannedSet(plan, exerciseId, setFollowing(lastOf(exercise?.sets ?? []))));
    return true;
  });

/**
 * Returns the id of the day's workout from plan [planId], creating it if needed (so a double tap
 * never starts it twice), or null when the plan is gone or has nothing planned that day.
 */
export const startPlannedSession = (
  deps: WorkoutDeps & { trainingPlans: TrainingPlanRepository },
  date: LocalDate,
  planId: string,
  now = Date.now(),
): Promise<string | null> =>
  deps.transaction.run(async () => {
    const plan = await deps.trainingPlans.getPlan(planId);
    if (!plan) return null;
    const dayWorkouts = await deps.workouts.getWorkouts(date);
    const existing = dayWorkouts.find((w) => w.planId === plan.id);
    if (existing) return existing.id;
    const session = pendingSessionOn(plan, date, dayWorkouts);
    if (!session) return null;
    const workout = { ...newWorkout(date, session.title, session.exercises, plan.id), runningSince: now };
    await deps.workouts.save(workout);
    return workout.id;
  });

/** Copies a workout's plan (not its logged results) to another day; null if the source is gone. */
export const copyWorkoutTo = (deps: WorkoutDeps, workoutId: string, date: LocalDate): Promise<string | null> =>
  deps.transaction.run(async () => {
    const source = await deps.workouts.getWorkout(workoutId);
    if (!source) return null;
    const copy = newWorkout(date, source.title, workoutToPlan(source));
    await deps.workouts.save(copy);
    return copy.id;
  });

/** Saves a workout's plan (not its logged results) as a new daily training plan; null if it is gone. */
export const saveWorkoutAsPlan = (
  deps: WorkoutDeps & { trainingPlans: TrainingPlanRepository },
  workoutId: string,
  name: string,
): Promise<string | null> =>
  deps.transaction.run(async () => {
    const workout = await deps.workouts.getWorkout(workoutId);
    if (!workout) return null;
    const plan = newTrainingPlan(name, 'daily', { 0: workoutToPlan(workout) });
    await deps.trainingPlans.save(plan);
    return plan.id;
  });

/** Within a diet plan, replaces the meals of [targets] with a copy of [source]'s. */
export const copyDietDay = (
  deps: { dietPlans: DietPlanRepository; transaction: TransactionRunner },
  planId: string,
  source: PlanDay,
  targets: ReadonlySet<PlanDay>,
): Promise<void> =>
  deps.transaction.run(async () => {
    const plan = await deps.dietPlans.getPlan(planId);
    if (!plan) return;
    const meals = plan.meals[source] ?? [];
    let result: DietPlan = plan;
    for (const target of targets) if (target !== source) result = replaceMeals(result, target, meals);
    await deps.dietPlans.save(result);
  });

/** Logs every food of a planned meal that has nutrition data, under the meal's name; returns how many. */
export const logPlannedMeal = (
  deps: { foodLog: FoodLogRepository; transaction: TransactionRunner },
  date: LocalDate,
  meal: Meal,
): Promise<number> =>
  deps.transaction.run(async () => {
    const portions = meal.foods.flatMap((f) => (f.portion ? [f.portion] : []));
    if (portions.length === 0) return 0;
    const day: FoodLogDay = await deps.foodLog.getDay(date);
    await deps.foodLog.saveDay({
      ...(day.entries.length === 0 ? emptyDay(date) : day),
      entries: [...day.entries, ...portions.map((portion) => ({ id: newId(), meal: meal.name, portion }))],
    });
    return portions.length;
  });
