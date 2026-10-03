package com.nickghignatti.tracker.ui.diet

import com.nickghignatti.tracker.domain.model.DietPlan
import com.nickghignatti.tracker.domain.model.Meal
import com.nickghignatti.tracker.domain.model.PlanDay
import java.time.DayOfWeek

data class DietPlanUiState(
    val selectedDay: DayOfWeek,
    val today: DayOfWeek,
    /** Null while loading, or once the plan has been deleted. */
    val plan: DietPlan? = null,
    val isLoading: Boolean = true,
) {
    /** The part being edited: the only one of a daily plan, or the selected weekday. */
    val planDay: PlanDay? get() = plan?.recurrence?.dayOf(selectedDay)

    val meals: List<Meal> get() = planDay?.let { plan?.mealsOn(it) }.orEmpty()
}

sealed interface DietPlanAction {
    data class SelectDay(val day: DayOfWeek) : DietPlanAction
    data class AddMeal(val day: PlanDay, val name: String, val time: String) : DietPlanAction
    data class UpdateMeal(val mealId: Long, val name: String, val time: String) : DietPlanAction
    data class DeleteMeal(val mealId: Long) : DietPlanAction
    data class AddFood(val mealId: Long, val name: String, val quantity: String) : DietPlanAction
    data class UpdateFood(val foodId: Long, val name: String, val quantity: String) : DietPlanAction
    data class DeleteFood(val foodId: Long) : DietPlanAction

    /** Weekly plans only: copies one weekday's meals over others. */
    data class CopyDay(val source: DayOfWeek, val targets: Set<DayOfWeek>) : DietPlanAction
}
