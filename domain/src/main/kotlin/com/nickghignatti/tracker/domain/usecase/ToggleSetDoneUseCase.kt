package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.model.ExerciseSet
import com.nickghignatti.tracker.domain.repository.WorkoutRepository
import javax.inject.Inject

/** Marks a set done (pre-filling actuals from the plan) or not done. */
class ToggleSetDoneUseCase @Inject constructor(
    private val workouts: WorkoutRepository,
) {
    suspend operator fun invoke(set: ExerciseSet) = workouts.updateSet(set.toggledDone())
}
