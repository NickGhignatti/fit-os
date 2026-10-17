package com.nickghignatti.tracker.ui.today

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nickghignatti.tracker.domain.model.CalorieDay
import com.nickghignatti.tracker.domain.model.DayAgenda
import com.nickghignatti.tracker.domain.usecase.LogPlannedMealUseCase
import com.nickghignatti.tracker.domain.usecase.ObserveCalorieDayUseCase
import com.nickghignatti.tracker.domain.usecase.ObserveDailyTargetsUseCase
import com.nickghignatti.tracker.domain.usecase.ObserveDayAgendaUseCase
import com.nickghignatti.tracker.domain.usecase.StartPlannedSessionUseCase
import com.nickghignatti.tracker.ui.calories.DefaultMealNames
import com.nickghignatti.tracker.ui.common.stateInWhileSubscribed
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Clock
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch

@HiltViewModel
class TodayViewModel @Inject constructor(
    clock: Clock,
    observeDayAgenda: ObserveDayAgendaUseCase,
    observeCalorieDay: ObserveCalorieDayUseCase,
    observeDailyTargets: ObserveDailyTargetsUseCase,
    defaultMealNames: DefaultMealNames,
    private val startPlannedSession: StartPlannedSessionUseCase,
    private val logPlannedMeal: LogPlannedMealUseCase,
) : ViewModel() {
    private val today = LocalDate.now(clock)

    val uiState: StateFlow<TodayUiState> = combine(
        observeDayAgenda(today),
        observeCalorieDay(today, defaultMealNames.get()),
        observeDailyTargets(today),
    ) { agenda, calories, targets -> TodayUiState(agenda, calories, targets, isLoading = false) }
        .stateInWhileSubscribed(this, TodayUiState(DayAgenda(today), CalorieDay(today, emptyList())))

    private val _events = Channel<TodayEvent>(Channel.BUFFERED)
    val events: Flow<TodayEvent> = _events.receiveAsFlow()

    fun onAction(action: TodayAction) {
        when (action) {
            TodayAction.StartPlannedSession -> viewModelScope.launch {
                startPlannedSession(today)?.let { _events.send(TodayEvent.SessionStarted(today)) }
            }
            is TodayAction.LogMeal -> viewModelScope.launch { logPlannedMeal(today, action.meal) }
        }
    }
}
