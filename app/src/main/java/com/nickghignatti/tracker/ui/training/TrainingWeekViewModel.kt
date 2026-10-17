package com.nickghignatti.tracker.ui.training

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nickghignatti.tracker.domain.usecase.ObserveTrainingWeekUseCase
import com.nickghignatti.tracker.domain.usecase.StartPlannedSessionUseCase
import com.nickghignatti.tracker.domain.usecase.TrainingWeek
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

data class TrainingWeekUiState(
    val today: LocalDate,
    /** The active plan's progress this week; null while no plan is active. */
    val week: TrainingWeek? = null,
)

/** The active program card of the Workouts screen, and starting its session for today. */
@HiltViewModel
class TrainingWeekViewModel @Inject constructor(
    clock: Clock,
    observeTrainingWeek: ObserveTrainingWeekUseCase,
    private val startPlannedSession: StartPlannedSessionUseCase,
) : ViewModel() {
    private val today = LocalDate.now(clock)

    val uiState: StateFlow<TrainingWeekUiState> = observeTrainingWeek(today)
        .map { TrainingWeekUiState(today, it) }
        .stateInWhileSubscribed(this, TrainingWeekUiState(today))

    private val _sessionStarted = Channel<LocalDate>(Channel.BUFFERED)

    /** Emits the day to open once today's planned workout exists. */
    val sessionStarted: Flow<LocalDate> = _sessionStarted.receiveAsFlow()

    fun startToday() {
        viewModelScope.launch { startPlannedSession(today)?.let { _sessionStarted.send(today) } }
    }
}
