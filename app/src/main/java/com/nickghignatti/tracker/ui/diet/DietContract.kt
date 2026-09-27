package com.nickghignatti.tracker.ui.diet

import com.nickghignatti.tracker.domain.model.Meal
import java.time.DayOfWeek

data class DietUiState(
    val selectedDay: DayOfWeek,
    val today: DayOfWeek,
    val meals: List<Meal> = emptyList(),
    val isLoading: Boolean = true,
)

sealed interface DietAction {
    data class SelectDay(val day: DayOfWeek) : DietAction
    data class AddMeal(val name: String, val time: String) : DietAction
    data class UpdateMeal(val mealId: Long, val name: String, val time: String) : DietAction
    data class DeleteMeal(val mealId: Long) : DietAction
    data class AddFood(val mealId: Long, val name: String, val quantity: String) : DietAction
    data class UpdateFood(val foodId: Long, val name: String, val quantity: String) : DietAction
    data class DeleteFood(val foodId: Long) : DietAction
    data class CopyDay(val targets: Set<DayOfWeek>) : DietAction
}
