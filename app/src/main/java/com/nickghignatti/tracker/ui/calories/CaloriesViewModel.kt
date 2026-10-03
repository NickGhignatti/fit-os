package com.nickghignatti.tracker.ui.calories

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nickghignatti.tracker.domain.model.CalorieDay
import com.nickghignatti.tracker.domain.repository.FoodLogRepository
import com.nickghignatti.tracker.domain.usecase.LogPlannedMealUseCase
import com.nickghignatti.tracker.domain.usecase.ObserveCalorieDayUseCase
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
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class CaloriesViewModel @Inject constructor(
    clock: Clock,
    observeCalorieDay: ObserveCalorieDayUseCase,
    defaultMealNames: DefaultMealNames,
    private val foodLog: FoodLogRepository,
    private val logPlannedMeal: LogPlannedMealUseCase,
) : ViewModel() {
    private val today = LocalDate.now(clock)
    private val date = MutableStateFlow(today)
    private val defaultMeals = defaultMealNames.get()

    val uiState: StateFlow<CaloriesUiState> = date
        .flatMapLatest { shown ->
            observeCalorieDay(shown, defaultMeals)
                .map { CaloriesUiState(it, today, isLoading = false) }
                .onStart { emit(CaloriesUiState(CalorieDay(shown, emptyList()), today)) }
        }
        .stateInWhileSubscribed(this, CaloriesUiState(CalorieDay(today, emptyList()), today))

    fun onAction(action: CaloriesAction) {
        when (action) {
            CaloriesAction.PreviousDay -> date.update { it.minusDays(1) }
            CaloriesAction.NextDay -> date.update { it.plusDays(1) }
            CaloriesAction.GoToToday -> date.value = today
            is CaloriesAction.LogAsPlanned -> viewModelScope.launch { logPlannedMeal(date.value, action.meal) }
            is CaloriesAction.UpdateGrams -> viewModelScope.launch { foodLog.updateGrams(action.entryId, action.grams) }
            is CaloriesAction.DeleteEntry -> viewModelScope.launch { foodLog.deleteEntry(action.entryId) }
        }
    }
}
