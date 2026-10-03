package com.nickghignatti.tracker.domain.model

import java.time.LocalDate

/** A meal plan: the same meals every day, or different meals per weekday. */
data class DietPlan(
    override val id: Long,
    override val name: String,
    override val recurrence: Recurrence,
    override val isActive: Boolean = false,
    /** Meals per plan day, in the user's order. */
    val meals: Map<PlanDay, List<Meal>> = emptyMap(),
) : Plan {
    fun mealsOn(day: PlanDay): List<Meal> = meals[day].orEmpty()

    fun mealsOn(date: LocalDate): List<Meal> = mealsOn(recurrence.dayOf(date))

    /** The days with at least one meal, in week order. */
    val plannedDays: List<PlanDay> get() = recurrence.days.filter { mealsOn(it).isNotEmpty() }
}

data class Meal(
    val id: Long,
    val name: String,
    /** Free text such as "08:00"; empty when unset. */
    val time: String,
    val foods: List<Food>,
)

data class Food(
    val id: Long,
    val name: String,
    /** Free text such as "80 g" or "1 cup". */
    val quantity: String,
)
