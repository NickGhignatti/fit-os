package com.nickghignatti.tracker.data.mapper

import com.nickghignatti.tracker.data.local.DaySummaryRow
import com.nickghignatti.tracker.data.local.ExerciseWithSets
import com.nickghignatti.tracker.data.local.FoodEntity
import com.nickghignatti.tracker.data.local.MealWithFoods
import com.nickghignatti.tracker.data.local.SetEntity
import com.nickghignatti.tracker.data.local.TemplateExerciseWithSets
import com.nickghignatti.tracker.data.local.TemplateSetEntity
import com.nickghignatti.tracker.data.local.TemplateWithExercises
import com.nickghignatti.tracker.data.local.WorkoutWithExercises
import com.nickghignatti.tracker.domain.model.DaySummary
import com.nickghignatti.tracker.domain.model.Exercise
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.ExerciseSet
import com.nickghignatti.tracker.domain.model.Food
import com.nickghignatti.tracker.domain.model.Meal
import com.nickghignatti.tracker.domain.model.SetPlan
import com.nickghignatti.tracker.domain.model.Workout
import com.nickghignatti.tracker.domain.model.WorkoutTemplate

// Room relations come back unordered; every child list is sorted by `position` here.

internal fun WorkoutWithExercises.toDomain() = Workout(
    id = workout.id,
    date = workout.date,
    title = workout.title,
    exercises = exercises.sortedBy { it.exercise.position }.map { it.toDomain() },
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

internal fun TemplateWithExercises.toDomain() = WorkoutTemplate(
    id = template.id,
    name = template.name,
    exercises = exercises.sortedBy { it.exercise.position }.map { it.toDomain() },
)

internal fun TemplateExerciseWithSets.toDomain() = ExercisePlan(
    name = exercise.name,
    notes = exercise.notes,
    sets = sets.sortedBy { it.position }.map { it.toDomain() },
)

internal fun TemplateSetEntity.toDomain() = SetPlan(reps, weight)

internal fun MealWithFoods.toDomain() = Meal(
    id = meal.id,
    day = meal.dayOfWeek,
    name = meal.name,
    time = meal.time,
    foods = foods.sortedBy { it.position }.map { it.toDomain() },
)

internal fun FoodEntity.toDomain() = Food(id, name, quantity)
