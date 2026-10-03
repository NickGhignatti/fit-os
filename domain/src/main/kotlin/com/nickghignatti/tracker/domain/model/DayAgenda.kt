package com.nickghignatti.tracker.domain.model

import java.time.LocalDate

/** Everything planned for one day, from what is logged and from the active plans. */
data class DayAgenda(
    val date: LocalDate,
    val workouts: List<Workout> = emptyList(),
    /** The active training plan's session for the day, until it is started. */
    val pendingSession: PendingSession? = null,
    /** The active diet plan's meals for the day. */
    val meals: List<Meal> = emptyList(),
    val hasTrainingPlan: Boolean = false,
    val hasDietPlan: Boolean = false,
)

/** A session the active plan asks for, not yet turned into a workout that can be logged. */
data class PendingSession(
    val planId: Long,
    val title: String,
    val exercises: List<ExercisePlan>,
)
