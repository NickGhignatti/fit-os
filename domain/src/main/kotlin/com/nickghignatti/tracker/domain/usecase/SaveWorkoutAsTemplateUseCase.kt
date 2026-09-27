package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.repository.TemplateRepository
import com.nickghignatti.tracker.domain.repository.TransactionRunner
import com.nickghignatti.tracker.domain.repository.WorkoutRepository
import javax.inject.Inject

/** Saves a workout's plan (not its logged results) as a reusable template. */
class SaveWorkoutAsTemplateUseCase @Inject constructor(
    private val workouts: WorkoutRepository,
    private val templates: TemplateRepository,
    private val transaction: TransactionRunner,
) {
    /** Returns the new template's id, or null if the workout no longer exists. */
    suspend operator fun invoke(workoutId: Long, name: String): Long? = transaction.run {
        val workout = workouts.getWorkout(workoutId) ?: return@run null
        templates.createTemplate(name, workout.toPlan())
    }
}
