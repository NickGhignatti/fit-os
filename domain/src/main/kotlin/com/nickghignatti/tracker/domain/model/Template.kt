package com.nickghignatti.tracker.domain.model

/** A reusable workout, saved from a day and applied to other days. */
data class WorkoutTemplate(
    val id: Long,
    val name: String,
    val exercises: List<ExercisePlan>,
) {
    val totalSets: Int get() = exercises.sumOf { it.sets.size }
}

/** A storage-independent description of an exercise to perform, without logged results. */
data class ExercisePlan(
    val name: String,
    val notes: String = "",
    val sets: List<SetPlan>,
) {
    companion object {
        fun uniform(name: String, notes: String, sets: Int, reps: Int, weight: Double?): ExercisePlan =
            ExercisePlan(name, notes, List(sets) { SetPlan(reps, weight) })
    }
}

data class SetPlan(
    val reps: Int,
    /** Kilograms; null means bodyweight / not applicable. */
    val weight: Double?,
) {
    init {
        require(reps > 0) { "reps must be positive, was $reps" }
        require(weight == null || weight >= 0) { "weight must not be negative, was $weight" }
    }
}
