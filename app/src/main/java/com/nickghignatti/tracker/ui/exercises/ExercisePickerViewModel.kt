package com.nickghignatti.tracker.ui.exercises

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nickghignatti.tracker.domain.model.ExerciseFilter
import com.nickghignatti.tracker.domain.model.ExerciseInfo
import com.nickghignatti.tracker.domain.repository.ExerciseCatalogRepository
import com.nickghignatti.tracker.domain.repository.TrainingPlanRepository
import com.nickghignatti.tracker.domain.repository.WorkoutRepository
import com.nickghignatti.tracker.ui.common.stateInWhileSubscribed
import dagger.assisted.Assisted
import dagger.assisted.AssistedFactory
import dagger.assisted.AssistedInject
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.mapLatest
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Browses the exercise catalogue and adds the chosen exercise, with its sets, to [target]. */
@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel(assistedFactory = ExercisePickerViewModel.Factory::class)
class ExercisePickerViewModel @AssistedInject constructor(
    @Assisted private val target: ExerciseTarget,
    catalog: ExerciseCatalogRepository,
    private val workouts: WorkoutRepository,
    private val plans: TrainingPlanRepository,
) : ViewModel() {

    @AssistedFactory
    interface Factory {
        fun create(target: ExerciseTarget): ExercisePickerViewModel
    }

    private val query = MutableStateFlow("")
    private val filter = MutableStateFlow(ExerciseFilter())
    private val picked = MutableStateFlow<ExerciseInfo?>(null)

    private val results = combine(query, filter, ::Pair).mapLatest { (text, current) -> catalog.search(text.trim(), current) }

    val uiState: StateFlow<ExercisePickerUiState> =
        combine(query, filter, results, picked) { text, current, found, choice ->
            ExercisePickerUiState(text, current, found, choice, isLoading = false)
        }.stateInWhileSubscribed(this, ExercisePickerUiState())

    private val _events = Channel<ExercisePickerEvent>(Channel.BUFFERED)
    val events: Flow<ExercisePickerEvent> = _events.receiveAsFlow()

    fun onAction(action: ExercisePickerAction) {
        when (action) {
            is ExercisePickerAction.QueryChanged -> query.value = action.query
            is ExercisePickerAction.ToggleMuscle ->
                filter.update { it.copy(muscle = action.muscle.takeUnless { muscle -> muscle == it.muscle }) }
            is ExercisePickerAction.ToggleEquipment ->
                filter.update { it.copy(equipment = action.equipment.takeUnless { equipment -> equipment == it.equipment }) }
            is ExercisePickerAction.Pick -> picked.value = action.exercise
            ExercisePickerAction.DismissPick -> picked.value = null
            is ExercisePickerAction.Add -> {
                picked.value = null
                val exercise = action.exercise.copy(name = action.exercise.name.trim(), notes = action.exercise.notes.trim())
                viewModelScope.launch {
                    when (target) {
                        is ExerciseTarget.Workout -> workouts.addExercise(target.workoutId, exercise)
                        is ExerciseTarget.Plan -> plans.addExercise(target.planId, target.day, exercise)
                    }
                    _events.send(ExercisePickerEvent.Added)
                }
            }
        }
    }
}
