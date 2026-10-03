package com.nickghignatti.tracker.ui.training

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nickghignatti.tracker.domain.repository.TrainingPlanRepository
import com.nickghignatti.tracker.domain.usecase.AddPlannedSetUseCase
import com.nickghignatti.tracker.ui.common.stateInWhileSubscribed
import dagger.assisted.Assisted
import dagger.assisted.AssistedFactory
import dagger.assisted.AssistedInject
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Clock
import java.time.LocalDate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

/** Edits one training plan; a weekly plan is edited one weekday at a time, starting from today's. */
@HiltViewModel(assistedFactory = TrainingPlanViewModel.Factory::class)
class TrainingPlanViewModel @AssistedInject constructor(
    @Assisted planId: Long,
    clock: Clock,
    private val plans: TrainingPlanRepository,
    private val addPlannedSet: AddPlannedSetUseCase,
) : ViewModel() {

    @AssistedFactory
    interface Factory {
        fun create(planId: Long): TrainingPlanViewModel
    }

    private val today = LocalDate.now(clock).dayOfWeek
    private val selectedDay = MutableStateFlow(today)

    val uiState: StateFlow<TrainingPlanUiState> =
        combine(plans.observePlan(planId), selectedDay) { plan, day ->
            TrainingPlanUiState(selectedDay = day, today = today, plan = plan, isLoading = false)
        }.stateInWhileSubscribed(this, TrainingPlanUiState(selectedDay = today, today = today))

    fun onAction(action: TrainingPlanAction) {
        when (action) {
            is TrainingPlanAction.SelectDay -> selectedDay.value = action.day
            is TrainingPlanAction.UpdateExercise ->
                launch { plans.updateExercise(action.exerciseId, action.name.trim(), action.notes.trim()) }
            is TrainingPlanAction.DeleteExercise -> launch { plans.deleteExercise(action.exerciseId) }
            is TrainingPlanAction.AddSet -> launch { addPlannedSet(action.exercise) }
            is TrainingPlanAction.UpdateSet -> launch { plans.updateSet(action.setId, action.set) }
            is TrainingPlanAction.DeleteSet -> launch { plans.deleteSet(action.setId) }
        }
    }

    private fun launch(block: suspend () -> Unit) {
        viewModelScope.launch { block() }
    }
}
