import { daysOf, planDayOn, type LocalDate, type PlanDay, type Recurrence } from './plan';
import { portionNutrients, sum, type Nutrients, type Portion } from './nutrition';

/** A food in a meal plan: either free text, or linked to a known food so its nutrition counts. */
export interface PlannedFood {
  readonly id: string;
  readonly name: string;
  /** Free text such as "1 cup"; empty when unset. Linked foods use [portion] instead. */
  readonly quantity: string;
  readonly portion: Portion | null;
}

export interface Meal {
  readonly id: string;
  readonly name: string;
  /** Free text such as "08:00"; empty when unset. */
  readonly time: string;
  readonly foods: readonly PlannedFood[];
}

/** A meal plan: the same meals every day, or different meals per weekday. */
export interface DietPlan {
  readonly id: string;
  readonly name: string;
  readonly recurrence: Recurrence;
  readonly isActive: boolean;
  /** Meals per plan day, in the user's order. Keys are PlanDay values. */
  readonly meals: Readonly<Record<number, readonly Meal[]>>;
}

/** Counting only foods with nutrition data; null when there are none. */
export const mealNutrients = (meal: Meal): Nutrients | null => {
  const known = meal.foods.flatMap((f) => (f.portion ? [portionNutrients(f.portion)] : []));
  return known.length > 0 ? sum(known) : null;
};

export const mealsOnDay = (plan: DietPlan, day: PlanDay): readonly Meal[] => plan.meals[day] ?? [];

export const mealsOn = (plan: DietPlan, date: LocalDate): readonly Meal[] =>
  mealsOnDay(plan, planDayOn(plan.recurrence, date));

/** The days with at least one meal, in week order. */
export const plannedDays = (plan: DietPlan): PlanDay[] =>
  daysOf(plan.recurrence).filter((d) => mealsOnDay(plan, d).length > 0);

/** The day's planned nutrition, counting only foods with nutrition data; null when there are none. */
export const nutrientsOnDay = (plan: DietPlan, day: PlanDay): Nutrients | null => {
  const known = mealsOnDay(plan, day).flatMap((m) => {
    const n = mealNutrients(m);
    return n ? [n] : [];
  });
  return known.length > 0 ? sum(known) : null;
};
