package com.nickghignatti.tracker.domain.model

import java.time.LocalDate

/** A training session planned (and possibly logged) on a given day. */
data class Workout(
    val id: Long,
    val date: LocalDate,
    val title: String,
    val exercises: List<Exercise>,
    /** The training plan this workout was started from, if any. */
    val planId: Long? = null,
) {
    val totalSets: Int get() = exercises.sumOf { it.sets.size }
    val doneSets: Int get() = exercises.sumOf { it.doneSets }

    /** What this workout asks for, without any logged results. */
    fun toPlan(): List<ExercisePlan> = exercises.map(Exercise::toPlan)
}

data class Exercise(
    val id: Long,
    val name: String,
    val notes: String,
    val sets: List<ExerciseSet>,
    /** The catalogue exercise this one is, if picked from it. */
    val catalogId: String? = null,
) {
    val doneSets: Int get() = sets.count { it.done }

    fun toPlan(): ExercisePlan = ExercisePlan(name, notes, sets.map(ExerciseSet::toPlan), catalogId)
}

/** One set: what was planned and, once done, what was actually performed. */
data class ExerciseSet(
    val id: Long,
    val plannedReps: Int,
    /** Kilograms; null means bodyweight / not applicable. */
    val plannedWeight: Double?,
    val actualReps: Int? = null,
    val actualWeight: Double? = null,
    val done: Boolean = false,
) {
    /** True when the set was completed with different numbers than planned. */
    val deviatesFromPlan: Boolean
        get() = done && ((actualReps ?: plannedReps) != plannedReps || actualWeight != plannedWeight)

    fun toPlan(): SetPlan = SetPlan(plannedReps, plannedWeight)

    /**
     * A completed set always has actual values: any left blank default to the plan, so the
     * common case ("did exactly what was planned") needs no typing.
     */
    fun markedDone(): ExerciseSet = copy(
        done = true,
        actualReps = actualReps ?: plannedReps,
        actualWeight = actualWeight ?: plannedWeight,
    )

    /** Un-marking keeps any logged values, so re-marking restores them. */
    fun toggledDone(): ExerciseSet = if (done) copy(done = false) else markedDone()
}

/** Completion totals for one calendar day. */
data class DaySummary(
    val date: LocalDate,
    val totalSets: Int,
    val doneSets: Int,
) {
    val isCompleted: Boolean get() = totalSets > 0 && doneSets == totalSets
}
