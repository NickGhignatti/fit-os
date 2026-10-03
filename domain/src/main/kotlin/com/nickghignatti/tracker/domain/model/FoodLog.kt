package com.nickghignatti.tracker.domain.model

import java.time.LocalDate

/** Something eaten: a portion of food, logged under a meal of a day. */
data class FoodLogEntry(
    val id: Long,
    val date: LocalDate,
    val meal: String,
    val portion: Portion,
)

/** A day of eating, meal by meal, next to what the active diet plans. */
data class CalorieDay(
    val date: LocalDate,
    val meals: List<MealLog>,
    val hasDietPlan: Boolean = false,
) {
    val eaten: Nutrients get() = meals.flatMap { it.entries }.map { it.portion.nutrients }.sum()

    /** What the diet plans for the day, counting only foods with nutrition data; null when there are none. */
    val planned: Nutrients? get() = meals.mapNotNull { it.planned?.nutrients }.takeIf { it.isNotEmpty() }?.sum()
}

/** One meal of a day: what the diet plans for it, if anything, and what was logged under its name. */
data class MealLog(
    val name: String,
    val planned: Meal? = null,
    val entries: List<FoodLogEntry> = emptyList(),
) {
    val eaten: Nutrients get() = entries.map { it.portion.nutrients }.sum()

    /** The planned foods can be logged in one go while nothing has been logged for this meal yet. */
    val canLogAsPlanned: Boolean get() = entries.isEmpty() && planned?.foods?.any { it.portion != null } == true
}
