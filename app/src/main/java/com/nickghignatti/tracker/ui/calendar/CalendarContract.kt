package com.nickghignatti.tracker.ui.calendar

import com.nickghignatti.tracker.domain.model.DaySummary
import java.time.LocalDate
import java.time.YearMonth

data class CalendarUiState(
    val month: YearMonth,
    val today: LocalDate,
    val days: Map<LocalDate, DaySummary> = emptyMap(),
    /** Upcoming days on which the active training plan has a session. */
    val plannedDays: Set<LocalDate> = emptySet(),
)

sealed interface CalendarAction {
    data object PreviousMonth : CalendarAction
    data object NextMonth : CalendarAction
    data object CurrentMonth : CalendarAction
}
