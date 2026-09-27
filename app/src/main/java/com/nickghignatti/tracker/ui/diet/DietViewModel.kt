package com.nickghignatti.tracker.ui.diet

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nickghignatti.tracker.domain.repository.DietRepository
import com.nickghignatti.tracker.domain.usecase.CopyDietDayUseCase
import com.nickghignatti.tracker.ui.common.stateInWhileSubscribed
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Clock
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.launch

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class DietViewModel @Inject constructor(
    clock: Clock,
    private val diet: DietRepository,
    private val copyDietDay: CopyDietDayUseCase,
) : ViewModel() {
    private val today = LocalDate.now(clock).dayOfWeek
    private val selectedDay = MutableStateFlow(today)

    val uiState: StateFlow<DietUiState> = selectedDay
        .flatMapLatest { day ->
            diet.observeMeals(day)
                .map { DietUiState(day, today, it, isLoading = false) }
                .onStart { emit(DietUiState(day, today)) }
        }
        .stateInWhileSubscribed(this, DietUiState(today, today))

    fun onAction(action: DietAction) {
        when (action) {
            is DietAction.SelectDay -> selectedDay.value = action.day
            is DietAction.AddMeal -> launch { diet.addMeal(selectedDay.value, action.name.trim(), action.time.trim()) }
            is DietAction.UpdateMeal -> launch { diet.updateMeal(action.mealId, action.name.trim(), action.time.trim()) }
            is DietAction.DeleteMeal -> launch { diet.deleteMeal(action.mealId) }
            is DietAction.AddFood -> launch { diet.addFood(action.mealId, action.name.trim(), action.quantity.trim()) }
            is DietAction.UpdateFood -> launch { diet.updateFood(action.foodId, action.name.trim(), action.quantity.trim()) }
            is DietAction.DeleteFood -> launch { diet.deleteFood(action.foodId) }
            is DietAction.CopyDay -> launch { copyDietDay(selectedDay.value, action.targets) }
        }
    }

    private fun launch(block: suspend () -> Unit) {
        viewModelScope.launch { block() }
    }
}
