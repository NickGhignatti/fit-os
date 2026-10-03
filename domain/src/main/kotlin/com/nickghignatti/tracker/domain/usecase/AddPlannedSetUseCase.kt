package com.nickghignatti.tracker.domain.usecase

import com.nickghignatti.tracker.domain.model.PlannedExercise
import com.nickghignatti.tracker.domain.model.SetPlan
import com.nickghignatti.tracker.domain.repository.TrainingPlanRepository
import javax.inject.Inject

/** Appends a set to a plan's exercise that repeats the last one. */
class AddPlannedSetUseCase @Inject constructor(
    private val trainingPlans: TrainingPlanRepository,
) {
    suspend operator fun invoke(exercise: PlannedExercise) =
        trainingPlans.addSet(exercise.id, SetPlan.following(exercise.sets.lastOrNull()?.toPlan()))
}
