package com.nickghignatti.tracker.ui.exercises

import com.nickghignatti.tracker.domain.model.Equipment
import com.nickghignatti.tracker.domain.model.ExerciseFilter
import com.nickghignatti.tracker.domain.model.ExerciseInfo
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.Muscle
import com.nickghignatti.tracker.domain.model.PlanDay

/** Where a picked exercise goes. */
sealed interface ExerciseTarget {
    data class Workout(val workoutId: Long) : ExerciseTarget

    data class Plan(val planId: Long, val day: PlanDay) : ExerciseTarget
}

data class ExercisePickerUiState(
    val query: String = "",
    val filter: ExerciseFilter = ExerciseFilter(),
    val results: List<ExerciseInfo> = emptyList(),
    /** The catalogue exercise whose sets are being chosen. */
    val picked: ExerciseInfo? = null,
    val isLoading: Boolean = true,
)

sealed interface ExercisePickerAction {
    data class QueryChanged(val query: String) : ExercisePickerAction

    /** Picking the selected value again clears it. */
    data class ToggleMuscle(val muscle: Muscle) : ExercisePickerAction
    data class ToggleEquipment(val equipment: Equipment) : ExercisePickerAction
    data class Pick(val exercise: ExerciseInfo) : ExercisePickerAction
    data object DismissPick : ExercisePickerAction

    /** Adds a catalogue exercise (its catalogId set) or a custom one. */
    data class Add(val exercise: ExercisePlan) : ExercisePickerAction
}

sealed interface ExercisePickerEvent {
    data object Added : ExercisePickerEvent
}
