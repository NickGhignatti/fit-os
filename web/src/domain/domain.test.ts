import { describe, expect, it } from 'vitest';
import { mealNutrients, nutrientsOnDay, plannedDays, type DietPlan, type Meal } from './diet';
import { parseFoodId, portionNutrients, portionOf, type FoodItem } from './nutrition';
import { restingKcal, targetsForProfile } from './nutritionTargets';
import { addDays, mondayOnOrBefore, planDayOn, weekdayOf } from './plan';
import { ageOn, defaultProfile } from './profile';
import { rank } from './textSearch';
import { nextSessionFrom, pendingSessionOn, trainingDays, type TrainingPlan } from './trainingPlan';
import {
  actualSecondsOf,
  deviatesFromPlan,
  exerciseToPlan,
  isCompleted,
  markedDone,
  plannedSecondsOf,
  setFollowing,
  setPlan,
  summarize,
  elapsedOn,
  started,
  stopped,
  stopwatchOf,
  toggledDone,
  withClock,
  ZERO,
  type ExerciseSet,
  type Workout,
} from './workout';

const set = (over: Partial<ExerciseSet> = {}): ExerciseSet => ({
  id: 's',
  plannedReps: 10,
  plannedWeight: 50,
  actualReps: null,
  actualWeight: null,
  done: false,
  note: '',
  ...over,
});

describe('dates', () => {
  it('uses ISO weekdays, Monday first', () => {
    expect(weekdayOf('2026-10-12')).toBe(1); // Monday
    expect(weekdayOf('2026-10-18')).toBe(7); // Sunday
  });

  it('finds the Monday of a week and crosses month boundaries', () => {
    expect(mondayOnOrBefore('2026-10-18')).toBe('2026-10-12');
    expect(mondayOnOrBefore('2026-10-12')).toBe('2026-10-12');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });

  it('maps dates onto plan days', () => {
    expect(planDayOn('daily', '2026-10-14')).toBe(0);
    expect(planDayOn('weekly', '2026-10-14')).toBe(3);
  });
});

describe('sets', () => {
  it('fills blanks from the plan when marked done', () => {
    expect(markedDone(set())).toMatchObject({ done: true, actualReps: 10, actualWeight: 50 });
  });

  it('keeps logged values when toggled off and on again', () => {
    const logged = markedDone(set({ actualReps: 8, actualWeight: 55 }));
    const off = toggledDone(logged);
    expect(off).toMatchObject({ done: false, actualReps: 8, actualWeight: 55 });
    expect(toggledDone(off)).toEqual(logged);
  });

  it('flags only completed sets that differ from the plan', () => {
    expect(deviatesFromPlan(set({ actualReps: 8 }))).toBe(false); // not done
    expect(deviatesFromPlan(markedDone(set()))).toBe(false);
    expect(deviatesFromPlan(markedDone(set({ actualReps: 8 })))).toBe(true);
    expect(deviatesFromPlan(markedDone(set({ actualWeight: 60 })))).toBe(true);
  });

  it('validates plans and repeats the last set', () => {
    expect(() => setPlan(0, null)).toThrow();
    expect(() => setPlan(5, -1)).toThrow();
    expect(() => setPlan(1, null, 0)).toThrow();
    expect(setFollowing(setPlan(5, 20))).toEqual({ reps: 5, weight: 20, seconds: null });
    expect(setFollowing(setPlan(1, null, 45))).toEqual({ reps: 1, weight: null, seconds: 45 });
    expect(setFollowing(null)).toEqual({ reps: 10, weight: null, seconds: null });
  });
});

describe('timed sets', () => {
  const hold = (over: Partial<ExerciseSet> = {}) => set({ plannedReps: 1, plannedWeight: null, plannedSeconds: 45, actualSeconds: null, ...over });

  it('fill the planned seconds in when marked done, and keep logged ones', () => {
    expect(markedDone(hold())).toMatchObject({ done: true, actualReps: 1, actualSeconds: 45 });
    expect(markedDone(hold({ actualSeconds: 50 }))).toMatchObject({ actualSeconds: 50 });
  });

  it('count a different time as a deviation from the plan', () => {
    expect(deviatesFromPlan(markedDone(hold()))).toBe(false);
    expect(deviatesFromPlan(markedDone(hold({ actualSeconds: 30 })))).toBe(true);
  });

  it('read sets stored before timed sets existed as untimed', () => {
    const legacy = set(); // no seconds keys at all, as in older saved workouts
    expect(plannedSecondsOf(legacy)).toBeNull();
    expect(actualSecondsOf(legacy)).toBeNull();
    expect(markedDone(legacy).actualSeconds).toBeNull();
    expect(deviatesFromPlan(markedDone(legacy))).toBe(false);
  });

  it('carry their seconds into a plan made from the workout', () => {
    const exercise = { id: 'e', name: 'Plank', notes: '', catalogId: null, restSeconds: null, restAfterSeconds: null, sets: [hold()] };
    expect(exerciseToPlan(exercise).sets).toEqual([{ reps: 1, weight: null, seconds: 45 }]);
  });
});

const workout = (planId: string | null, sets: ExerciseSet[]): Workout => ({
  id: 'w',
  date: '2026-10-14',
  title: 'Push',
  planId,
  elapsedMs: 0,
  runningSince: null,
  exercises: [{ id: 'e', name: 'Bench', notes: '', catalogId: null, restSeconds: null, restAfterSeconds: null, sets }],
});

describe('the session stopwatch', () => {
  it('stops and goes on, adding up its runs', () => {
    const run = started(ZERO, 1_000);
    expect(elapsedOn(run, 4_000)).toBe(3_000);
    const paused = stopped(run, 4_000);
    expect(elapsedOn(paused, 60_000)).toBe(3_000); // no time passes while stopped
    expect(elapsedOn(started(paused, 10_000), 12_000)).toBe(5_000);
    expect(stopwatchOf({})).toEqual(ZERO); // saved before the stopwatch existed
  });

  it('starts with the first set when nobody pressed start, and stops with the last', () => {
    expect(withClock(workout(null, [set(), set()]), 1_000)).toMatchObject(ZERO);
    const half = withClock(workout(null, [markedDone(set()), set()]), 1_000);
    expect(half).toMatchObject({ elapsedMs: 0, runningSince: 1_000 });
    const all = withClock({ ...half, exercises: workout(null, [markedDone(set()), markedDone(set())]).exercises }, 61_000);
    expect(all).toMatchObject({ elapsedMs: 60_000, runningSince: null });
    expect(withClock({ ...all, exercises: half.exercises }, 70_000)).toMatchObject({ elapsedMs: 60_000, runningSince: null }); // a stopped watch stays put
  });
});

describe('day summaries', () => {
  it('completes only when every set is done', () => {
    const w = workout(null, [markedDone(set()), set()]);
    expect(summarize('2026-10-14', [w])).toEqual({ date: '2026-10-14', totalSets: 2, doneSets: 1 });
    expect(isCompleted(summarize('2026-10-14', [w]))).toBe(false);
    expect(isCompleted(summarize('2026-10-14', [workout(null, [markedDone(set())])]))).toBe(true);
    expect(isCompleted(summarize('2026-10-14', []))).toBe(false);
  });
});

const exercise = { id: 'p1', name: 'Squat', notes: '', catalogId: null, restSeconds: null, restAfterSeconds: null, sets: [{ id: 'a', reps: 5, weight: 100 }] };
const weekly: TrainingPlan = {
  id: 'plan',
  name: 'Strength',
  recurrence: 'weekly',
  isActive: true,
  sessions: { 1: [exercise], 4: [exercise] },
};

describe('training plans', () => {
  it('lists training days in week order', () => {
    expect(trainingDays(weekly)).toEqual([1, 4]);
  });

  it('looks ahead up to a week for the next session', () => {
    expect(nextSessionFrom(weekly, '2026-10-13')).toHaveLength(1); // Tue -> Thu
    expect(nextSessionFrom({ ...weekly, sessions: {} }, '2026-10-13')).toEqual([]);
  });

  it('has a pending session until a workout was started from the plan', () => {
    expect(pendingSessionOn(weekly, '2026-10-12', [])).toMatchObject({ planId: 'plan', title: 'Strength' });
    expect(pendingSessionOn(weekly, '2026-10-13', [])).toBeNull(); // rest day
    expect(pendingSessionOn(weekly, '2026-10-12', [workout('plan', [])])).toBeNull();
    expect(pendingSessionOn(weekly, '2026-10-12', [workout('other', [])])).not.toBeNull();
  });
});

const chicken: FoodItem = {
  id: 'crea:1',
  name: 'Pollo, petto',
  brand: null,
  per100g: { kcal: 110, protein: 23, carbs: 0, fat: 1.5 },
  servingGrams: null,
};

describe('nutrition', () => {
  it('scales per-100g values by the portion', () => {
    expect(portionNutrients(portionOf(chicken, 200))).toEqual({ kcal: 220, protein: 46, carbs: 0, fat: 3 });
    expect(() => portionOf(chicken, 0)).toThrow();
  });

  it('parses food ids', () => {
    expect(parseFoodId('off:8076800195057')).toEqual({ source: 'off', key: '8076800195057' });
    expect(() => parseFoodId('nope:1')).toThrow();
  });

  it('counts only foods that have nutrition data', () => {
    const meal: Meal = {
      id: 'm',
      name: 'Lunch',
      time: '',
      foods: [
        { id: 'f1', name: 'Pollo', quantity: '', portion: portionOf(chicken, 100) },
        { id: 'f2', name: 'Insalata', quantity: 'a bowl', portion: null },
      ],
    };
    expect(mealNutrients(meal)?.kcal).toBe(110);
    expect(mealNutrients({ ...meal, foods: [meal.foods[1]!] })).toBeNull();

    const plan: DietPlan = { id: 'd', name: 'Cut', recurrence: 'weekly', isActive: true, meals: { 2: [meal], 3: [] } };
    expect(nutrientsOnDay(plan, 2)?.protein).toBe(23);
    expect(nutrientsOnDay(plan, 3)).toBeNull();
    expect(plannedDays(plan)).toEqual([2]);
  });
});

describe('targets', () => {
  it('computes Mifflin–St Jeor resting burn', () => {
    expect(restingKcal('male', 80, 180, 30)).toBeCloseTo(1780);
    expect(restingKcal('female', 60, 165, 30)).toBeCloseTo(1320.25);
  });

  it('prefers the custom calorie target', () => {
    const t = targetsForProfile({ ...defaultProfile, customKcal: 2000 }, null, null);
    expect(t).toMatchObject({ isCustom: true, nutrients: { kcal: 2000 } });
    expect(t?.nutrients.protein).toBeCloseTo(125); // 25% of kcal without a weight
  });

  it('needs the data to compute, and never goes below the minimum', () => {
    expect(targetsForProfile(defaultProfile, 70, 30)).toBeNull();
    const small = { ...defaultProfile, sex: 'female' as const, heightCm: 150, pace: 'lose_fast' as const, activity: 'sedentary' as const };
    expect(targetsForProfile(small, 45, 60)?.nutrients.kcal).toBe(1200);
  });

  it('computes age in whole years', () => {
    const p = { ...defaultProfile, birthDate: '1996-10-17' };
    expect(ageOn(p, '2026-10-16')).toBe(29);
    expect(ageOn(p, '2026-10-17')).toBe(30);
    expect(ageOn(defaultProfile, '2026-10-17')).toBeNull();
  });
});

describe('text search', () => {
  const foods = ['Pollo, petto', 'Mele', 'Mela cotogna', 'Petto di tacchino', 'Caffè'];

  it('ignores case, accents and linking words, and matches singular with plural', () => {
    expect(rank('petto di pollo', foods, (f) => f)).toEqual(['Pollo, petto']);
    expect(rank('mela', foods, (f) => f)).toEqual(['Mele', 'Mela cotogna']);
    expect(rank('CAFFE', foods, (f) => f)).toEqual(['Caffè']);
  });

  it('ranks first-word matches first, then shorter names', () => {
    expect(rank('petto', foods, (f) => f)).toEqual(['Petto di tacchino', 'Pollo, petto']);
  });

  it('returns nothing for an empty query', () => {
    expect(rank('  ', foods, (f) => f)).toEqual([]);
  });
});
