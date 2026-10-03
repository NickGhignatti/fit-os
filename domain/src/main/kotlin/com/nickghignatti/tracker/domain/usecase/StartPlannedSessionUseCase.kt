package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.repository.TrainingPlanRepository
import com.nickghignatti.tracker.domain.repository.TransactionRunner
import com.nickghignatti.tracker.domain.repository.WorkoutRepository
import java.time.LocalDate
import javax.inject.Inject

/** Turns the active plan's session for a day into a workout that can be logged. */
class StartPlannedSessionUseCase @Inject constructor(
    private val workouts: WorkoutRepository,
    private val trainingPlans: TrainingPlanRepository,
    private val transaction: TransactionRunner,
) {
    /**
     * Returns the id of the day's workout from the active plan, creating it if needed (so a double
     * tap never starts it twice), or null when there is no active plan or nothing planned that day.
     */
    suspend operator fun invoke(date: LocalDate): Long? = transaction.run {
        val plan = trainingPlans.getActivePlan() ?: return@run null
        val dayWorkouts = workouts.getWorkouts(date)
        dayWorkouts.firstOrNull { it.planId == plan.id }?.let { return@run it.id }
        val session = plan.pendingSessionOn(date, dayWorkouts) ?: return@run null
        workouts.createWorkout(date, session.title, session.exercises, planId = plan.id)
    }
}
