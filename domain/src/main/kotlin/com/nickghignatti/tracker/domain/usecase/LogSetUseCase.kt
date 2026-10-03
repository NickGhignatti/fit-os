package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.model.ExerciseSet
import com.nickghignatti.tracker.domain.repository.WorkoutRepository
import javax.inject.Inject

/** Saves an edited set; a completed set gets the planned value for any actual left blank. */
class LogSetUseCase @Inject constructor(
    private val workouts: WorkoutRepository,
) {
    suspend operator fun invoke(set: ExerciseSet) = workouts.updateSet(if (set.done) set.markedDone() else set)
}
