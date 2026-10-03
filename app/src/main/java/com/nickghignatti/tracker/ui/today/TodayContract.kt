package com.nickghignatti.tracker.ui.today

import com.nickghignatti.tracker.domain.model.DayAgenda
import java.time.LocalDate

data class TodayUiState(
    val agenda: DayAgenda,
    val isLoading: Boolean = true,
) {
    val date: LocalDate get() = agenda.date
}

sealed interface TodayAction {
    data object StartPlannedSession : TodayAction
}

sealed interface TodayEvent {
    /** The planned workout exists now, so the screen can open the day to log it. */
    data class SessionStarted(val date: LocalDate) : TodayEvent
}
