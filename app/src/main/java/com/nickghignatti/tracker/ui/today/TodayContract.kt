package com.nickghignatti.tracker.ui.today

import com.nickghignatti.tracker.domain.model.CalorieDay
import com.nickghignatti.tracker.domain.model.DailyTargets
import com.nickghignatti.tracker.domain.model.DayAgenda
import com.nickghignatti.tracker.domain.model.Meal
import java.time.LocalDate

data class TodayUiState(
    val agenda: DayAgenda,
    /** What was eaten today next to what the diet plans, meal by meal. */
    val calories: CalorieDay = CalorieDay(agenda.date, emptyList()),
    /** The profile's daily goal; null until the profile has enough data. */
    val targets: DailyTargets? = null,
    val isLoading: Boolean = true,
) {
    val date: LocalDate get() = agenda.date
}

sealed interface TodayAction {
    data object StartPlannedSession : TodayAction
    data class LogMeal(val meal: Meal) : TodayAction
}

sealed interface TodayEvent {
    /** The planned workout exists now, so the screen can open the day to log it. */
    data class SessionStarted(val date: LocalDate) : TodayEvent
}
