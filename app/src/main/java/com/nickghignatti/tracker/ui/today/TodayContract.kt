package com.nickghignatti.tracker.ui.today

import com.nickghignatti.tracker.domain.model.Meal
import com.nickghignatti.tracker.domain.model.Workout
import java.time.LocalDate

data class TodayUiState(
    val date: LocalDate,
    val workouts: List<Workout> = emptyList(),
    val meals: List<Meal> = emptyList(),
    val isLoading: Boolean = true,
)
