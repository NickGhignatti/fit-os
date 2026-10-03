package com.nickghignatti.tracker.ui.day

import com.nickghignatti.tracker.domain.model.Exercise
import com.nickghignatti.tracker.domain.model.ExerciseSet
import com.nickghignatti.tracker.domain.model.PendingSession
import com.nickghignatti.tracker.domain.model.Workout
import java.time.LocalDate

data class DayUiState(
    val date: LocalDate,
    val isToday: Boolean,
    val workouts: List<Workout> = emptyList(),
    /** The active plan's session for this day, until it is started. */
    val pendingSession: PendingSession? = null,
    val isLoading: Boolean = true,
)

sealed interface DayAction {
    data object StartPlannedSession : DayAction
    data class CreateWorkout(val title: String) : DayAction
    data class RenameWorkout(val workoutId: Long, val title: String) : DayAction
    data class DeleteWorkout(val workoutId: Long) : DayAction
    data class CopyWorkout(val workoutId: Long, val target: LocalDate) : DayAction
    data class SaveAsPlan(val workoutId: Long, val name: String) : DayAction
    data class UpdateExercise(val exerciseId: Long, val name: String, val notes: String) : DayAction
    data class DeleteExercise(val exerciseId: Long) : DayAction
    data class AddSet(val exercise: Exercise) : DayAction
    data class ToggleSet(val set: ExerciseSet) : DayAction
    data class UpdateSet(val set: ExerciseSet) : DayAction
    data class DeleteSet(val setId: Long) : DayAction
}

/** One-off outcomes the screen confirms with a snackbar. */
sealed interface DayEvent {
    data class WorkoutCopied(val date: LocalDate) : DayEvent
    data class PlanSaved(val name: String) : DayEvent
}
