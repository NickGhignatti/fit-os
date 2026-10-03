package com.nickghignatti.tracker.data.mapper

import com.nickghignatti.tracker.data.local.CustomFoodEntity
import com.nickghignatti.tracker.data.local.DaySummaryRow
import com.nickghignatti.tracker.data.local.DietPlanWithMeals
import com.nickghignatti.tracker.data.local.ExerciseWithSets
import com.nickghignatti.tracker.data.local.FoodColumns
import com.nickghignatti.tracker.data.local.FoodEntity
import com.nickghignatti.tracker.data.local.FoodLogEntity
import com.nickghignatti.tracker.data.local.MealWithFoods
import com.nickghignatti.tracker.data.local.PlanExerciseWithSets
import com.nickghignatti.tracker.data.local.PlanSetEntity
import com.nickghignatti.tracker.data.local.SetEntity
import com.nickghignatti.tracker.data.local.TrainingPlanWithExercises
import com.nickghignatti.tracker.data.local.WorkoutWithExercises
import com.nickghignatti.tracker.domain.model.DaySummary
import com.nickghignatti.tracker.domain.model.DietPlan
import com.nickghignatti.tracker.domain.model.Exercise
import com.nickghignatti.tracker.domain.model.ExerciseSet
import com.nickghignatti.tracker.domain.model.Food
import com.nickghignatti.tracker.domain.model.FoodId
import com.nickghignatti.tracker.domain.model.FoodItem
import com.nickghignatti.tracker.domain.model.FoodLogEntry
import com.nickghignatti.tracker.domain.model.FoodSource
import com.nickghignatti.tracker.domain.model.Meal
import com.nickghignatti.tracker.domain.model.Nutrients
import com.nickghignatti.tracker.domain.model.PlannedExercise
import com.nickghignatti.tracker.domain.model.PlannedSet
import com.nickghignatti.tracker.domain.model.Portion
import com.nickghignatti.tracker.domain.model.TrainingPlan
import com.nickghignatti.tracker.domain.model.Workout

// Room relations come back unordered; every child list is sorted by `position` here.

internal fun WorkoutWithExercises.toDomain() = Workout(
    id = workout.id,
    date = workout.date,
    title = workout.title,
    exercises = exercises.sortedBy { it.exercise.position }.map { it.toDomain() },
    planId = workout.planId,
)

internal fun ExerciseWithSets.toDomain() = Exercise(
    id = exercise.id,
    name = exercise.name,
    notes = exercise.notes,
    sets = sets.sortedBy { it.position }.map { it.toDomain() },
)

internal fun SetEntity.toDomain() = ExerciseSet(
    id = id,
    plannedReps = plannedReps,
    plannedWeight = plannedWeight,
    actualReps = actualReps,
    actualWeight = actualWeight,
    done = done,
)

internal fun DaySummaryRow.toDomain() = DaySummary(date, totalSets, doneSets)

internal fun TrainingPlanWithExercises.toDomain() = TrainingPlan(
    id = plan.id,
    name = plan.name,
    recurrence = plan.recurrence,
    isActive = plan.isActive,
    sessions = exercises
        .sortedBy { it.exercise.position }
        .groupBy(keySelector = { it.exercise.day }, valueTransform = { it.toDomain() }),
)

internal fun PlanExerciseWithSets.toDomain() = PlannedExercise(
    id = exercise.id,
    name = exercise.name,
    notes = exercise.notes,
    sets = sets.sortedBy { it.position }.map { it.toDomain() },
)

internal fun PlanSetEntity.toDomain() = PlannedSet(id, reps, weight)

internal fun DietPlanWithMeals.toDomain() = DietPlan(
    id = plan.id,
    name = plan.name,
    recurrence = plan.recurrence,
    isActive = plan.isActive,
    meals = meals
        .sortedWith(compareBy({ it.meal.position }, { it.meal.id }))
        .groupBy(keySelector = { it.meal.day }, valueTransform = { it.toDomain() }),
)

internal fun MealWithFoods.toDomain() = Meal(
    id = meal.id,
    name = meal.name,
    time = meal.time,
    foods = foods.sortedBy { it.position }.map { it.toDomain() },
)

internal fun FoodEntity.toDomain() = Food(
    id = id,
    name = name,
    quantity = quantity,
    portion = if (linkedFood != null && grams != null) Portion(linkedFood.toDomain(), grams) else null,
)

internal fun FoodColumns.toDomain() = FoodItem(
    id = foodId,
    name = name,
    per100g = Nutrients(kcal, protein, carbs, fat),
    brand = brand,
    servingGrams = servingGrams,
)

internal fun FoodItem.toColumns() = FoodColumns(
    foodId = id,
    name = name,
    brand = brand,
    kcal = per100g.kcal,
    protein = per100g.protein,
    carbs = per100g.carbs,
    fat = per100g.fat,
    servingGrams = servingGrams,
)

internal fun FoodLogEntity.toDomain() = FoodLogEntry(id, date, meal, Portion(food.toDomain(), grams))

internal fun CustomFoodEntity.toDomain() = FoodItem(
    id = FoodId(FoodSource.CUSTOM, id.toString()),
    name = name,
    per100g = Nutrients(kcal, protein, carbs, fat),
    brand = brand,
    servingGrams = servingGrams,
)
