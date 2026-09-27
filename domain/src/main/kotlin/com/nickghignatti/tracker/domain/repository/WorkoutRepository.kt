package com.nickghignatti.tracker.domain.repository

import com.nickghignatti.tracker.domain.model.DaySummary
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.ExerciseSet
import com.nickghignatti.tracker.domain.model.SetPlan
import com.nickghignatti.tracker.domain.model.Workout
import java.time.LocalDate
import kotlinx.coroutines.flow.Flow

/** Workouts, their exercises and sets. Lists are returned in the user's order. */
interface WorkoutRepository {
    fun observeWorkouts(date: LocalDate): Flow<List<Workout>>

    fun observeDaySummaries(from: LocalDate, to: LocalDate): Flow<List<DaySummary>>

    suspend fun getWorkout(id: Long): Workout?

    /** Creates a workout, optionally pre-filled with [exercises]; returns its id. */
    suspend fun createWorkout(date: LocalDate, title: String, exercises: List<ExercisePlan> = emptyList()): Long

    suspend fun renameWorkout(id: Long, title: String)

    suspend fun deleteWorkout(id: Long)

    /** Appends an exercise at the end of the workout. */
    suspend fun addExercise(workoutId: Long, exercise: ExercisePlan)

    suspend fun updateExercise(id: Long, name: String, notes: String)

    suspend fun deleteExercise(id: Long)

    /** Appends a set at the end of the exercise. */
    suspend fun addSet(exerciseId: Long, set: SetPlan)

    suspend fun updateSet(set: ExerciseSet)

    suspend fun deleteSet(id: Long)
}
