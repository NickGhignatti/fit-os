package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.repository.TransactionRunner
import com.nickghignatti.tracker.domain.repository.WorkoutRepository
import java.time.LocalDate
import javax.inject.Inject

/** Copies a workout's plan (not its logged results) to another day. */
class CopyWorkoutUseCase @Inject constructor(
    private val workouts: WorkoutRepository,
    private val transaction: TransactionRunner,
) {
    /** Returns the new workout's id, or null if the source no longer exists. */
    suspend operator fun invoke(workoutId: Long, date: LocalDate): Long? = transaction.run {
        val workout = workouts.getWorkout(workoutId) ?: return@run null
        workouts.createWorkout(date, workout.title, workout.toPlan())
    }
}
