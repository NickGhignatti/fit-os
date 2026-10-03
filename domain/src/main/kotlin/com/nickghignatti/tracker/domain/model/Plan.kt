package com.nickghignatti.tracker.domain.model

import java.time.DayOfWeek
import java.time.LocalDate

/** What training and diet plans have in common. At most one plan of each kind is active. */
sealed interface Plan {
    val id: Long
    val name: String
    val recurrence: Recurrence
    val isActive: Boolean
}

/** How a plan repeats: the same content every day, or its own content on each weekday. */
enum class Recurrence {
    DAILY,
    WEEKLY,
    ;

    /** The days a plan with this recurrence is made of, Monday first. */
    val days: List<PlanDay>
        get() = when (this) {
            DAILY -> listOf(PlanDay.EveryDay)
            WEEKLY -> DayOfWeek.entries.map(PlanDay::Weekday)
        }

    /** The part of a plan that applies on [day]. */
    fun dayOf(day: DayOfWeek): PlanDay = when (this) {
        DAILY -> PlanDay.EveryDay
        WEEKLY -> PlanDay.Weekday(day)
    }

    fun dayOf(date: LocalDate): PlanDay = dayOf(date.dayOfWeek)
}

/** One part of a plan: the only one of a daily plan, or one weekday of a weekly plan. */
sealed interface PlanDay {
    data object EveryDay : PlanDay

    data class Weekday(val day: DayOfWeek) : PlanDay
}
