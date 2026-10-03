package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.domain.repository.TrainingPlanRepository
import com.nickghignatti.tracker.domain.repository.TransactionRunner
import com.nickghignatti.tracker.domain.repository.WorkoutRepository
import javax.inject.Inject

/** Saves a workout's plan (not its logged results) as a new daily training plan. */
class SaveWorkoutAsPlanUseCase @Inject constructor(
    private val workouts: WorkoutRepository,
    private val trainingPlans: TrainingPlanRepository,
    private val transaction: TransactionRunner,
) {
    /** Returns the new plan's id, or null if the workout no longer exists. */
    suspend operator fun invoke(workoutId: Long, name: String): Long? = transaction.run {
        val workout = workouts.getWorkout(workoutId) ?: return@run null
        trainingPlans.createPlan(name, Recurrence.DAILY, mapOf(PlanDay.EveryDay to workout.toPlan()))
    }
}
