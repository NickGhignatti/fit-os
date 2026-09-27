package com.nickghignatti.tracker.ui.today

import androidx.lifecycle.ViewModel
import com.nickghignatti.tracker.domain.repository.DietRepository
import com.nickghignatti.tracker.domain.repository.WorkoutRepository
import com.nickghignatti.tracker.ui.common.stateInWhileSubscribed
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Clock
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine

@HiltViewModel
class TodayViewModel @Inject constructor(
    clock: Clock,
    workouts: WorkoutRepository,
    diet: DietRepository,
) : ViewModel() {
    private val today = LocalDate.now(clock)

    val uiState: StateFlow<TodayUiState> =
        combine(workouts.observeWorkouts(today), diet.observeMeals(today.dayOfWeek)) { workoutList, meals ->
            TodayUiState(date = today, workouts = workoutList, meals = meals, isLoading = false)
        }.stateInWhileSubscribed(this, TodayUiState(today))
}
