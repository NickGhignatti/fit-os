package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.model.Exercise
import com.nickghignatti.tracker.domain.model.SetPlan
import com.nickghignatti.tracker.domain.repository.WorkoutRepository
import javax.inject.Inject

/** Appends a set that repeats the last one: the usual "one more set" case. */
class AddSetUseCase @Inject constructor(
    private val workouts: WorkoutRepository,
) {
    suspend operator fun invoke(exercise: Exercise) {
        val next = exercise.sets.lastOrNull()?.toPlan() ?: SetPlan(DEFAULT_REPS, weight = null)
        workouts.addSet(exercise.id, next)
    }

    private companion object {
        const val DEFAULT_REPS = 10
    }
}
