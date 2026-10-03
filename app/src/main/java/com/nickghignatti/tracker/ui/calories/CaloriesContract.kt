package com.nickghignatti.tracker.ui.calories

import com.nickghignatti.tracker.domain.model.CalorieDay
import com.nickghignatti.tracker.domain.model.Meal
import java.time.LocalDate

data class CaloriesUiState(
    val day: CalorieDay,
    val today: LocalDate,
    val isLoading: Boolean = true,
) {
    val date: LocalDate get() = day.date
}

sealed interface CaloriesAction {
    data object PreviousDay : CaloriesAction
    data object NextDay : CaloriesAction
    data object GoToToday : CaloriesAction
    data class LogAsPlanned(val meal: Meal) : CaloriesAction
    data class UpdateGrams(val entryId: Long, val grams: Double) : CaloriesAction
    data class DeleteEntry(val entryId: Long) : CaloriesAction
}
