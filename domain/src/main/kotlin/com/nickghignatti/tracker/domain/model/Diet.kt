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

    /** The day's planned nutrition, counting only foods with nutrition data; null when there are none. */
    fun nutrientsOn(day: PlanDay): Nutrients? = mealsOn(day).mapNotNull { it.nutrients }.takeIf { it.isNotEmpty() }?.sum()
}

data class Meal(
    val id: Long,
    val name: String,
    /** Free text such as "08:00"; empty when unset. */
    val time: String,
    val foods: List<Food>,
) {
    /** Counting only foods with nutrition data; null when there are none. */
    val nutrients: Nutrients? get() = foods.mapNotNull { it.portion?.nutrients }.takeIf { it.isNotEmpty() }?.sum()
}

/** A food in a meal plan: either free text, or linked to a known food so its nutrition counts. */
data class Food(
    val id: Long,
    val name: String,
    /** Free text such as "1 cup"; empty when unset. Linked foods use [portion] instead. */
    val quantity: String,
    val portion: Portion? = null,
)
