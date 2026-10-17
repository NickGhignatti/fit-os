package com.nickghignatti.tracker.domain.model

import java.time.LocalDate

/** A workout routine: one session repeated every day, or a session per weekday. */
data class TrainingPlan(
    override val id: Long,
    override val name: String,
    override val recurrence: Recurrence,
    override val isActive: Boolean = false,
    /** Exercises per plan day; a day without any is a rest day. */
    val sessions: Map<PlanDay, List<PlannedExercise>> = emptyMap(),
) : Plan {
    fun sessionOn(day: PlanDay): List<PlannedExercise> = sessions[day].orEmpty()

    fun sessionOn(date: LocalDate): List<PlannedExercise> = sessionOn(recurrence.dayOf(date))

    /** The first session from [date] on, [date] included, looking a week ahead; empty if the plan has none. */
    fun nextSessionFrom(date: LocalDate): List<PlannedExercise> =
        (0L..DAYS_AHEAD).map { sessionOn(date.plusDays(it)) }.firstOrNull { it.isNotEmpty() }.orEmpty()

    /** The days with something to do, in week order. */
    val trainingDays: List<PlanDay> get() = recurrence.days.filter { sessionOn(it).isNotEmpty() }
}

private const val DAYS_AHEAD = 6L

/** An exercise stored in a plan; unlike [ExercisePlan] it has ids, so it can be edited in place. */
data class PlannedExercise(
    val id: Long,
    val name: String,
    val notes: String,
    val sets: List<PlannedSet>,
    /** The catalogue exercise this one is, if picked from it. */
    val catalogId: String? = null,
) {
    fun toPlan(): ExercisePlan = ExercisePlan(name, notes, sets.map(PlannedSet::toPlan), catalogId)
}

data class PlannedSet(
    val id: Long,
    val reps: Int,
    /** Kilograms; null means bodyweight / not applicable. */
    val weight: Double?,
) {
    fun toPlan(): SetPlan = SetPlan(reps, weight)
}
