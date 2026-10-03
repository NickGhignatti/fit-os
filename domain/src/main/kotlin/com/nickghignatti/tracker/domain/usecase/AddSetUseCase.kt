package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.model.Exercise
import com.nickghignatti.tracker.domain.model.SetPlan
import com.nickghignatti.tracker.domain.repository.WorkoutRepository
import javax.inject.Inject

/** Appends a set that repeats the last one: the usual "one more set" case. */
class AddSetUseCase @Inject constructor(
    private val workouts: WorkoutRepository,
) {
    suspend operator fun invoke(exercise: Exercise) =
        workouts.addSet(exercise.id, SetPlan.following(exercise.sets.lastOrNull()?.toPlan()))
}
