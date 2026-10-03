package com.nickghignatti.tracker.ui.today

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nickghignatti.tracker.domain.model.DayAgenda
import com.nickghignatti.tracker.domain.usecase.ObserveDayAgendaUseCase
import com.nickghignatti.tracker.domain.usecase.StartPlannedSessionUseCase
import com.nickghignatti.tracker.ui.common.stateInWhileSubscribed
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Clock
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch

@HiltViewModel
class TodayViewModel @Inject constructor(
    clock: Clock,
    observeDayAgenda: ObserveDayAgendaUseCase,
    private val startPlannedSession: StartPlannedSessionUseCase,
) : ViewModel() {
    private val today = LocalDate.now(clock)

    val uiState: StateFlow<TodayUiState> = observeDayAgenda(today)
        .map { TodayUiState(it, isLoading = false) }
        .stateInWhileSubscribed(this, TodayUiState(DayAgenda(today)))

    private val _events = Channel<TodayEvent>(Channel.BUFFERED)
    val events: Flow<TodayEvent> = _events.receiveAsFlow()

    fun onAction(action: TodayAction) {
        when (action) {
            TodayAction.StartPlannedSession -> viewModelScope.launch {
                startPlannedSession(today)?.let { _events.send(TodayEvent.SessionStarted(today)) }
            }
        }
    }
}
