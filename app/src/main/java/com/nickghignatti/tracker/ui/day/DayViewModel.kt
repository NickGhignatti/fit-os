package com.nickghignatti.tracker.ui.day

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nickghignatti.tracker.domain.repository.WorkoutRepository
import com.nickghignatti.tracker.domain.usecase.AddSetUseCase
import com.nickghignatti.tracker.domain.usecase.CopyWorkoutUseCase
import com.nickghignatti.tracker.domain.usecase.LogSetUseCase
import com.nickghignatti.tracker.domain.usecase.ObserveDayAgendaUseCase
import com.nickghignatti.tracker.domain.usecase.SaveWorkoutAsPlanUseCase
import com.nickghignatti.tracker.domain.usecase.StartPlannedSessionUseCase
import com.nickghignatti.tracker.domain.usecase.ToggleSetDoneUseCase
import com.nickghignatti.tracker.ui.common.stateInWhileSubscribed
import dagger.assisted.Assisted
import dagger.assisted.AssistedFactory
import dagger.assisted.AssistedInject
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Clock
import java.time.LocalDate
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch

/** The day is passed in with assisted injection, keeping navigation out of the ViewModel. */
@HiltViewModel(assistedFactory = DayViewModel.Factory::class)
class DayViewModel @AssistedInject constructor(
    @Assisted private val date: LocalDate,
    clock: Clock,
    private val workouts: WorkoutRepository,
    observeDayAgenda: ObserveDayAgendaUseCase,
    private val startPlannedSession: StartPlannedSessionUseCase,
    private val saveWorkoutAsPlan: SaveWorkoutAsPlanUseCase,
    private val copyWorkout: CopyWorkoutUseCase,
    private val toggleSetDone: ToggleSetDoneUseCase,
    private val addSet: AddSetUseCase,
    private val logSet: LogSetUseCase,
) : ViewModel() {

    @AssistedFactory
    interface Factory {
        fun create(date: LocalDate): DayViewModel
    }

    private val isToday = date == LocalDate.now(clock)

    val uiState: StateFlow<DayUiState> = observeDayAgenda(date)
        .map { agenda -> DayUiState(date, isToday, agenda.workouts, agenda.pendingSession, isLoading = false) }
        .stateInWhileSubscribed(this, DayUiState(date, isToday))

    private val _events = Channel<DayEvent>(Channel.BUFFERED)
    val events: Flow<DayEvent> = _events.receiveAsFlow()

    fun onAction(action: DayAction) {
        viewModelScope.launch { handle(action) }
    }

    private suspend fun handle(action: DayAction) {
        when (action) {
            DayAction.StartPlannedSession -> startPlannedSession(date)
            is DayAction.CreateWorkout -> workouts.createWorkout(date, action.title.trim())
            is DayAction.RenameWorkout -> workouts.renameWorkout(action.workoutId, action.title.trim())
            is DayAction.DeleteWorkout -> workouts.deleteWorkout(action.workoutId)
            is DayAction.CopyWorkout ->
                copyWorkout(action.workoutId, action.target)?.let { _events.send(DayEvent.WorkoutCopied(action.target)) }
            is DayAction.SaveAsPlan -> {
                val name = action.name.trim()
                saveWorkoutAsPlan(action.workoutId, name)?.let { _events.send(DayEvent.PlanSaved(name)) }
            }
            is DayAction.UpdateExercise ->
                workouts.updateExercise(action.exerciseId, action.name.trim(), action.notes.trim())
            is DayAction.DeleteExercise -> workouts.deleteExercise(action.exerciseId)
            is DayAction.AddSet -> addSet(action.exercise)
            is DayAction.ToggleSet -> toggleSetDone(action.set)
            is DayAction.UpdateSet -> logSet(action.set)
            is DayAction.DeleteSet -> workouts.deleteSet(action.setId)
        }
    }
}
