package com.nickghignatti.tracker.domain.repository

import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.domain.model.SetPlan
import com.nickghignatti.tracker.domain.model.TrainingPlan

/** Training plans with their exercises and sets. Lists are returned in the user's order. */
interface TrainingPlanRepository : PlanRepository<TrainingPlan> {
    /** Creates an inactive plan pre-filled with [sessions]; returns its id. */
    suspend fun createPlan(name: String, recurrence: Recurrence, sessions: Map<PlanDay, List<ExercisePlan>>): Long

    /** Appends an exercise at the end of [day]'s session. */
    suspend fun addExercise(planId: Long, day: PlanDay, exercise: ExercisePlan)

    suspend fun updateExercise(id: Long, name: String, notes: String)

    suspend fun deleteExercise(id: Long)

    /** Appends a set at the end of the exercise. */
    suspend fun addSet(exerciseId: Long, set: SetPlan)

    suspend fun updateSet(id: Long, set: SetPlan)

    suspend fun deleteSet(id: Long)
}
