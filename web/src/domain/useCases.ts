import { mealNutrients, mealsOn, type DietPlan, type Meal } from './diet';
import { addPlannedSet, addSet, newTrainingPlan, newWorkout, replaceMeals, updateSet } from './edit';
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
import { markedDone, setFollowing, toggledDone, workoutToPlan, type ExerciseSet, type SetPlan, type Workout } from './workout';

// ---- Observing --------------------------------------------------------------

/**
 * A day's agenda: its workouts, the active training plan's session while it has not been started,
 * and the active diet plan's meals. Plans are never copied ahead of time, so switching plan takes
 * effect immediately.
 */
export interface DayAgenda {
  readonly date: LocalDate;
  readonly workouts: readonly Workout[];
  readonly pendingSession: PendingSession | null;
  readonly meals: readonly Meal[];
  readonly hasTrainingPlan: boolean;
  readonly hasDietPlan: boolean;
}

export const observeDayAgenda = (
  repos: { workouts: WorkoutRepository; trainingPlans: TrainingPlanRepository; dietPlans: DietPlanRepository },
  date: LocalDate,
): Stream<DayAgenda> =>
  combine(
    [repos.workouts.observeWorkouts(date), repos.trainingPlans.observeActivePlan(), repos.dietPlans.observeActivePlan()],
    (workouts, trainingPlan, dietPlan): DayAgenda => ({
      date,
      workouts,
      pendingSession: trainingPlan ? pendingSessionOn(trainingPlan, date, workouts) : null,
      meals: dietPlan ? mealsOn(dietPlan, date) : [],
      hasTrainingPlan: trainingPlan !== undefined,
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

/** One training day of the current week and whether its workout is fully done. */
export interface TrainingWeekDay {
  readonly date: LocalDate;
  readonly isCompleted: boolean;
  readonly isToday: boolean;
}

/** How the active plan is going this week (Monday to Sunday). */
export interface TrainingWeek {
  readonly plan: TrainingPlan;
  /** The days of the week the plan has a session on. */
  readonly days: readonly TrainingWeekDay[];
  /** Today has a session in the plan that has not been started yet. */
  readonly hasPendingSessionToday: boolean;
  readonly completedCount: number;
}

/** Emits undefined while there is no active plan. */
export const observeTrainingWeek = (
  repos: { workouts: WorkoutRepository; trainingPlans: TrainingPlanRepository },
  today: LocalDate,
): Stream<TrainingWeek | undefined> => {
  const monday = mondayOnOrBefore(today);
  return combine(
    [repos.trainingPlans.observeActivePlan(), repos.workouts.observeDaySummaries(monday, addDays(monday, 6)), repos.workouts.observeWorkouts(today)],
    (plan, summaries, todays) => {
      if (!plan) return undefined;
      const completed = new Set(summaries.filter((s) => s.totalSets > 0 && s.doneSets === s.totalSets).map((s) => s.date));
      const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
        .filter((d) => sessionOn(plan, d).length > 0)
        .map((date): TrainingWeekDay => ({ date, isCompleted: completed.has(date), isToday: date === today }));
      return {
        plan,
        days,
        hasPendingSessionToday: pendingSessionOn(plan, today, todays) !== null,
        completedCount: days.filter((d) => d.isCompleted).length,
      };
    },
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
export const toggleSetDone = (deps: WorkoutDeps, workoutId: string, set: ExerciseSet): Promise<boolean> =>
  editWorkout(deps, workoutId, (w) => updateSet(w, toggledDone(set)));

/** Saves an edited set; a completed set gets the planned value for any actual left blank. */
export const logSet = (deps: WorkoutDeps, workoutId: string, set: ExerciseSet): Promise<boolean> =>
  editWorkout(deps, workoutId, (w) => updateSet(w, set.done ? markedDone(set) : set));

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
 * Returns the id of the day's workout from the active plan, creating it if needed (so a double
 * tap never starts it twice), or null when there is no active plan or nothing planned that day.
 */
export const startPlannedSession = (
  deps: WorkoutDeps & { trainingPlans: TrainingPlanRepository },
  date: LocalDate,
): Promise<string | null> =>
  deps.transaction.run(async () => {
    const plan = await deps.trainingPlans.getActivePlan();
    if (!plan) return null;
    const dayWorkouts = await deps.workouts.getWorkouts(date);
    const existing = dayWorkouts.find((w) => w.planId === plan.id);
    if (existing) return existing.id;
    const session = pendingSessionOn(plan, date, dayWorkouts);
    if (!session) return null;
    const workout = newWorkout(date, session.title, session.exercises, plan.id);
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
