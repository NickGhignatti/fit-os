package com.nickghignatti.tracker.ui.calendar

import androidx.lifecycle.ViewModel
import com.nickghignatti.tracker.domain.repository.WorkoutRepository
import com.nickghignatti.tracker.ui.common.stateInWhileSubscribed
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Clock
import java.time.LocalDate
import java.time.YearMonth
import javax.inject.Inject
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.update

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class CalendarViewModel @Inject constructor(
    clock: Clock,
    workouts: WorkoutRepository,
) : ViewModel() {
    private val today = LocalDate.now(clock)
    private val month = MutableStateFlow(YearMonth.from(today))

    val uiState: StateFlow<CalendarUiState> = month
        .flatMapLatest { shown ->
            workouts.observeDaySummaries(shown.atDay(1), shown.atEndOfMonth())
                .map { summaries -> CalendarUiState(shown, today, summaries.associateBy { it.date }) }
                .onStart { emit(CalendarUiState(shown, today)) }
        }
        .stateInWhileSubscribed(this, CalendarUiState(month.value, today))

    fun onAction(action: CalendarAction) {
        when (action) {
            CalendarAction.PreviousMonth -> month.update { it.minusMonths(1) }
            CalendarAction.NextMonth -> month.update { it.plusMonths(1) }
            CalendarAction.CurrentMonth -> month.value = YearMonth.from(today)
        }
    }
}
