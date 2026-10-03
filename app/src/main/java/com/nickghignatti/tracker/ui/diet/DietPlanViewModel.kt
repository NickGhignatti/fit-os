package com.nickghignatti.tracker.ui.diet

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.repository.DietPlanRepository
import com.nickghignatti.tracker.domain.usecase.CopyDietDayUseCase
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

/** Edits one diet plan; a weekly plan is edited one weekday at a time, starting from today's. */
@HiltViewModel(assistedFactory = DietPlanViewModel.Factory::class)
class DietPlanViewModel @AssistedInject constructor(
    @Assisted private val planId: Long,
    clock: Clock,
    private val diet: DietPlanRepository,
    private val copyDietDay: CopyDietDayUseCase,
) : ViewModel() {

    @AssistedFactory
    interface Factory {
        fun create(planId: Long): DietPlanViewModel
    }

    private val today = LocalDate.now(clock).dayOfWeek
    private val selectedDay = MutableStateFlow(today)

    val uiState: StateFlow<DietPlanUiState> =
        combine(diet.observePlan(planId), selectedDay) { plan, day ->
            DietPlanUiState(selectedDay = day, today = today, plan = plan, isLoading = false)
        }.stateInWhileSubscribed(this, DietPlanUiState(selectedDay = today, today = today))

    fun onAction(action: DietPlanAction) {
        when (action) {
            is DietPlanAction.SelectDay -> selectedDay.value = action.day
            is DietPlanAction.AddMeal -> launch { diet.addMeal(planId, action.day, action.name.trim(), action.time.trim()) }
            is DietPlanAction.UpdateMeal -> launch { diet.updateMeal(action.mealId, action.name.trim(), action.time.trim()) }
            is DietPlanAction.DeleteMeal -> launch { diet.deleteMeal(action.mealId) }
            is DietPlanAction.AddFood -> launch { diet.addFood(action.mealId, action.name.trim(), action.quantity.trim()) }
            is DietPlanAction.UpdateFood -> launch { diet.updateFood(action.foodId, action.name.trim(), action.quantity.trim()) }
            is DietPlanAction.DeleteFood -> launch { diet.deleteFood(action.foodId) }
            is DietPlanAction.CopyDay -> launch {
                copyDietDay(planId, PlanDay.Weekday(action.source), action.targets.map(PlanDay::Weekday).toSet())
            }
        }
    }

    private fun launch(block: suspend () -> Unit) {
        viewModelScope.launch { block() }
    }
}
