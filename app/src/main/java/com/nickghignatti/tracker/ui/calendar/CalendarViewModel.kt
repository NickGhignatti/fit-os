package com.nickghignatti.tracker.ui.calendar

import androidx.lifecycle.ViewModel
import com.nickghignatti.tracker.domain.model.TrainingPlan
import com.nickghignatti.tracker.domain.repository.TrainingPlanRepository
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
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.update

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class CalendarViewModel @Inject constructor(
    clock: Clock,
    workouts: WorkoutRepository,
    trainingPlans: TrainingPlanRepository,
) : ViewModel() {
    private val today = LocalDate.now(clock)
    private val month = MutableStateFlow(YearMonth.from(today))

    val uiState: StateFlow<CalendarUiState> = month
        .flatMapLatest { shown ->
            combine(
                workouts.observeDaySummaries(shown.atDay(1), shown.atEndOfMonth()),
                trainingPlans.observeActivePlan(),
            ) { summaries, plan ->
                CalendarUiState(shown, today, summaries.associateBy { it.date }, plan.upcomingSessionDays(shown))
            }.onStart { emit(CalendarUiState(shown, today)) }
        }
        .stateInWhileSubscribed(this, CalendarUiState(month.value, today))

    /** Past days only show what was logged; from today on, the plan says what is coming. */
    private fun TrainingPlan?.upcomingSessionDays(month: YearMonth): Set<LocalDate> {
        if (this == null) return emptySet()
        return (1..month.lengthOfMonth()).map(month::atDay)
            .filter { it >= today && sessionOn(it).isNotEmpty() }
            .toSet()
    }

    fun onAction(action: CalendarAction) {
        when (action) {
            CalendarAction.PreviousMonth -> month.update { it.minusMonths(1) }
            CalendarAction.NextMonth -> month.update { it.plusMonths(1) }
            CalendarAction.CurrentMonth -> month.value = YearMonth.from(today)
        }
    }
}
