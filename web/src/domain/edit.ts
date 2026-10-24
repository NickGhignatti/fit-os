import type { DietPlan, Meal, PlannedFood } from './diet';
import { newId } from './id';
import type { Portion } from './nutrition';
import type { LocalDate, PlanDay, Recurrence } from './plan';
import type { PlannedExercise, PlannedSet, TrainingPlan } from './trainingPlan';
import type { Exercise, ExercisePlan, ExerciseSet, SetPlan, Workout } from './workout';

/**
 * Edits are pure functions: they take an aggregate and return the changed one, never mutating.
 * A use case loads the aggregate, applies edits, and saves it. New items get fresh ids.
 */

// ---- Workouts ---------------------------------------------------------------

const setFromPlan = (s: SetPlan): ExerciseSet => ({
  id: newId(),
  plannedReps: s.reps,
  plannedWeight: s.weight,
  actualReps: null,
  actualWeight: null,
  done: false,
});

const exerciseFromPlan = (p: ExercisePlan): Exercise => ({
  id: newId(),
  name: p.name,
  notes: p.notes,
  catalogId: p.catalogId,
  restSeconds: p.restSeconds ?? null,
  sets: p.sets.map(setFromPlan),
});

/** A workout on [date], optionally pre-filled with [exercises] from the plan [planId]. */
export const newWorkout = (
  date: LocalDate,
  title: string,
  exercises: readonly ExercisePlan[] = [],
  planId: string | null = null,
): Workout => ({ id: newId(), date, title, planId, exercises: exercises.map(exerciseFromPlan), startedAt: null, finishedAt: null });

export const renameWorkout = (w: Workout, title: string): Workout => ({ ...w, title });

/** Appends an exercise at the end of the workout. */
export const addExercise = (w: Workout, exercise: ExercisePlan): Workout => ({
  ...w,
  exercises: [...w.exercises, exerciseFromPlan(exercise)],
});

const mapExercise = (w: Workout, id: string, f: (e: Exercise) => Exercise): Workout => ({
  ...w,
  exercises: w.exercises.map((e) => (e.id === id ? f(e) : e)),
});

/** What the exercise dialog edits, in a workout and in a plan alike. */
export interface ExerciseDetails {
  readonly name: string;
  readonly notes: string;
  readonly restSeconds: number | null;
}

export const updateExercise = (w: Workout, id: string, details: ExerciseDetails): Workout =>
  mapExercise(w, id, (e) => ({ ...e, ...details }));

export const deleteExercise = (w: Workout, id: string): Workout => ({
  ...w,
  exercises: w.exercises.filter((e) => e.id !== id),
});

/** Appends a set at the end of the exercise. */
export const addSet = (w: Workout, exerciseId: string, set: SetPlan): Workout =>
  mapExercise(w, exerciseId, (e) => ({ ...e, sets: [...e.sets, setFromPlan(set)] }));

/** Replaces the set that has the same id, wherever it is. */
export const updateSet = (w: Workout, set: ExerciseSet): Workout => ({
  ...w,
  exercises: w.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => (s.id === set.id ? set : s)) })),
});

export const deleteSet = (w: Workout, setId: string): Workout => ({
  ...w,
  exercises: w.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.id !== setId) })),
});

// ---- Training plans ---------------------------------------------------------

const plannedSetFrom = (s: SetPlan): PlannedSet => ({ id: newId(), reps: s.reps, weight: s.weight });

const plannedExerciseFrom = (p: ExercisePlan): PlannedExercise => ({
  id: newId(),
  name: p.name,
  notes: p.notes,
  catalogId: p.catalogId,
  restSeconds: p.restSeconds ?? null,
  sets: p.sets.map(plannedSetFrom),
});

/** An inactive plan pre-filled with [sessions]. */
export const newTrainingPlan = (
  name: string,
  recurrence: Recurrence,
  sessions: Readonly<Record<number, readonly ExercisePlan[]>> = {},
): TrainingPlan => ({
  id: newId(),
  name,
  recurrence,
  isActive: false,
  sessions: Object.fromEntries(Object.entries(sessions).map(([day, list]) => [day, list.map(plannedExerciseFrom)])),
});

export const renamePlan = <P extends { readonly name: string }>(plan: P, name: string): P => ({ ...plan, name });

const mapSessions = (plan: TrainingPlan, f: (exercises: readonly PlannedExercise[]) => readonly PlannedExercise[]): TrainingPlan => ({
  ...plan,
  sessions: Object.fromEntries(Object.entries(plan.sessions).map(([day, list]) => [day, f(list)])),
});

/** Appends an exercise at the end of [day]'s session. */
export const addPlannedExercise = (plan: TrainingPlan, day: PlanDay, exercise: ExercisePlan): TrainingPlan => ({
  ...plan,
  sessions: { ...plan.sessions, [day]: [...(plan.sessions[day] ?? []), plannedExerciseFrom(exercise)] },
});

export const updatePlannedExercise = (plan: TrainingPlan, id: string, details: ExerciseDetails): TrainingPlan =>
  mapSessions(plan, (list) => list.map((e) => (e.id === id ? { ...e, ...details } : e)));

export const deletePlannedExercise = (plan: TrainingPlan, id: string): TrainingPlan =>
  mapSessions(plan, (list) => list.filter((e) => e.id !== id));

export const addPlannedSet = (plan: TrainingPlan, exerciseId: string, set: SetPlan): TrainingPlan =>
  mapSessions(plan, (list) =>
    list.map((e) => (e.id === exerciseId ? { ...e, sets: [...e.sets, plannedSetFrom(set)] } : e)),
  );

export const updatePlannedSet = (plan: TrainingPlan, setId: string, set: SetPlan): TrainingPlan =>
  mapSessions(plan, (list) =>
    list.map((e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, reps: set.reps, weight: set.weight } : s)) })),
  );

export const deletePlannedSet = (plan: TrainingPlan, setId: string): TrainingPlan =>
  mapSessions(plan, (list) => list.map((e) => ({ ...e, sets: e.sets.filter((s) => s.id !== setId) })));

// ---- Diet plans -------------------------------------------------------------

/** An empty, inactive diet plan. */
export const newDietPlan = (name: string, recurrence: Recurrence): DietPlan => ({
  id: newId(),
  name,
  recurrence,
  isActive: false,
  meals: {},
});

const mapMeals = (plan: DietPlan, f: (meals: readonly Meal[]) => readonly Meal[]): DietPlan => ({
  ...plan,
  meals: Object.fromEntries(Object.entries(plan.meals).map(([day, list]) => [day, f(list)])),
});

const mapMeal = (plan: DietPlan, mealId: string, f: (m: Meal) => Meal): DietPlan =>
  mapMeals(plan, (list) => list.map((m) => (m.id === mealId ? f(m) : m)));

/** Appends a meal at the end of [day]; returns the new plan and the new meal. */
export const addMeal = (plan: DietPlan, day: PlanDay, name: string, time: string): { plan: DietPlan; meal: Meal } => {
  const meal: Meal = { id: newId(), name, time, foods: [] };
  return { plan: { ...plan, meals: { ...plan.meals, [day]: [...(plan.meals[day] ?? []), meal] } }, meal };
};

export const updateMeal = (plan: DietPlan, id: string, name: string, time: string): DietPlan =>
  mapMeal(plan, id, (m) => ({ ...m, name, time }));

export const deleteMeal = (plan: DietPlan, id: string): DietPlan => mapMeals(plan, (list) => list.filter((m) => m.id !== id));

/** Appends a food at the end of the meal; with a [portion], its nutrition counts. */
export const addFood = (plan: DietPlan, mealId: string, name: string, quantity: string, portion: Portion | null = null): DietPlan =>
  mapMeal(plan, mealId, (m) => ({ ...m, foods: [...m.foods, { id: newId(), name, quantity, portion }] }));

export const updateFood = (plan: DietPlan, foodId: string, name: string, quantity: string, portion: Portion | null = null): DietPlan =>
  mapMeals(plan, (list) =>
    list.map((m) => ({ ...m, foods: m.foods.map((f) => (f.id === foodId ? { ...f, name, quantity, portion } : f)) })),
  );

export const deleteFood = (plan: DietPlan, foodId: string): DietPlan =>
  mapMeals(plan, (list) => list.map((m) => ({ ...m, foods: m.foods.filter((f) => f.id !== foodId) })));

const copyFood = (f: PlannedFood): PlannedFood => ({ ...f, id: newId() });

/** Replaces everything planned on [day] with copies of [meals] (their ids are ignored). */
export const replaceMeals = (plan: DietPlan, day: PlanDay, meals: readonly Meal[]): DietPlan => ({
  ...plan,
  meals: { ...plan.meals, [day]: meals.map((m) => ({ ...m, id: newId(), foods: m.foods.map(copyFood) })) },
});
